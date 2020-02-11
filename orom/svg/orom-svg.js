document.documentElement.style.height = '99%';

body = document.body;
body.style.margin = '0px';
body.style.minHeight = '100%';

log = (x, str) => {
  if (str === undefined) console.log(x);
  else console.log(str, x);
  return x;
};

attr_single = (elem, key, val_or_func) => {
  let old;
  if (key === 'textContent') old = elem.textContent;
  else old = elem.getAttribute(key);

  let value = typeof(val_or_func) === 'function' ? val_or_func(old) : val_or_func;
  if (key === 'textContent') elem.textContent = value;
  else if (value !== undefined) elem.setAttribute(key, value);

  return old;
};

// e.g. attr(rect, {stroke_width: 5, stroke: 'red'})
//      attr(rect, 'stroke', 'red')
//      attr(rect, 'height', h => h+32)
//      attr(rect, {fill: 'orange', height: h => h+32})
attr = (elem, key_or_dict, val_or_nothing) => {
  if (typeof(key_or_dict) === 'string') {
    let key = key_or_dict;
    let value = val_or_nothing;
    return attr_single(elem, key, value);
  } else {
    let dict = key_or_dict;
    for (let [k,v_or_f] of Object.entries(dict)) {
      let key = k.replace('_','-');
      attr_single(elem, key, v_or_f);
    }
  }
}

nums = (arr) => arr.map(x => +x);
attrs = (el, ...keys) => keys.map(k => attr(el, k));
props = (o,  ...keys) => keys.map(k => o[k]);

svg_parent = body; // Default parent for new SVG elements

create_element = (tag, attrs, parent, namespace) => {
  let elem = document.createElementNS(namespace, tag);
  if (attrs !== undefined) attr(elem, attrs);
  if (parent === undefined) parent = svg_parent;
  parent.appendChild(elem);
  return elem;
};

// e.g. rect = svgel('rect', {x: 5, y: 5, width: 5, height: 5}, svg)
svgel = (tag, attrs, parent) => create_element(tag, attrs, parent, 'http://www.w3.org/2000/svg');

htmlel = (tag, attrs, parent) => create_element(tag, attrs, parent, 'http://www.w3.org/1999/xhtml');

state = function(o, k, v) {
  let old = o[k];
  if (v !== undefined) o[k] = v;
  return old;
}

// Links an SVG node to its domain-level JS object
svg_userData = (elem, obj) => state(elem, 'userData', obj);

vadd = ([a, b], [c, d]) => [a+c, b+d];
vsub = ([a, b], [c, d]) => [a-c, b-d];
vdot = ([a, b], [c, d]) => a*c + b*d;
vmul = (k, [a,b]) => [k*a, k*b];
vquad = v => vdot(v,v);
vlen = v => Math.sqrt(vquad(v));

xy = t => attrs(t, 'x', 'y').map(v => +v);

bbox = el => {
  let {x, y, width, height} = el.getBBox();
  let l = x,     t = y;
  let w = width, h = height;
  let r = l+w,   b = t+h;
  return {
    left: l, right: r, top: t, bottom: b, width: w, height: h,
    l, r, t, b, w, h
  };
}

offset = e => [e.offsetX, e.offsetY];

final = xs => xs[xs.length-1];

htranslate = x => `translate(${x}, 0)`;
vtranslate = y => `translate(0, ${y})`;

debug = {line: {}, point: {}};

debug.line.on = (elem) => { elem.style.strokeWidth = 5; };
debug.line.off = (elem) => { elem.style.strokeWidth = null; };
debug.point.on = ([cx,cy], stroke) => svgel('circle', {
  cx, cy, stroke, stroke_width: 2, r: 10, fill_opacity: 0
}, svg);
debug.point.off = (elem) => elem.remove();

send = ({ from, to, selector }, context) => {
  // Allow objects to receive messages however they wish
  // Treat absence of 'receive' as presence of 99%-case default
  let next_code_path = to.receive || defaults.dyn_double_dispatch;
  return next_code_path({ sender: from, recv: to, selector }, context || {});
};

defaults = {
  behavior: {
    ['clear-pending']: () => undefined,
  }
};

defaults.dyn_double_dispatch = ({ sender, recv, selector }, context) => {
  let behaviors = recv.behaviors.concat([ defaults.behavior ]); // have at least default behaviour
  for (let selector_to_next_code_path_or_behavior of behaviors) {
    let next_code_path_or_behavior = selector_to_next_code_path_or_behavior[selector];
    if (next_code_path_or_behavior === undefined) continue; // this behaviour doesn't deal with this type of input? Go to the next behaviour
    else if (typeof(next_code_path_or_behavior) === 'function') {
      let next_code_path = next_code_path_or_behavior;
      return next_code_path({ sender, recv, selector }, context);
    } else { // Assume further level of dispatch on sender - as a Map() rather than obj-dict
      let sender_to_next_code_path = next_code_path_or_behavior;
      let next_code_path = sender_to_next_code_path.get(sender);
      if (next_code_path === undefined) continue;
      else return next_code_path({ sender, recv, selector }, context);
    }
  }

  throw [`${recv} does not understand ${selector}`, recv, selector, context];
};

/* A Behavior is like an OROM vtable but without the possibility of fancy lookup
 * semantics, for practical purposes.
 *
 * An OROM vtable is a messageable object that computably generates executable
   code for "the current situation"'s short-term future time evolution.
 * The "current situation" is a message receipt and includes the message
 * selector, who sent it, the receiver, even the message-specific data...
 *
 * A Behaviour, on the other hand, is a data structure describing the same
 * function, but without the privilege of computation. It stores short-term
 * future time-evolution (STFTE?) code-paths indexed by message selector, and
 * optionally the sender.
 */
behaviors = {}

create = {};
create.entity = (create_args, ...behaviors) => {
  let o = {
    behaviors: [{}, ...behaviors],
    //           ^ Entity's own personal behavior overrides specific to its instance
  };
  send({to: o, selector: 'created'}, create_args);
  return o;
};

//      ---***   OBSERVABLE   ***---
// An Observable is live-state: a piece of state that notifies its dependents of change.
behaviors.observable = {
  ['created']: ({recv}, {func}) => {
    recv.value  = () => recv._value;
    recv.update =  v => recv._value = v;
    recv._subs     = new Set();
    recv.subs_copy = () => new Set(recv._subs);
    recv.add    = sub => recv._subs.add(sub);
    recv.remove = sub => recv._subs.delete(sub);
    recv.func = func === undefined ? (_,x)=>x : func;
  },
  /* I can be told that I changed to a new value, optionally including the old.
   * If a function is specified as a new value, I treat this as a way to
   * compute the new value from the old.
   * only_once means: mark each observable in the subscription graph, so each
   * one only sees the effects of this change once.
   * post_clear means: after I, the "first cause", spread this change throughout
   * the subscription graph, spread a message that un-marks the nodes, making
   * them ready for changes once again. Only makes sense with only_once as
   * well, but post_clear must ONLY be active on the very first change.
   * If it's propagated, then nodes are unmarked as soon as they've been
   * visited, leaving them vulnerable to duplicate messages and defeating the
   * purpose of marking them in the first place.
   */
  ['changed']: ({sender, recv}, {only_once, post_clear, to}) => {
    if (recv.pending) return; // if marked, ignore further changes. FCFS basis.
    let old_value = recv.value();
    let new_value = recv.func(sender, to);
    if (typeof(new_value) === 'function') new_value = new_value(old_value);
    if (new_value !== old_value) {
      recv.update(new_value); // if there is a difference, update self and dependents
      if (only_once) recv.pending = true;
      for (let s of recv.subs_copy()) {
        // notify each dependent that I changed, but use a copy of the list, so that
        // anyone who wishes to un-subscribe in response, can do so safely
        send({from: recv, to: s, selector: 'changed'}, {from: old_value, to: new_value, only_once}); // propagate only_once but NOT post_clear
      }
      // begin propagation of un-marking by sending message to self
      if (post_clear) send({to: recv, selector: 'clear-pending'});
    }
  },
  ['clear-pending']: ({recv}) => {
    if (!recv.pending) return;
    recv.pending = false;
    for (let s of recv.subs_copy()) {
      send({from: recv, to: s, selector: 'clear-pending'});
    }
  },
  ['poll']: ({recv}) => recv.value(), // returns mutable original...!
  // Feels like setting and un-setting an "is-subscribed" observable...
  ['subscribe-me']: ({sender, recv}) => {
    recv.add(sender);
    return recv;
  },
  ['unsubscribe-me']: ({sender, recv}) => {
    recv.remove(sender);
    return recv;
  },
};

change = (obs, new_value) => send({to: obs, selector: 'changed'}, {to: new_value});

root_change = (obs, new_value) => send(
  {to: obs, selector: 'changed'},
  {to: new_value, only_once: true, post_clear: true}
);

subscribe = (from, to) => send({from, to, selector: 'subscribe-me'});
unsubscribe = (from, to) => send({from, to, selector: 'unsubscribe-me'});

poll = (obs) => send({to: obs, selector: 'poll'});

create.observable = (func) => create.entity({func}, behaviors.observable);

// e.g. sink_to_dom_attrs(svg_rect, 'width') transmits changes to its width
// e.g. sink_to_dom_attrs(svg_circle, ['cx', 'cy'])
create.sink_to_dom_attrs = (node, attr_or_func) => {
  return {
    receive: ({recv,selector},{to}) => {
      if (selector === 'changed')
        if (typeof attr_or_func === 'string') {
          let attr_name = attr_or_func;
          attr(node, attr_name, to);
        } else if (typeof attr_or_func === 'function') {
          let value_to_attr_dict = attr_or_func;
          let attr_dict = value_to_attr_dict(to);
          attr(node, attr_dict);
        } else { // assume list
          let attr_names = attr_or_func;
          let attr_dict = list_to_attrs(...attr_names)(to);
          attr(node, attr_dict);
        }
    }
  }
};

// Subscribable and pollable version of the "sink"
create.dom_attrs_proxy = (node, attr_or_func, initial_value) => {
  let obs = create.observable();
  let sink = create.sink_to_dom_attrs(node, attr_or_func);
  subscribe(sink, obs);
  if (initial_value !== undefined) change(obs, initial_value);
  return obs;
};

// e.g. list_to_attrs('cx', 'cy')([10,20]) = {cx: 10, cy: 20}
list_to_attrs = (...keys) => (list) => {
  let dict = {};
  list.forEach((v, i) => dict[keys[i]] = v);
  return dict;
};

transform_translate = ([x,y]) => ({transform: `translate(${x},${y})`});

//      ---***   HAS-POSITION   ***---
behaviors.has_position = {
  ['created']: ({recv}) => {
    recv.position = create.observable();
  },
  ['position']: ({recv}) => recv.position,
};

//      ---***   POINTER   ***---
// Simulated presence of the human finger (or gaze).
behaviors.pointer = {
  ['created']: ({recv}) => {
    recv.behaviors.push(behaviors.has_position); // Kludged dependence on another behaviour
    behaviors.has_position['created']({recv}); // Hack in its initialisation...
    // Which translates to wanting to send 'created' to it in the context of this receiver
    // CODE INHERITANCE / CODE MIXINS ETC...

    let pos = send({to: recv, selector: 'position'});
    subscribe(recv, pos);

    recv.currently_considering = create.observable();
    subscribe(recv, recv.currently_considering);

    recv.is_considering = new Map(); // Entity --> Observable
  },
  ['is-considering-me?']: ({sender, recv}) => {
    // Problem: will prevent anything that ever asked this, from being GC'd.
    // Suggestion: store this in the sender, instead of receiver...?
    // A portion of an Entity (extensional function) used by another Entity.
    // Like an ID card you need to carry round for the benefit of your
    // institution, rather than ...?
    // This is all because it's primarily a property OF sender:
    // 'is-being-considered-by-pointer?', thus belongs with it.
    // Another conundrum: where to store truly bidirectional relationships?
    let is_considering_sender = recv.is_considering.get(sender);
    if (is_considering_sender === undefined) {
      is_considering_sender = create.observable();
      recv.is_considering.set(sender, is_considering_sender);
      change(is_considering_sender, false);
    }
    return is_considering_sender;
  },
  ['is-considering']: ({recv}) => recv.currently_considering,
  ['changed']: ({sender, recv}, context) => {
    if (sender === recv.currently_considering) {
      if (context.from !== undefined) {
        // Spoof message send from the "no longer considered" Entity ... urgh
        let no_longer_considering = send({from: context.from, to: recv, selector: 'is-considering-me?'});
        change(no_longer_considering, false);
      }

      if (context.to !== undefined) {
        let now_considering = send({from: context.to, to: recv, selector: 'is-considering-me?'});
        change(now_considering, true);
      }
    }
  }
};

//      ---***   POINT   ***---
/*
 * Currently a bit dishonest; would be better to call it Circle and expose
 * radius. My current philosophy is that extended bodies DO NOT have a well
 * defined "position"; it is a LIE to pick some arbitrary point on the body
 * (e.g. Top Left, Centre) and call this its "position", by fiat.
 * TODO: be HONEST about how I'm using the circle: circle.center
 * instead of circle.position.
*/
behaviors.point = {
  ['created']: ({recv}) => {
    recv.behaviors.push(behaviors.has_position);
    behaviors.has_position['created']({recv}); // again, init the position "part" of Entity

    recv.being_considered = send({from: recv, to: pointer, selector: 'is-considering-me?'});
    subscribe(recv, recv.being_considered);

    let circle = svgel('circle', {fill: 'white', r: 4}, svg);
    svg_userData(circle, recv);
    recv.svg = {
      circle: circle,
      center: create.sink_to_dom_attrs(circle, ['cx','cy']),
    };
    // contra 'pointer' above, directly access own state even if it's from another behaviour?
    subscribe(recv.svg.center, recv.position);

    change(recv.position, [0,0]);
  },
  ['changed']: ({sender, recv}, {to}) => {
    if (sender === recv.being_considered) {
      // Similar to behaviors.rect below! Share this code somehow?
      if (to === true) // PUSH...
        subscribe(recv, left_mouse_button_is_down);
      else // ... POP!
        unsubscribe(recv, left_mouse_button_is_down);
    } else if (sender === left_mouse_button_is_down) {
      let pointer_pos = send({to: pointer, selector: 'position'});
      // Spoof [un]subscription message from position to pointer's position
      // thus locking our position to follow the pointer
      if (to === true)
        subscribe(recv.position, pointer_pos);
      else
        unsubscribe(recv.position, pointer_pos);
    }
  },
  ['detach-dom']: ({recv}) => {
    recv.svg.circle.remove();
  },
};

create.point = (pos) => {
  let p = create.entity({}, behaviors.point);
  if (pos !== undefined) change(p.position, pos);
  return p;
}

//      ---***   ROD   ***---
behaviors.rod = {
  ['created']: ({recv}, {p1, p2}) => {
    recv.p1 = p1; recv.p2 = p2;
    subscribe(recv, p1);
    subscribe(recv, p2);

    recv.other = undefined;

    recv.length = create.observable();
    recv.p1_from_p2 = create.observable();
    recv.p2_from_p1 = create.observable();

    recv.transmit_deltas = create.observable();
    change(recv.transmit_deltas, [false,false]);

    let line = svgel('line', {}, svg);
    svg_userData(line, recv);
    recv.svg = {
      line: line,
      p1: create.sink_to_dom_attrs(line, ['x1', 'y1']),
      p2: create.sink_to_dom_attrs(line, ['x2', 'y2']),
      color: create.sink_to_dom_attrs(line, ([tx,ty]) => ({
        stroke: {
          true:  { true: '#ff0000', false: '#ffff00' },
          false: { true: '#ffff00', false: '#00ff00' }
        }[tx][ty]
      }))
    };
    subscribe(recv.svg.p1, p1);
    subscribe(recv.svg.p2, p2);
    subscribe(recv.svg.color, recv.transmit_deltas);

    recv.update_my_length_etc = () => {
      let p1 = poll(recv.p1);
      change(recv.svg.p1, p1);
      let p2 = poll(recv.p2);
      change(recv.svg.p2, p2);
      let p2_from_p1 = vsub(p2, p1);
      change(recv.p2_from_p1, p2_from_p1);
      change(recv.p1_from_p2, vmul(-1, p2_from_p1));
      change(recv.length, vlen(p2_from_p1));
    };

    recv.update_my_length_etc();
  },
  ['length']: ({recv}) => recv.length,
  ['transmit-deltas']: ({recv}) => recv.transmit_deltas,
  ['changed']: ({sender, recv}, {from, to, only_once}) => {
    debug.line.on(recv.svg.line);
    let debug_pts = [debug.point.on(poll(sender), 'magenta')];

    // If we caused the change, don't propagate it in a cycle
    if (sender === recv.other) recv.update_my_length_etc();
    else if (sender === recv.p1 || sender === recv.p2) {
      // If this change came from the outside, propagate as necessary
      recv.other = sender === recv.p1 ? recv.p2 : recv.p1;
      debug_pts.push(debug.point.on(poll(recv.other), 'orange'));

      let transmit_deltas = poll(recv.transmit_deltas);
      let [dx,dy] = vsub(to, from);
      let delta_for_other = [dx,dy];
      if (!transmit_deltas[0] || dx === 0) delta_for_other[0] = 0;
      if (!transmit_deltas[1] || dy === 0) delta_for_other[1] = 0;
      if (delta_for_other[0] !== 0 || delta_for_other[1] !== 0) {
        debug.line.off(recv.svg.line);
        debug_pts.forEach(debug.point.off);

        send({to: recv.other, selector: 'changed'}, {
          to: p => vadd(p, delta_for_other), only_once
        });
      } else recv.update_my_length_etc();
    }

    debug.line.off(recv.svg.line);
    debug_pts.forEach(debug.point.off);
  },
  ['clear-pending']: ({recv}) => {
    /* NB: recv.other functions like "pending" in Observable above
     * ... the Rod is not an Observable itself, but a maintainer of a relation
     * between Observables. Thus it needs to know about changes in any of its
     * Observables, but unlike a mere dependent, such as an SVG shape, it must
     * react to these changes by causing further changes in the rest of its
     * Observables. Because the purpose of clear-pending is to be forwarded down
     * the path of causality, the Rod must also forward it according to which
     * of its Observables caused changes in which others.
     */
    debug.line.on(recv.svg.line);

    if (recv.other === undefined) {
      debug.line.off(recv.svg.line);

      return;
    }

    let debug_circle = debug.point.on(poll(recv.other), 'orange');

    recv.other = undefined;

    debug.line.off(recv.svg.line);
    debug.point.off(debug_circle);

    send({to: recv.p1, selector: 'clear-pending'});
    send({to: recv.p2, selector: 'clear-pending'});
  },
  ['detach-dom']: ({recv}) => {
    recv.svg.line.remove();
    unsubscribe(recv, recv.p1);
    unsubscribe(recv, recv.p2);
  },
};

create.rod = (p1, p2) => {
  let rod = {
    behaviors: [{}, behaviors.rod]
  }
  p1 = send({to: p1, selector: 'position'});
  p2 = send({to: p2, selector: 'position'});
  send({to: rod, selector: 'created'}, {p1, p2});
  return rod;
}


//      ---***   BOX   ***---
/*
 * Boxer-like rect and text (keyname / title / CSS class) inside a <g>
*/
text_destination = create.observable();

next_id = create.observable();

gen_id = () => {
  let id = poll(next_id);
  change(next_id, x => x+1);
  return id;
};

behaviors.box = {
  ['created']: ({recv}, {dom_tree, fail_silent}) => {
    let abort = (loud_msg) => {
      if (fail_silent) return true;
      else throw [loud_msg, dom_tree];
    }

    //TODO: creates partial tree even if fails!! ROLLBACK

    recv.svg = {};

    if (dom_tree === undefined) recv.id = 'box-' + gen_id();
    else recv.id = attr(dom_tree, 'id');

    // Consists of a <g> ...
    if (dom_tree === undefined) recv.svg.group = svgel('g', {id: recv.id});
    else if (dom_tree.tagName !== 'g' && abort('Expected outermost <g>'))
      return;
    else recv.svg.group = dom_tree;

    svg_userData(recv.svg.group, recv);

    svg_parent = recv.svg.group;

    let rect, text;

    // ... containing a background <rect> ...
    if (dom_tree === undefined) rect = svgel('rect', {fill: 'grey'});
    else rect = dom_tree.querySelector(':scope > rect');
    if (!rect && abort('Expected <rect> in <g>')) return;

    svg_userData(rect, recv);

    // ... and a title <text> ...
    if (dom_tree === undefined) text = svgel('text', {
      font_family: 'Arial Narrow', x: 5, y: 20, fill: 'white'
    });
    else text = dom_tree.querySelector(':scope > text');
    if (!text && abort('Expected <text> in <g>')) return;

    svg_userData(text, recv);

    // ...and optionally a <textarea> ...
    if (dom_tree !== undefined) {
      let existing_textarea = dom_tree.querySelector(
        ':scope > foreignObject > textarea'
      );
      if (existing_textarea)
        send({to: recv, selector: 'add-textarea'}, {existing_textarea});
    }

    Object.assign(recv.svg, {
      rect, text,
      text_content: create.sink_to_dom_attrs(text, 'textContent'),
      css_class: create.sink_to_dom_attrs(recv.svg.group, 'class'),
    });

    recv.key_name = create.observable();
    subscribe(recv.svg.css_class, recv.key_name);
    subscribe(recv.svg.text_content, recv.key_name);

    if (dom_tree === undefined) change(recv.key_name, 'unnamed');
    else change(recv.key_name, text.textContent);

    recv.being_considered = send({from: recv, to: pointer, selector: 'is-considering-me?'});
    subscribe(recv, recv.being_considered);

    if (dom_tree !== undefined) { // Go down the tree and make sub-units
      dom_tree.querySelectorAll(':scope > g').forEach(g => {
        if (svg_userData(g) === undefined)
          if (create.box(g, true)) return;
          let arr = create.arrow({dom_tree: g, fail_silent: true});
          if (arr) recv.arrow = arr;
      });
    }

    return true;
  },
  ['add-textarea']: ({recv}, {existing_textarea}) => {
    if (existing_textarea === undefined) {
      if (recv.svg.textarea === undefined) {
        let foreign = svgel('foreignObject', {x: 5, y: 30, width: '100%', height: '100%'}, recv.svg.group);
        recv.svg.textarea = htmlel('textarea', {}, foreign);
      }
    } else {
      recv.svg.textarea = existing_textarea;
    }

    let my_textarea = recv.svg.textarea;

    // Initialise listeners
    my_textarea.onfocus = () => change(text_destination, undefined);
    my_textarea.onkeyup = te => {
      if (te.key === 'Enter' && te.ctrlKey) {
        let code_path = compile(te.target.value);
        code_path();
      } else {
        te.target.textContent = te.target.value; // Stay externalised!
      }
    };

    if (existing_textarea === undefined)
      my_textarea.value = '() => {throw "not implemented";}';
  },
  ['changed']: ({sender, recv}, {from, to}) => {
    if (sender === recv.being_considered) {
      // Similar to behaviors.point above! Share this code somehow?
      if (to === true) // PUSH...
        subscribe(recv, left_mouse_button_is_down);
      else // ... POP!
        unsubscribe(recv, left_mouse_button_is_down);
    } else if (sender === left_mouse_button_is_down) {
      let pointer_pos = send({to: pointer, selector: 'position'});
      let curr_pointer_pos = poll(pointer_pos);

      if (current_tool === 'draw') {
        if (to === true) {
          svg_parent = recv.svg.group;
          let box = create.box();
          let ctrls = make_active(box.svg.rect);
          root_change(ctrls.top_left.position, curr_pointer_pos);
          subscribe(ctrls.bot_right.position, pointer_pos);
          change(text_destination, box);
        }
      } else if (current_tool === 'arrow') {
        if (to === true) {
          svg_parent = recv.svg.group;
          let arrow = create.arrow({source_pos: curr_pointer_pos});
          subscribe(arrow.dest_pt.position, pointer_pos);
          arrow.dest_pt.svg.circle.style.visibility = 'hidden';
          recv.arrow = arrow;
          window.active_arrow = arrow;
        }
        change(text_destination, recv);
      } else if (window.active_arrow !== undefined) {
        let line = user_data(window.active_arrow.svg.arrow);
        unsubscribe(window.active_arrow.dest_pt.position, pointer_pos);
        window.active_arrow.dest_pt.svg.circle.style.visibility = null;
        let dest_circle = window.active_arrow.dest_circle;
        dest_circle.remove();
        recv.svg.group.appendChild(dest_circle);
        change(user_data(dest_circle).center, attrs(line.dom_node, 'x2', 'y2'));
        change(user_data(window.active_arrow.svg.group).global_origin_pt, undefined);
        window.active_arrow = undefined;
      }
    }
  }
};
create.box = (dom_tree, fail_silent) => {
  let box = {
    behaviors: [{}, behaviors.box]
  }
  let ok = send({to: box, selector: 'created'}, {dom_tree, fail_silent});
  return ok ? box : undefined;
}

behaviors.rect_controls = {
  ['created']: ({recv}) => {
    let tl = create.point([-1, -1]);
    let bl = create.point([-1, +1]);
    let br = create.point([+1, +1]);
    let tr = create.point([+1, -1]);

    recv.points = [tl,bl,br,tr];

    let rods = [
      [tl,bl,true,false],[bl,br,false,true],
      [br,tr,true,false],[tr,tl,false,true],
    ];

    recv.rods = rods.map(([a,b,tx,ty]) => {
      let rod = create.rod(a,b);
      change(rod.transmit_deltas, [tx,ty]);
      return rod;
    });

    recv.top_left = tl;
    recv.bot_left = bl;
    recv.top_right = tr;
    recv.bot_right = br;

    recv.width  = recv.rods[1].length;
    recv.height = recv.rods[0].length;

    ctrls = recv;
  },
  ['detach-dom']: ({recv}) => {
    recv.points.forEach(p => send({to: p, selector: 'detach-dom'}));
    recv.rods.forEach(r => send({to: r, selector: 'detach-dom'}));
  },
  ['rigid']: ({recv}) => {
    let tl = recv.top_left, br = recv.bot_right;
    c1 = create.point(vmul(0.5, vadd(poll(tl.position), poll(br.position))));
    c2 = create.point(vmul(0.5, vadd(poll(tl.position), poll(br.position))));
    let rtl = create.rod(c1, tl);
    let rbr = create.rod(c2, br);
    change(rtl.transmit_deltas, [true,true]);
    change(rbr.transmit_deltas, [true,true]);
  },
};

create.rect_controls = () => create.entity({}, behaviors.rect_controls);

//      ---***   ARROW   ***---
/*
 * Ref
*/

behaviors.arrow = {
  ['created']: ({recv}, {source_pos, dom_tree, fail_silent}) => {
    let abort = (loud_msg) => {
      if (fail_silent) return true;
      else throw [loud_msg, dom_tree];
    }

    recv.svg = {};

    // Consists of a <g> ...
    if (dom_tree === undefined) recv.svg.group = svgel('g', {id: recv.id});
    else if (dom_tree.tagName !== 'g' && abort('Expected outermost <g>'))
      return;
    else recv.svg.group = dom_tree;

    svg_userData(recv.svg.group, recv);
    svg_parent = recv.svg.group;

    let circle;

    // ... containing a background <circle> ...
    if (dom_tree === undefined)
      circle = svgel('circle', {
        r: 10, fill: 'white', stroke: 'black', id: 'circle-' + gen_id()
      });
    else circle = dom_tree.querySelector(':scope > circle');
    if (!circle && abort('Expected <circle> in <g>')) return;

    svg_userData(circle, recv);
    recv.svg.circle = circle;

    recv.source_pt = create.point([0,0]);
    recv.dest_pt = create.point([0,0]);

    recv.svg.arrow = svgel('line', {
      stroke: 'cyan', stroke_width: 1, marker_end: 'url(#Arrowhead)', class: 'arrow'
    }, svg);

    subscribe(user_data(recv.svg.arrow).start, recv.source_pt.position);
    subscribe(user_data(recv.svg.arrow).end, recv.dest_pt.position);

    change(user_data(recv.svg.group).global_origin_pt, recv.source_pt);
      if (dom_tree !== undefined)
        source_pos = props(recv.svg.group.getCTM(), 'e', 'f');
      if (source_pos !== undefined)
        root_change(recv.source_pt.position, source_pos);

    change(user_data(recv.svg.group).global_origin_pt, undefined);

    recv.dest_id = create.observable();
    // ingeniously abuse circle's invisible textContent for ID of dest element
    recv.svg.dest_id = send({to: user_data(recv.svg.circle), selector: 'attr'}, {
      name: 'textContent'
    });
    subscribe(recv.svg.dest_id, recv.dest_id);

    let current_id = attr(recv.svg.circle, 'textContent');
    if (current_id.length > 0) {
      change(recv.dest_id, current_id);
      recv.dest_circle = document.getElementById(current_id);
      change(recv.dest_pt.position, nums(attrs(recv.dest_circle, 'cx', 'cy')));
      svg_userData(recv.dest_circle, recv); // link it to this arrow object
    } else if (dom_tree !== undefined && abort('Expected dest id in circle textContent')) return;
    else {
      let dest_circle_id = 'circle-'+gen_id();
      change(recv.dest_id, dest_circle_id);
      recv.dest_circle = svgel('circle', {id: dest_circle_id}, recv.svg.group);
      svg_userData(recv.dest_circle, recv);
    }

    recv.source_pt.svg.circle.style.visibility = 'hidden';

    recv.being_considered = send({from: recv, to: pointer, selector: 'is-considering-me?'});
    subscribe(recv, recv.being_considered);

    // For managing top-level arrow <line>s, updating positions on box move
    recv.source_attachment_pt = create.observable();
    subscribe(recv, recv.source_attachment_pt);

    recv.dest_attachment_pt = create.observable();
    subscribe(recv, recv.dest_attachment_pt);

    return true;
  },
  ['changed']: ({sender, recv}, {from, to}) => {
    if (sender === recv.source_attachment_pt) {
      if (to === undefined) {
        if (recv.source_rod) {
          send({to: recv.source_rod, selector: 'detach-dom'});
          recv.source_rod = undefined;
        }
      } else {
        let attach_pt = to;
        recv.source_rod = create.rod(attach_pt, recv.source_pt);
        change(recv.source_rod.transmit_deltas, [true, true]);
      }
    } else if (sender == recv.dest_attachment_pt) { // same but s/source/dest/
      if (to === undefined) {
        if (recv.dest_rod) {
          send({to: recv.dest_rod, selector: 'detach-dom'});
          recv.dest_rod = undefined;
        }
      } else {
        let attach_pt = to;
        recv.dest_rod = create.rod(attach_pt, recv.dest_pt);
        change(recv.dest_rod.transmit_deltas, [true, true]);
      }
    } else if (sender === recv.being_considered) {
      // Duplicated again
      if (to === true) // PUSH...
        subscribe(recv, left_mouse_button_is_down);
      else // ... POP!
        unsubscribe(recv, left_mouse_button_is_down);
    } else if (sender === left_mouse_button_is_down) {
      let pointer_pos = send({to: pointer, selector: 'position'});

      if (to === true) {
        subscribe(recv.dest_pt.position, pointer_pos);
        recv.dest_pt.svg.circle.style.visibility = 'hidden';
        window.active_arrow = recv;
      }
    }
  }
};
create.arrow = (args) => create.entity(args, behaviors.arrow);

behaviors.dom = {};
behaviors.dom.node = {
  ['created']: ({recv}, {dom_node}) => {
    recv.dom_node = dom_node;
    dom_node.user_data = recv;
    recv.attrs = new Map();

    let behavior_for_tag = behaviors.dom[dom_node.tagName];
    if (behavior_for_tag !== undefined) {
      recv.behaviors.push(behavior_for_tag);
      behavior_for_tag['created']({recv});
    }
  },
  ['attr']: ({recv}, {name}) => {
    let obs = recv.attrs.get(name);
    if (obs === undefined) { // lazy init
      obs = create.sink_to_dom_attrs(recv.dom_node, name);
      recv.attrs.set(name, obs);
    }
    return obs;
  },
};
create.dom_node = (dom_node_to_wrap) => {
  let obj = {
    behaviors: [{}, behaviors.dom.node]
  }
  send({to: obj, selector: 'created'}, {dom_node: dom_node_to_wrap});
  return obj;
}

user_data = el => {
  if (el.user_data === undefined)
    el.user_data = create.dom_node(el);
  return el.user_data;
};

behaviors.dom.circle = {
  ['created']: ({recv}) => {
    recv.center = create.sink_to_dom_attrs(recv.dom_node, ['cx','cy']);
    recv.radius = create.sink_to_dom_attrs(recv.dom_node, 'r');
  },
};

behaviors.dom.line = {
  ['created']: ({recv}) => {
    recv.start = create.sink_to_dom_attrs(recv.dom_node, ['x1','y1']);
    recv.end = create.sink_to_dom_attrs(recv.dom_node, ['x2','y2']);
  },
};

behaviors.dom.rect = {
  ['created']: ({recv}) => {
    recv.top_left  = create.sink_to_dom_attrs(recv.dom_node, ['x','y']);
    recv.width     = create.sink_to_dom_attrs(recv.dom_node, 'width');
    recv.height    = create.sink_to_dom_attrs(recv.dom_node, 'height');
    recv.controls  = create.observable();
    subscribe(recv, recv.controls);
  },
  ['changed']: ({sender,recv}, {from,to}) => {
    if (sender === recv.controls) {
      let g = user_data(recv.dom_node.parentElement); // ASSUMED <g>
      if (from !== undefined) {
        recv.dom_node.style.strokeWidth = null;
        unsubscribe(recv.width,  from.width);
        unsubscribe(recv.height, from.height);
        send({to: from, selector: 'detach-dom'});
        change(g.global_origin_pt, undefined);

        if (g.dom_node !== backg.svg.group)
          g.dom_node.querySelectorAll('circle').forEach(c => {
            let arr = svg_userData(c);
            if (arr) {
              if (c.textContent.length === 0) // dest
                change(arr.dest_attachment_pt, undefined);
              else // source
                change(arr.source_attachment_pt, undefined);
            }
          });
      }
      if (to !== undefined) { // TODO: affect x,y vs. parent translate
        change(g.global_origin_pt, to.top_left);

        let bb = bbox(recv.dom_node);
        let top_left_now = poll(to.top_left.position);
        root_change(to.bot_right.position, vadd(
          top_left_now, props(bb, 'width', 'height')
        ));
        subscribe(recv.width,  to.width);
        subscribe(recv.height, to.height);
        recv.dom_node.style.strokeWidth = 2;

        // TODO: newly created arrows while controls exist won't get attached
        if (g.dom_node !== backg.svg.group)
          g.dom_node.querySelectorAll('circle').forEach(c => {
            let arr = svg_userData(c);
            if (arr) {
              if (c.textContent.length === 0) // dest
                change(arr.dest_attachment_pt, to.top_left);
              else // source
                change(arr.source_attachment_pt, to.top_left);
            }
          });
      }
    }
  },
};

behaviors.dom.g = {
  ['created']: ({recv}) => {
    recv.origin_from_parent = create.sink_to_dom_attrs(recv.dom_node, transform_translate);
    recv.global_origin_pt = create.observable();
    subscribe(recv, recv.global_origin_pt);
  },
  ['changed']: ({sender,recv},{from,to}) => {
    if (sender === recv.global_origin_pt) {
      if (from !== undefined) {
        unsubscribe(recv.origin_from_parent, recv.from_parent_rod.p2_from_p1);
        send({to: recv.from_parent_rod, selector: 'detach-dom'});
        send({to: recv.parent_origin_pt, selector: 'detach-dom'});
      }
      if (to !== undefined) {
        recv.parent_origin_pt = create.point( // create parent origin
          props(recv.dom_node.parentElement.getCTM(), 'e', 'f')
        );
        recv.parent_origin_pt.svg.circle.style.visibility = 'hidden'; // hide it
        let origin = props(recv.dom_node.getCTM(), 'e', 'f');
        let origin_pt = to;
        // translate these two into relative offset from parent
        recv.from_parent_rod = create.rod(recv.parent_origin_pt, origin_pt);
        change(recv.from_parent_rod.transmit_deltas, [false, false]);
        // feed into svg translate
        subscribe(recv.origin_from_parent, recv.from_parent_rod.p2_from_p1);
        root_change(origin_pt.position, origin); // snap other point to our origin
      }
    }
  }
};

pointer = create.entity({}, behaviors.pointer);

current_tool = 'move';

/*
 *  *** "DEVICE DRIVERS" FOR BINARY-STATE INPUT, POSITIONAL INPUT ***
 */

svg = body.querySelector('svg');
svg.style.border = '2px dashed red';
svg.getCTM = () => ({a: 0, b: 0, c: 0, d: 0, e: 0, f: 0}); // polyfill
svg_parent = svg;

externalised_next_id = document.getElementById('next-id');
subscribe(send({to: user_data(externalised_next_id), selector: 'attr'}, {name: 'textContent'}), next_id);
change(next_id, +externalised_next_id.textContent);

defs = svgel('defs');

arrowhead = svgel('marker', {
  id: 'Arrowhead', viewBox: '0 0 10 10',
  refX: 10, refY: 5,
  markerUnits: 'strokeWidth',
  markerWidth: 8, markerHeight: 6,
  orient: 'auto'
}, defs);

svgel('path', {
  d: 'M 0 0 L 10 5 L 0 10 z', fill: 'cyan'
}, arrowhead);

left_mouse_button_is_down = create.observable();

// Forget about coords; they are not part of the left button, or the keyboard, or the power button...
svg.onmousedown = e => {
  if (e.button === 0) root_change(left_mouse_button_is_down, true);
};

svg.onmouseup = e => {
  if (e.button === 0) root_change(left_mouse_button_is_down, false);
};

// mousemove => pointer position changed
svg.onmousemove = e => {
  let r = svg.getBoundingClientRect();
  let pos = vsub([e.clientX, e.clientY], [r.left, r.top]);
  root_change(send({to: pointer, selector: 'position'}), pos);
};

// mouseover => considering a new object
svg.onmouseover = e => {
  let obj = svg_userData(e.target);
  if (obj !== undefined)
    root_change(send({to: pointer, selector: 'is-considering'}), obj);
};

// mouseout => no longer considering the object
svg.onmouseout = e => {
  let obj = svg_userData(e.target);
  if (obj !== undefined)
    root_change(send({to: pointer, selector: 'is-considering'}), undefined);
};

/*   ^
 *  /|\   Requires that mouseout occurs before mouseover.
 * /_·_\  If not, will immediately stop considering new object.
 *
 */

backg = create.box(svg.querySelector('g'));
change(text_destination, backg);

resize = () => {
  let dims = {width: body.offsetWidth*0.99, height: body.offsetHeight*0.99};
  attr(svg, dims);
  attr(backg.svg.rect, dims);
};

window.onresize = resize;
resize()

body.onkeydown = e => {
  let { key } = e;
  let curr_active = poll(text_destination);
  if (curr_active !== undefined)
  if (key === 'Backspace') change(curr_active.key_name, s => s.slice(0,-1));
  else if (key === 'Enter') {
    if (curr_active.svg.textarea === undefined)
      send({to: curr_active, selector: 'add-textarea'});
    let textarea = curr_active.svg.textarea;
    textarea.focus();
    e.preventDefault();
  } else if (key.length === 1) change(curr_active.key_name, s => s + key);
};

active_rect = create.observable();

make_active = dom_rect => {
  rect = user_data(dom_rect);
  let curr_active = poll(active_rect);
  if (curr_active !== undefined) change(curr_active.controls, undefined);

  let controls = create.rect_controls();
  change(rect.controls, controls);
  change(active_rect, rect);

  if (svg_userData(dom_rect) !== undefined) {
    change(text_destination, svg_userData(dom_rect));
  }

  return controls;
}

svg.onclick = e => {
  if (e.button === 0)
    if (e.target.tagName === 'rect')
      make_active(e.target);
};

compile = src => new Function('return '+src)()

get_func = (...path) => compile(svg_userData(
  path_lookup(...path)
).svg.textarea.value);

follow_arrow = (g) => {
  let box = svg_userData(g); // assumes contains arrow
  let dest_circle = document.getElementById(poll(box.arrow.dest_id));
  return dest_circle ? dest_circle.parentElement : undefined;
};

single_lookup = (root, key) => {
  let grps = root.getElementsByClassName(key);
  return grps.length === 0 ? undefined : grps[0];
};

path_lookup = (...path) => {
  let lookup = (root, ...keys) => {
    if (root === undefined || keys.length === 0) return root;

    let [key, ...rest] = keys;
    let child = single_lookup(root, key);
    return lookup(child, ...rest);
  };
  return (typeof(path[0]) === 'string'
    ? lookup(backg.svg.group, ...path) // programmer's UI sugar
    : lookup(...path));
};

append_new_box = (parent, name) => {
  const pad = 10, height = 200;
  svg_parent = parent;
  box = create.box();

  // find the rects
  let p_rect = svg_userData(parent).svg.rect;
  let b_rect = box.svg.rect;

  // obtain access to the four corners of our new box and parent boxes
  let p_ctrls = create.rect_controls();
  change(user_data(p_rect).controls, p_ctrls);

  let b_ctrls = create.rect_controls();
  change(user_data(b_rect).controls, b_ctrls);

  root_change(b_ctrls.top_left.position, // bring new box to bottom
    vadd(poll(p_ctrls.bot_left.position), [pad,0])); // with some left pad
  root_change(b_ctrls.bot_right.position, // extend new box past bottom
    vadd(poll(p_ctrls.bot_right.position),[-pad,height])); // with right pad

  send({to: box, selector: 'add-textarea'});
  box.svg.textarea.style.width  = (+attr(box.svg.rect, 'width' )-20)+'px';
  box.svg.textarea.style.height = (+attr(box.svg.rect, 'height')-50)+'px';

  change(user_data(b_rect).controls, undefined); // no longer need these

  if (name !== undefined) change(box.key_name, name);

  change(user_data(p_rect).controls, undefined);

  for (let curr = parent; curr !== backg.svg.group; curr = curr.parentElement) {
    let ctrls = create.rect_controls();
    let rect = svg_userData(curr).svg.rect
    change(user_data(rect).controls, ctrls);
      // extend parent box to encompass new box, plus bottom pad
      root_change(ctrls.bot_right.position, ([x,y]) => [x, y+height+pad]);
    change(user_data(rect).controls, undefined);
  }

  return box;
}

/*
circ = create.dom_node(svgel('circle', {fill: 'red'}, svg));
circ_controls = create.entity({}, behaviors.rect_controls);
let tl = circ_controls.top_left.position, br = circ_controls.bot_right.position;
let pair = create.observable((p,pos) => p1p2 => {
  p1p2 = p1p2 === undefined ? [[0,0], [0,0]] : p1p2;
  let [p1,p2] = p1p2;
  if (p === tl) p1 = pos;
  else p2 = pos;
  return [p1,p2];
});
subscribe(pair, tl);
subscribe(pair, br);
let center = create.observable((_,[p1,p2]) => vmul(0.5, vadd(p1,p2)));
subscribe(center, pair);
subscribe(circ.center, center);
let half_w = create.observable((_,w) => w/2);
subscribe(half_w, circ_controls.width);
subscribe(circ.radius, half_w);
root_change(tl, [150, 100]);
root_change(br, [250, 200]);
*/


// GRRRRR
// send({to: ctrls, selector: 'rigid'});
//root_change(c1.position, ([x,y]) => [x+20, y-20]);
//root_change(c2.position, ([x,y]) => [x+20, y-20]);
