document.documentElement.style.height = '99%';

body = document.body;
body.style.margin = '0px';
body.style.minHeight = '100%';

// e.g. attr(rect, {stroke_width: 5, stroke: 'red'})
//      attr(rect, 'stroke', 'red')
//      attr(rect, 'height', h => h+32)
//      attr(rect, {fill: 'orange', height: h => h+32})
attr = (elem, key_or_dict, val_or_nothing) => {
  if (typeof(key_or_dict) === 'string') {
    let key = key_or_dict;
    let val = val_or_nothing;
    let old = elem.getAttribute(key);
    if (typeof(val) === 'function') elem.setAttribute(key, val(old));
    else if (val !== undefined)     elem.setAttribute(key, val);
    return old;
  } else {
    let dict = key_or_dict;
    for (let [k,v_or_f] of Object.entries(dict)) {
      let key = k.replace('_','-');
      let old = elem.getAttribute(key);
      let value = typeof(v_or_f) === 'function' ? v_or_f(old) : v_or_f;
      elem.setAttribute(key, value);
    }
  }
}

attrs = (el, ...keys) => keys.map(k => attr(el, k));
props = (o,  ...keys) => keys.map(k => o[k]);

svg_parent = body; // Default parent for new SVG elements

// e.g. rect = svgel('rect', {x: 5, y: 5, width: 5, height: 5}, svg)
svgel = (tag, attrs, parent) => {
  let elem = document.createElementNS("http://www.w3.org/2000/svg", tag);
  if (attrs !== undefined) attr(elem, attrs);
  if (parent === undefined) parent = svg_parent;
  parent.appendChild(elem);
  return elem;
};

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

offset = e => [e.offsetX, e.offsetY]

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
create.entity = (...behaviors) => {
  let o = {
    behaviors: [{}, ...behaviors],
    //           ^ Entity's own personal behavior overrides specific to its instance
  };
  send({to: o, selector: 'created'});
  return o;
};

//      ---***   OBSERVABLE   ***---
// An Observable is live-state: a piece of state that notifies its dependents of change.
behaviors.observable = {
  ['created']: ({recv}) => {
    recv.value  = () => recv._value;
    recv.update =  v => recv._value = v;
    recv._subs     = new Set();
    recv.subs_copy = () => new Set(recv._subs);
    recv.add    = sub => recv._subs.add(sub);
    recv.remove = sub => recv._subs.delete(sub);
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
  ['changed']: ({recv}, {only_once, post_clear, to}) => {
    if (recv.pending) return; // if marked, ignore further changes. FCFS basis.
    let old_value = recv.value();
    let new_value = to;
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

root_change = (obs, new_value) => send(
  {to: obs, selector: 'changed'},
  {to: new_value, only_once: true, post_clear: true}
);

create.observable = () => create.entity(behaviors.observable);

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
    send({from: recv, to: pos, selector: 'subscribe-me'});

    recv.currently_considering = create.observable();
    send({from: recv, to: recv.currently_considering, selector: 'subscribe-me'});

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
      send({to: is_considering_sender, selector: 'changed'}, {to: false});
    }
    return is_considering_sender;
  },
  ['is-considering']: ({recv}) => recv.currently_considering,
  ['changed']: ({sender, recv}, context) => {
    if (sender === recv.currently_considering) {
      if (context.from !== undefined) {
        // Spoof message send from the "no longer considered" Entity ... urgh
        let no_longer_considering = send({from: context.from, to: recv, selector: 'is-considering-me?'});
        send({to: no_longer_considering, selector: 'changed'}, {to: false});
      }

      if (context.to !== undefined) {
        let now_considering = send({from: context.to, to: recv, selector: 'is-considering-me?'});
        send({to: now_considering, selector: 'changed'}, {to: true});
      }
    }
  }
};

//      ---***   BACKGROUND   ***---
behaviors.background = {
  ['created']: ({recv}) => {
   recv.rect = svgel('rect', {x: 0, y: 0, fill: 'black'}, svg);
   svg_userData(recv.rect, recv);

   recv.dims = create.observable();
   send({from: recv, to: recv.dims, selector: 'subscribe-me'});

   recv.being_considered = send({from: recv, to: pointer, selector: 'is-considering-me?'});
   send({from: recv, to: recv.being_considered, selector: 'subscribe-me'});

   /* Initialise object's own specific 'changed' behaviour as a dispatch on
      sender, where sender is compared to dynamic run-time properties of receiver
      i.e. its "dims" or "being_considered" observables just created.
    */

   // First: lazy init the Map.
   recv.behaviors[0]['changed'] = recv.behaviors[0]['changed'] || new Map();
   let m = recv.behaviors[0]['changed'];
   // Next: add the entries.

   m.set(recv.being_considered, ({recv}, {to}) => {
     if (to === true) // PUSH...
       send({from: recv, to: left_mouse_button_is_down, selector: 'subscribe-me'});
     else // ... POP!
       send({from: recv, to: left_mouse_button_is_down, selector: 'unsubscribe-me'});
   });

   m.set(recv.dims, ({recv}, {to}) => {
     attr(recv.rect, to);
   });

   m.set(left_mouse_button_is_down, ({recv}, {to}) => {
     if (to === true) {
       let pointer_pos = send({to: send({to: pointer, selector: 'position'}),
                       selector: 'poll'});

       svg_parent = svg;
       let rect = create.rect();
       root_change(rect.top_left.position, pointer_pos);
       send({from: rect.bot_right.position, to: pointer.position, selector: 'subscribe-me'});
     }
    });

    /*
    Either we poll at runtime (if (sender === recv.being_considered)) every time,
    or we construct an associative array that is only possible AFTER those are created.
    This chosen latter solution relies on the requirement that the two observables
    retain their identities throughout the background's lifetime, which is fair.
    (as well as left_mouse_button_is_down)
    */
  }, /* At runtime this will be:
  ['changed']: Map(
    recv.being_considered     |-> ({recv}, {to}) => {...}
    recv.dims                 |-> ({recv}, {to}) => {...}
    left_mouse_button_is_down |-> ({recv}, {to}) => {...}
  )
  */
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
    send({from: recv, to: recv.being_considered, selector: 'subscribe-me'});

    let circle = svgel('circle', {fill: 'white', r: 4}, svg);
    svg_userData(circle, recv);
    recv.svg = {
      circle: circle,
      center: create.sink_to_dom_attrs(circle, ['cx','cy']),
    };
    // contra 'pointer' above, directly access own state even if it's from another behaviour?
    send({from: recv.svg.center, to: recv.position, selector: 'subscribe-me'});

    send({to: recv.position, selector: 'changed'}, {to: [0,0]});
  },
  ['changed']: ({sender, recv}, {to}) => {
    if (sender === recv.being_considered) {
      // Same as in behaviors.background above!! Share this code somehow?
      if (to === true) // PUSH...
        send({from: recv, to: left_mouse_button_is_down, selector: 'subscribe-me'});
      else // ... POP!
        send({from: recv, to: left_mouse_button_is_down, selector: 'unsubscribe-me'});
    } else if (sender === left_mouse_button_is_down) {
      let pointer_pos = send({to: pointer, selector: 'position'});
      // Spoof [un]subscription message from position to pointer's position
      // thus locking our position to follow the pointer
      if (to === true)
        send({from: recv.position, to: pointer_pos, selector: 'subscribe-me'});
      else
        send({from: recv.position, to: pointer_pos, selector: 'unsubscribe-me'});
    }
  },
};

create.point = (pos) => {
  let p = create.entity(behaviors.point);
  if (pos !== undefined) {
    send({to: p.position, selector: 'changed'}, {to: pos});
  }
  return p;
}

//      ---***   ROD   ***---
behaviors.rod = {
  ['created']: ({recv}, {p1, p2}) => {
    recv.p1 = p1; recv.p2 = p2;
    send({from: recv, to: p1, selector: 'subscribe-me'});
    send({from: recv, to: p2, selector: 'subscribe-me'});

    recv.other = undefined;

    recv.length = create.observable();
    recv.p1_from_p2 = create.observable();
    recv.p2_from_p1 = create.observable();

    recv.transmit_deltas = create.observable();
    send({to: recv.transmit_deltas, selector: 'changed'}, {to: [false,false]});

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
    send({from: recv.svg.p1, to: p1, selector: 'subscribe-me'});
    send({from: recv.svg.p2, to: p2, selector: 'subscribe-me'});
    send({from: recv.svg.color, to: recv.transmit_deltas, selector: 'subscribe-me'});

    recv.update_my_length_etc = () => {
      let p1 = send({to: recv.p1, selector: 'poll'});
      let p2 = send({to: recv.p2, selector: 'poll'});
      let p2_from_p1 = vsub(p2, p1);
      send({to: recv.p2_from_p1, selector: 'changed'}, {to: p2_from_p1});
      send({to: recv.p1_from_p2, selector: 'changed'}, {to: vmul(-1, p2_from_p1)});
      send({to: recv.length, selector: 'changed'}, {to: vlen(p2_from_p1)});
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
behaviors.rect = {
  ['created']: ({recv}) => {
    recv.svg = {
      group: svgel('g')
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
      send({from: recv.svg.top_left, to: recv.parent_to_me.p2_from_p1, selector: 'subscribe-me'});
    } else send({from: recv.svg.top_left, to: tl.position, selector: 'subscribe-me'});

    svg_parent = recv.svg.group;

    let rect = svgel('rect', {fill: 'grey'});
    svg_userData(rect, recv);
    recv.being_considered = send({from: recv, to: pointer, selector: 'is-considering-me?'});
    send({from: recv, to: recv.being_considered, selector: 'subscribe-me'});

    Object.assign(recv.svg, {
      rect: rect,
      width:    create.sink_to_dom_attrs(rect, 'width'),
      height:   create.sink_to_dom_attrs(rect, 'height'),
    });

    send({from: recv.svg.width,  to: recv.rods[1].length, selector: 'subscribe-me'});
    send({from: recv.svg.height, to: recv.rods[0].length, selector: 'subscribe-me'});

    recv.mode = create.observable();
    send({from: recv, to: recv.mode, selector: 'subscribe-me'});

    send({to: recv.mode, selector: 'changed'}, {to: 'boxy'});

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
          send({to: r.transmit_deltas, selector: 'changed'}, {to: [true,false]})
        );
        props(recv.rods, 1,3).forEach(r => // horizontals transmit ver changes
          send({to: r.transmit_deltas, selector: 'changed'}, {to: [false,true]})
        );
        props(recv.rods, 4,5,6,7).forEach(r => // Handle-point is free to jump to the next click within the rect
          send({to: r.transmit_deltas, selector: 'changed'}, {to: [false,false]})
        );
        for (let child of recv.svg.group.children) { // recurse to descendants...
          if (child.tagName !== 'g') continue;
          let entity = svg_userData(child);
          if (entity === undefined) continue;
          if (entity.parent_to_me !== undefined) // allow descendants to move relative to parent
            send({to: entity.parent_to_me.transmit_deltas, selector: 'changed'}, {to: [false,false]})
          send({to: entity.mode, selector: 'changed'}, {to: 'boxy'}); // restore descendants
        }
      } else if (to === 'rigid') {
        props(recv.rods, 0,2).forEach(r => // don't ruin rigid body changes
          send({to: r.transmit_deltas, selector: 'changed'}, {to: [false,false]})
        );
        props(recv.rods, 1,3).forEach(r => // don't ruin rigid body changes
          send({to: r.transmit_deltas, selector: 'changed'}, {to: [false,false]})
        );
        props(recv.rods, 4,5,6,7).forEach(r => // Handle-point copies changes to corners
          send({to: r.transmit_deltas, selector: 'changed'}, {to: [true,true]})
        );
        for (let child of recv.svg.group.children) { // recurse to descendants...
          if (child.tagName !== 'g') continue;
          let entity = svg_userData(child);
          if (entity === undefined) continue;
          if (entity.parent_to_me !== undefined) // connect parent rigid changes to child
            send({to: entity.parent_to_me.transmit_deltas, selector: 'changed'}, {to: [true,true]})
          send({to: entity.mode, selector: 'changed'}, {to: 'rigid'}); // make descendants rigid bodies
        }
      }
    } else if (sender === recv.being_considered) {
      // Same as in behaviors.{background,point} above!! Share this code somehow?
      if (to === true) // PUSH...
        send({from: recv, to: left_mouse_button_is_down, selector: 'subscribe-me'});
      else // ... POP!
        send({from: recv, to: left_mouse_button_is_down, selector: 'unsubscribe-me'});
    } else if (sender === left_mouse_button_is_down) {
      let pointer_pos = send({to: pointer, selector: 'position'});
      let curr_pointer_pos = send({to: pointer_pos, selector: 'poll'});

      if (current_tool === 'move') {
        if (to === true) { // Had to push handle point behind rect to make this work...
          root_change(recv.handle.position, curr_pointer_pos);
          send({from: recv.handle.position, to: pointer_pos, selector: 'subscribe-me'});
          send({to: recv.mode, selector: 'changed'}, {to: 'rigid'});
        } else {
          send({from: recv.handle.position, to: pointer_pos, selector: 'unsubscribe-me'});
          send({to: recv.mode, selector: 'changed'}, {to: 'boxy'});
        }
      } else if (current_tool === 'draw') {
        svg_parent = recv.svg.group; // NB: copied. TODO: background --> rect.
        let rect = create.rect();
        root_change(rect.top_left.position, curr_pointer_pos);
        send({from: rect.bot_right.position, to: pointer_pos, selector: 'subscribe-me'});
      }
    }
  }
};
create.rect = () => create.entity(behaviors.rect);

pointer = create.entity(behaviors.pointer);

current_tool = 'draw';

/*
 *  *** "DEVICE DRIVERS" FOR BINARY-STATE INPUT, POSITIONAL INPUT ***
 */

svg = svgel('svg');
svg.style.border = '2px dashed red';
svg_parent = svg;

left_mouse_button_is_down = create.observable();

// Forget about coords; they are not part of the left button, or the keyboard, or the power button...
svg.onmousedown = e =>
  root_change(left_mouse_button_is_down, true);

svg.onmouseup = e =>
  root_change(left_mouse_button_is_down, false);

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

 backg = create.entity(behaviors.background);

 resize = () => {
   let dims = {width: body.offsetWidth*0.99, height: body.offsetHeight*0.99};
   attr(svg, dims);
   send({to: backg.dims, selector: 'changed'}, {to: dims});
 };

window.onresize = resize;
resize()
