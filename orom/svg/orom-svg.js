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
      let p1 = send({to: recv.p1, selector: 'poll'});
      change(recv.svg.p1, p1);
      let p2 = send({to: recv.p2, selector: 'poll'});
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
    // If we caused the change, don't propagate it in a cycle
    if (sender === recv.other) recv.update_my_length_etc();
    else if (sender === recv.p1 || sender === recv.p2) {
      // If this change came from the outside, propagate as necessary
      recv.other = sender === recv.p1 ? recv.p2 : recv.p1;

      let transmit_deltas = send({to: recv.transmit_deltas, selector: 'poll'});
      let [dx,dy] = vsub(to, from);
      let delta_for_other = [dx,dy];
      if (!transmit_deltas[0] || dx === 0) delta_for_other[0] = 0;
      if (!transmit_deltas[1] || dy === 0) delta_for_other[1] = 0;
      if (delta_for_other[0] !== 0 || delta_for_other[1] !== 0) {
        send({to: recv.other, selector: 'changed'}, {
          to: p => vadd(p, delta_for_other), only_once
        });
      } else recv.update_my_length_etc();
    }
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
    if (recv.other === undefined) return;
    recv.other = undefined;
    send({to: recv.p1, selector: 'clear-pending'});
    send({to: recv.p2, selector: 'clear-pending'});
  },
  ['detach-dom']: ({recv}) => {
    recv.svg.line.remove();
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


//      ---***   RECT   ***---
/*
 * Currently functioning as a fusion of "rectangle controls", SVG rect
 * proxy and box-dict (<g> group etc.) TODO: separate these three out.
*/
last_active = create.observable();

next_id = 1;

behaviors.rect = {
  ['created']: ({recv}) => {
    recv.id = 'box-' + next_id; next_id++;
    recv.svg = {
      group: svgel('g', {id: recv.id})
    };
    svg_userData(recv.svg.group, recv);

    let tl = create.point([-1, -1]);
    let bl = create.point([-1, +1]);
    let br = create.point([+1, +1]);
    let tr = create.point([+1, -1]);
    let handle = create.point([0,0]); // so it appears behind and doesn't get LMB
    attr(handle.svg.circle, 'visibility', 'hidden');

    recv.points = [tl,bl,br,tr,handle];

    let rods = [
      [tl,bl],[bl,br],[br,tr],[tr,tl],
      [handle,tl],[handle,bl],[handle,br],[handle,tr]
    ];

    recv.rods = rods.map(([a,b]) => create.rod(a,b));

    recv.svg.top_left = create.sink_to_dom_attrs(recv.svg.group, transform_translate);
    let parent = svg_userData(recv.svg.group.parentElement);
    if (parent !== undefined && parent.top_left !== undefined) {
      recv.parent_to_me = create.rod(parent.top_left, tl);
      subscribe(recv.svg.top_left, recv.parent_to_me.p2_from_p1);
    } else subscribe(recv.svg.top_left, tl.position);

    svg_parent = recv.svg.group;

    let rect = svgel('rect', {fill: 'grey'});
    svg_userData(rect, recv);
    recv.being_considered = send({from: recv, to: pointer, selector: 'is-considering-me?'});
    subscribe(recv, recv.being_considered);

    let text = svgel('text', {font_family: 'Arial Narrow', x: 5, y: 20, fill: 'white'});
    svg_userData(rect, recv);

    Object.assign(recv.svg, {
      rect: rect,
      width: create.sink_to_dom_attrs(rect, 'width'),
      height: create.sink_to_dom_attrs(rect, 'height'),
      text: text,
      text_content: create.sink_to_dom_attrs(text, 'textContent'),
      css_class: create.sink_to_dom_attrs(recv.svg.group, 'class'),
    });

    subscribe(recv.svg.width, recv.rods[1].length);
    subscribe(recv.svg.height, recv.rods[0].length);

    recv.key_name = create.observable();
    subscribe(recv.svg.css_class, recv.key_name);
    subscribe(recv.svg.text_content, recv.key_name);
    change(recv.key_name, 'unnamed');

    recv.mode = create.observable();
    subscribe(recv, recv.mode);

    change(recv.mode, 'boxy');

    recv.top_left = tl;
    recv.bot_left = bl;
    recv.bot_right = br;
    recv.top_right = tr;
    recv.handle = handle;
  },
  ['changed']: ({sender, recv}, {from, to}) => {
    if (sender === recv.mode) {
      if (to === 'boxy') {
        props(recv.rods, 0,2).forEach(r => // verticals transmit hor changes
          change(r.transmit_deltas, [true,false])
        );
        props(recv.rods, 1,3).forEach(r => // horizontals transmit ver changes
          change(r.transmit_deltas, [false,true])
        );
        props(recv.rods, 4,5,6,7).forEach(r => // Handle-point is free to jump to the next click within the rect
          change(r.transmit_deltas, [false,false])
        );
        for (let child of recv.svg.group.children) { // recurse to descendants...
          if (child.tagName !== 'g') continue;
          let entity = svg_userData(child);
          if (entity === undefined) continue;
          if (entity.parent_to_me !== undefined) // allow descendants to move relative to parent
            change(entity.parent_to_me.transmit_deltas, [false,false]);
          if (entity.mode !== undefined)
            change(entity.mode, 'boxy'); // restore descendants
        }
      } else if (to === 'rigid') {
        props(recv.rods, 0,2).forEach(r => // don't ruin rigid body changes
          change(r.transmit_deltas, [false,false])
        );
        props(recv.rods, 1,3).forEach(r => // don't ruin rigid body changes
          change(r.transmit_deltas, [false,false])
        );
        props(recv.rods, 4,5,6,7).forEach(r => // Handle-point copies changes to corners
          change(r.transmit_deltas, [true,true])
        );
        for (let child of recv.svg.group.children) { // recurse to descendants...
          if (child.tagName !== 'g') continue;
          let entity = svg_userData(child);
          if (entity === undefined) continue;
          if (entity.parent_to_me !== undefined) // connect parent rigid changes to child
            change(entity.parent_to_me.transmit_deltas, [true,true]);
          if (entity.mode !== undefined)
            change(entity.mode, 'rigid'); // make descendants rigid bodies
        }
      }
    } else if (sender === recv.being_considered) {
      // Similar to behaviors.point above! Share this code somehow?
      if (to === true) // PUSH...
        subscribe(recv, left_mouse_button_is_down);
      else // ... POP!
        unsubscribe(recv, left_mouse_button_is_down);
    } else if (sender === left_mouse_button_is_down) {
      let pointer_pos = send({to: pointer, selector: 'position'});
      let curr_pointer_pos = send({to: pointer_pos, selector: 'poll'});

      if (current_tool === 'move' && svg_userData(recv.svg.group.parentElement) !== undefined) { // proxy for top-level root rect
        if (to === true) { // Had to push handle point behind rect to make this work...
          root_change(recv.handle.position, curr_pointer_pos);
          subscribe(recv.handle.position, pointer_pos);
          change(recv.mode, 'rigid');
        } else {
          unsubscribe(recv.handle.position, pointer_pos);
          change(recv.mode, 'boxy');
        }
      } else if (current_tool === 'draw') {
        if (to === true) {
          svg_parent = recv.svg.group;
          let rect = create.rect();
          root_change(rect.top_left.position, curr_pointer_pos);
          subscribe(rect.bot_right.position, pointer_pos);
        }
      } else if (current_tool === 'arrow') {
        if (to === true) {
          svg_parent = recv.svg.group;
          let arrow = create.arrow();
          root_change(arrow.source.position, curr_pointer_pos);
          subscribe(arrow.svg.line_end, pointer_pos);
          window.active_arrow = arrow;
        } else if (window.active_arrow !== undefined) {
          let dest = window.active_arrow.svg.line_end;
          unsubscribe(dest, pointer_pos);
          subscribe(dest, recv.top_left.position);
          change(window.active_arrow.dest_id, recv.id);
          window.active_arrow = undefined;
        }
      }
      change(last_active, recv);
    }
  }
};
create.rect = () => create.entity({}, behaviors.rect);

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
  },
  ['detach-dom']: ({recv}) => {
    recv.points.forEach(p => send({to: p, selector: 'detach-dom'}));
    recv.rods.forEach(r => send({to: r, selector: 'detach-dom'}));
  },
};

//      ---***   ARROW   ***---
/*
 * Ref
*/

behaviors.arrow = {
  ['created']: ({recv}) => {
    recv.svg = {
      group: svgel('g'),
    };
    svg_userData(recv.svg.group, recv);

    recv.source = create.point([-1, -1]);
    svg_parent = recv.svg.group;
    recv.svg.circle = svgel('circle', {r: 10, fill: 'white', stroke: 'black'});
    svg_userData(recv.svg.circle, recv);

    recv.svg.arrow = svgel('line', {
      stroke: 'cyan', stroke_width: 1, marker_end: 'url(#Arrowhead)', class: 'arrow'
    }, svg);

    recv.svg.line_start = create.sink_to_dom_attrs(recv.svg.arrow, ['x1', 'y1']);
    recv.svg.line_end   = create.sink_to_dom_attrs(recv.svg.arrow, ['x2', 'y2']);

    subscribe(recv.svg.line_start, recv.source.position);

    recv.dest_id = create.observable();
    // ingeniously abuse circle's invisible textContent for ID of dest element
    recv.svg.dest_id = create.sink_to_dom_attrs(recv.svg.circle, 'textContent');
    subscribe(recv.svg.dest_id, recv.dest_id);

    recv.svg.translate = create.sink_to_dom_attrs(recv.svg.group, transform_translate);
    let parent = svg_userData(recv.svg.group.parentElement);
    if (parent !== undefined && parent.top_left !== undefined) {
      recv.parent_to_me = create.rod(parent.top_left, recv.source);
      subscribe(recv.svg.translate, recv.parent_to_me.p2_from_p1);
    } else subscribe(recv.svg.translate, recv.source.position);

    recv.being_considered = send({from: recv, to: pointer, selector: 'is-considering-me?'});
    subscribe(recv, recv.being_considered);
  },
  ['changed']: ({sender, recv}, {from, to}) => {
    if (sender === recv.being_considered) {
      // Duplicated again
      if (to === true) // PUSH...
        subscribe(recv, left_mouse_button_is_down);
      else // ... POP!
        unsubscribe(recv, left_mouse_button_is_down);
    } else if (sender === left_mouse_button_is_down) {
      let pointer_pos = send({to: pointer, selector: 'position'});

      if (to === true) {
        subscribe(recv.svg.line_end, pointer_pos);
        window.active_arrow = recv;
      }
    }
  }
};
create.arrow = () => create.entity({}, behaviors.arrow);

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
    el.user_data = create.dom_node({dom_node: el});
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
    recv.p1 = create.sink_to_dom_attrs(recv.dom_node, ['x1','y1']);
    recv.p2 = create.sink_to_dom_attrs(recv.dom_node, ['x2', 'y2']);
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
      let g = recv.dom_node.parentElement;
      if (from !== undefined) {
        unsubscribe(recv.width,  from.width);
        unsubscribe(recv.height, from.height);
        unsubscribe(user_data(g).origin_from_parent, g.from_parent_rod.p2_from_p1);
        send({to: from, selector: 'detach-dom'});
        send({to: g.from_parent_rod, selector: 'detach-dom'});
        send({to: g.parent_origin_pt, selector: 'detach-dom'});
      }
      if (to !== undefined) {
        g.parent_origin_pt = create.point(
          props(g.parentElement.getCTM(), 'e', 'f')
        );
        let g_origin = props(g.getCTM(), 'e', 'f');
        let g_origin_pt = to.top_left;
        root_change(g_origin_pt.position, g_origin);
        g.from_parent_rod = create.rod(g.parent_origin_pt, g_origin_pt);
        change(g.from_parent_rod.transmit_deltas, [false, false]);
        subscribe(user_data(g).origin_from_parent, g.from_parent_rod.p2_from_p1);

        let bb = bbox(recv.dom_node);
        root_change(to.bot_right.position, vadd(
          g_origin, props(bb, 'width', 'height')
        ));
        subscribe(recv.width,  to.width);
        subscribe(recv.height, to.height);
      }
    }
  },
};

behaviors.dom.g = {
  ['created']: ({recv}) => {
    recv.origin_from_parent = create.sink_to_dom_attrs(recv.dom_node, transform_translate);
  },
};

pointer = create.entity({}, behaviors.pointer);

current_tool = 'draw';

/*
 *  *** "DEVICE DRIVERS" FOR BINARY-STATE INPUT, POSITIONAL INPUT ***
 */

svg = svgel('svg');
svg.style.border = '2px dashed red';
svg_parent = svg;

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

backg = create.rect();
attr(backg.svg.rect, 'fill', 'black');
root_change(backg.top_left.position, [0,0]);
change(last_active, backg);

resize = () => {
  let dims = {width: body.offsetWidth*0.99, height: body.offsetHeight*0.99};
  attr(svg, dims);
  change(backg.bot_right.position, [dims.width, dims.height]);
};

window.onresize = resize;
resize()

compile = src => new Function('return '+src)()

body.onkeydown = e => {
  let { key } = e;
  let curr_active = send({to: last_active, selector: 'poll'});
  if (curr_active !== undefined)
  if (key === 'Backspace') change(curr_active.key_name, s => s.slice(0,-1));
  else if (key === 'Enter') {
    let foreign = curr_active.svg.foreign_html;
    if (foreign === undefined) {
      foreign = svgel('foreignObject', {x: 5, y: 30, width: '100%', height: '100%'}, curr_active.svg.group);
      curr_active.svg.textarea = htmlel('textarea', {}, foreign);
      curr_active.svg.textarea.onfocus = () => change(last_active, undefined);
      curr_active.svg.textarea.onkeydown = te => {
        if (te.key === 'Enter' && te.ctrlKey) {
          let code_path = compile(te.target.value);
          code_path();
        }
      };
      curr_active.svg.textarea.value = '() => {throw "not implemented";}';
      curr_active.svg.foreign_html = foreign;
    }
    let textarea = curr_active.svg.textarea;
    textarea.focus();
    e.preventDefault();
  } else if (key.length === 1) change(curr_active.key_name, s => s + key);
};

deref = id => svg_userData(document.getElementById(id));

single_lookup = (root, key) => {
  let grps = root.getElementsByClassName(key);
  return grps.length === 0 ? undefined : grps[0];
};

path_lookup = (root, ...keys) => {
  if (root === undefined || keys.length === 0) return root;

  let [key, ...rest] = keys;
  let child = single_lookup(root, key);
  return path_lookup(child, ...rest);
};

active_rect = create.observable();

make_rect = (x,y,w,h,parent) => {
  let g = create.dom_node(svgel('g', transform_translate([x,y]), parent));
  let rect = create.dom_node(svgel('rect', {
    fill: 'lightgray', x: 0, y: 0, width: w, height: h
  }, g.dom_node));

  rect.dom_node.onclick = () => {
    let curr_active = send({to: active_rect, selector: 'poll'});
    if (curr_active !== undefined) change(curr_active.controls, undefined);

    let controls = create.entity({}, behaviors.rect_controls);
    change(rect.controls, controls);
    change(active_rect, rect);
  };
};

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
