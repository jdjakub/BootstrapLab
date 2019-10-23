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

// e.g. rect = svgel('rect', svg, {x: 5, y: 5, width: 5, height: 5})
svgel = (tag, parent, attrs) => {
  let elem = document.createElementNS("http://www.w3.org/2000/svg", tag);
  if (attrs !== undefined) attr(elem, attrs);
  if (parent !== undefined)
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
translate = (x,y) => `translate(${x},${y})`;

send = ({ from, to, selector }, context) => {
  // Allow objects to receive messages however they wish
  // Treat absence of 'receive' as presence of 99%-case default
  let next_code_path = to.receive || defaults.dyn_double_dispatch;
  return next_code_path({ sender: from, recv: to, selector }, context || {});
};

defaults = { behavior: {} };

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
  // I can be told that I changed to a new value, optionally including the old.
  // If a function is specified as a new value, I treat this as a way to
  // compute the new value from the old.
  ['changed']: ({recv}, {from, to}) => {
    let old_value = from;
    let new_value = to;
    if (old_value === undefined) old_value = recv.value(); // default to stored value
    if (typeof(new_value) === 'function') new_value = new_value(old_value);
    if (new_value !== old_value) {
      recv.update(new_value); // if there is a difference, update self and dependents
      for (let s of recv.subs_copy()) {
        // notify each dependent that I changed, but use a copy of the list, so that
        // anyone who wishes to un-subscribe in response, can do so safely
        send({from: recv, to: s, selector: 'changed'}, {from: old_value, to: new_value});
      }
    }
  },
  ['poll']: ({recv}) => recv.value(), // returns mutable original...!
  // Feels like setting and un-setting an "is-subscribed" observable...
  ['subscribe-me']: ({sender, recv}) => {
    recv.add(sender);
  },
  ['unsubscribe-me']: ({sender, recv}) => {
    recv.remove(sender);
  },
};

create.observable = () => create.entity(behaviors.observable);

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
   recv.rect = svgel('rect', svg, {x: 0, y: 0, fill: 'black'});
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
       let pos = send({to: send({to: pointer, selector: 'position'}),
                       selector: 'poll'});
       console.log("LMB down: ", pos);
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

pointer = create.entity(behaviors.pointer);

/*
 *  *** "DEVICE DRIVERS" FOR BINARY-STATE INPUT, POSITIONAL INPUT ***
 */

 svg = svgel('svg', body);
 svg.style.border = '2px dashed red';

left_mouse_button_is_down = create.observable();

// Forget about coords; they are not part of the left button, or the keyboard, or the power button...
svg.onmousedown = e =>
  send({to: left_mouse_button_is_down, selector: 'changed'}, {to: true});

svg.onmouseup = e =>
  send({to: left_mouse_button_is_down, selector: 'changed'}, {to: false});

// mousemove => pointer position changed
svg.onmousemove = e =>
  send({to: send({to: pointer, selector: 'position'}),
        selector: 'changed'}, {to: offset(e)});

// mouseover => considering a new object
svg.onmouseover = e => {
  let obj = svg_userData(e.target);
  if (obj !== undefined)
    send({ to: send({to: pointer, selector: 'is-considering'}),
           selector: 'changed' }, { to: obj });
};

// mouseout => no longer considering the object
svg.onmouseout = e => {
  let obj = svg_userData(e.target);
  if (obj !== undefined)
    send({ to: send({to: pointer, selector: 'is-considering'}),
       selector: 'changed' }, { to: undefined });
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
