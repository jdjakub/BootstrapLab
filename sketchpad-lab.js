document.documentElement.style.height = '99%';

body = document.body;
body.style.margin = '0px';
body.style.minHeight = '100%';

// e.g. attr(rect, {stroke_width: 5, stroke: 'red'})
//      attr(rect, 'stroke', 'red')
attr = (elem, key_or_dict, val_or_nothing) => {
  if (typeof(key_or_dict) === 'string') {
    let key = key_or_dict;
    let val = val_or_nothing;
    let old = elem.getAttribute(key);
    if (val !== undefined) elem.setAttribute(key, val);
    return old;
  } else {
    let dict = key_or_dict;
    for (let [k,v] of Object.entries(dict)) {
      let value = v;
      elem.setAttribute(k.replace('_','-'), value);
    }
  }
}

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

offset = e => [e.offsetX, e.offsetY]

add = (as,bs) => {
  return as.map((a,k) => a + bs[k]);
};

sub = (as,bs) => {
  return as.map((a,k) => a - bs[k]);
};

svg = svgel('svg', body);
svg.style.border = '2px dashed red';

backg = svgel('rect', svg, {x: 0, y: 0, fill: 'black'});

clear = () => {
  let ch = Array.from(svg.children);
  ch.forEach(c => { if (c !== backg) c.remove() });
}
                            
resize = () => {
  let dims = {width: body.offsetWidth*0.99, height: body.offsetHeight*0.99};
  attr(svg, dims);
  attr(backg, dims);  
};

resize();

window.onresize = resize;

send = ({ from, to, selector }, context) => {
  // Allow objects to receive messages however they wish
  // Treat absence of 'receive' as presence of 99%-case default
  let next_code_path = to.receive || defaults.dyn_double_dispatch;
  return next_code_path({ sender: from, recv: to, selector }, context || {});
};

defaults = {}

defaults.vtable = {
};

defaults.dyn_double_dispatch = ({ sender, recv, selector }, context) => {
  let vtables = recv.vtables.concat([ defaults.vtable ]);
  for (let selector_to_next_code_path_or_vtable of vtables) {
    let next_code_path_or_vtable = selector_to_next_code_path_or_vtable[selector];
    if (next_code_path_or_vtable === undefined) continue;
    else if (typeof(next_code_path_or_vtable) === 'function') {
      let next_code_path = next_code_path_or_vtable;
      return next_code_path({ sender, recv, selector }, context);
    } else { // Ugly repeti-ti-ti-titon, I know
      let sender_to_next_code_path = next_code_path_or_vtable;
      let next_code_path = sender_to_next_code_path.get(sender);
      if (next_code_path === undefined) continue;
      else return next_code_path({ sender, recv, selector }, context);
    }
  }
  
  throw [`${recv} does not understand ${selector}`, recv, selector, context];
};

svg_userData = (elem, obj) => state(elem, 'userData', obj);

svg_userData(backg, {
  // In JS, one cannot go INSIDE functions and make
  // piece-meal changes to their code.
  // The function is an atomic black-box.
  // Solution: at least break it up into separate functions, as is now the case.
  // Eventually, break up into atomic JS state operations:
  // STATE-COPY o1 [ k1 ] <-- o2 [ k2 ] where o1,k1,o2,k2 are names
  // METHOD INVOCATION: o.f(a1 ... aN)
  // (CONDITIONAL) SEQUENCE: to be decided, but seems to consist
  // of an extensional function to new instruction
  // e.g.      if (a < 0) goto L
  //      else if (a = 0) goto E
  //      else if (a > 0) goto G
  // is just an extensional function from the 3 possible values of sign(a):
  // let s = sign(a)
  // goto ( put s through the function:
  //       -1 |--> L
  //        0 |--> E
  //        1 |--> G )
  // We have gone from INFINITE SET (values of a)
  // to FINITE SET (values of sign(a))
  // to NEXT STATE-CHANGE (infinite set?)
  // In summary: EXPOSE THE SUBSTRATE, part of which is JS itself.
  vtables: [{
    ['created']: ({recv}) => {
      recv.being_considered = send({from: recv, to: pointer, selector: 'is-considering-me?'});
      send({from: recv, to: recv.being_considered, selector: 'subscribe-me'});
      
      // Initialise object's own specific 'changed' behaviour, which depends on 
      // the Observable it just created.
      // It is fascinating that this cannot be a shared implementation for all instances.
      // The previous, immutable if/else-based dispatch *polled* properties like being_considered
      // *on every message receipt*.
      // Here, I poll *once* at the creation of the object and assume recv.being_considered
      // and left_mouse_button_is_down will retain their identities throughout (it should, imo)
      // My first solution will be duplicated and ugly.
      
      // First: lazy init the Map.
      recv.vtables[0]['changed'] = recv.vtables[0]['changed'] || new Map();
      let m = recv.vtables[0]['changed'];
      // Next: add the entries.
      
      m.set(recv.being_considered, ({recv}, {to}) => {
        if (to === true) // PUSH...
          send({from: recv, to: left_mouse_button_is_down, selector: 'subscribe-me'});
        else // ... POP!
          send({from: recv, to: left_mouse_button_is_down, selector: 'unsubscribe-me'});
      });
      
      m.set(left_mouse_button_is_down, ({recv}, {to}) => {
        if (to === true) {
          // Create SVG circle and route keyboard input "to it"
          
          let pos = send({to: send({to: pointer, selector: 'position'}),
                          selector: 'poll'});
          let obj = create_circle(pos);
          
          // Route keyboard input "to" the circle
          send({to: send({to: keyboard, selector: 'focus'}), selector: 'changed'}, {to: obj});
        }
     });
    },
  }]
});

observable_vtable = {
  ['created']: ({recv}) => {
    recv.value = () => recv._value;
    recv.update = v => recv._value = v;
    recv._subs = new Set();
    recv.subscribers_copy = () => new Set(recv._subs);
    recv.add = sub => recv._subs.add(sub);
    recv.remove = sub => recv._subs.delete(sub);
  },
  ['changed']: ({recv}, {to}) => {
    let old_value = recv.value();
    let new_value = to;
    if (typeof(new_value) === 'function') new_value = new_value(old_value);
    recv.update(new_value);
    for (let s of recv.subscribers_copy()) {
      send({from: recv, to: s, selector: 'changed'}, {from: old_value, to: new_value});
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

create_observable = () => {
  let o = {
    vtables: [observable_vtable],
  };
  send({to: o, selector: 'created'});
  return o;
};


has_position_vtable = {
  ['created']: ({recv}) => {
    recv.position = create_observable();
  },
  ['position']: ({recv}) => recv.position,
};

circle_vtable = {
  ['created']: ({recv}, {center}) => {
    recv.circ = svgel('circle', svg, {r: 15, fill: 'red'});
    svg_userData(recv.circ, recv);
    recv.bbox = svgel('rect', svg, {fill_opacity: 0, stroke: '#42a1f4', stroke_opacity: 0});
    svg_userData(recv.bbox, recv);
    
    recv.vtables.push(has_position_vtable); // Hack in another vtable...
    has_position_vtable['created']({recv}); // Hack in its initialisation...
    
    recv.being_considered = send({from: recv, to: pointer, selector: 'is-considering-me?'});
    recv.is_focused = send({from: recv, to: keyboard, selector: 'am-I-focused?'});
    
    // "one of your pieces of knowledge regarding the universe has changed"
    // -- more specific than a fully general "message send", and repeated pattern
    // that I call the "observable"
    // MASSIVE duplication here and in boxed_text.
    recv.vtables[0]['changed'] = recv.vtables[0]['changed'] || new Map();
    let m = recv.vtables[0]['changed'];
    m.set(recv.position, ({recv}, {to}) => {
      let p = to;
      attr(recv.circ, {cx: p[0], cy: p[1]});
      let r = +attr(recv.circ, 'r');
      attr(recv.bbox, {x: p[0]-r, y: p[1]-r, width: 2*r, height: 2*r});
    });
    m.set(recv.being_considered, ({recv}, {to}) => { // Same as in boxed_text
      // Early bound one-element stack, lol
      if (to === true) { // PUSH...
        attr(recv.bbox, 'stroke-opacity', 1);
        send({from: recv, to: left_mouse_button_is_down, selector: 'subscribe-me'});
      } else { // ... POP!
        attr(recv.bbox, 'stroke-opacity', 0);
        send({from: recv, to: left_mouse_button_is_down, selector: 'unsubscribe-me'});
      }
    });
    m.set(left_mouse_button_is_down, ({recv}, {to}) => { // Same as in boxed_text
      if (to === true) {
        send({from: recv.position,
              to: send({from: recv, to: pointer, selector: 'position'}),
              selector: 'subscribe-me'});
        send({to: send({to: keyboard, selector: 'focus'}), selector: 'changed'}, {to: recv});
      } else {
        send({from: recv.position,
              to: send({from: recv, to: pointer, selector: 'position'}),
              selector: 'unsubscribe-me'});
      }
    });
    m.set(recv.is_focused, ({recv}, {to}) => { // Same as in boxed_text
      if (to === true) {
        send({from: recv, to: send({to: keyboard, selector: 'text-input'}),
              selector: 'subscribe-me'});
      } else {
        send({from: recv, to: send({to: keyboard, selector: 'text-input'}),
              selector: 'unsubscribe-me'});
      }
    });
    m.set(send({to: keyboard, selector: 'text-input'}), ({recv}) => {
      if (recv.str === undefined) { // Lazy initialise text line on key input
        let [cx,cy] = [attr(recv.circ, 'cx'), attr(recv.circ, 'cy')];
        // Place text baseline and start point at circle center
        recv.str = create_boxed_text({ creator: recv });
        send({ to: send({to: recv.str, selector: 'position'}),
               selector: 'changed' }, {to: [cx,cy]});
        send({ to: recv.str, selector: 'string-content' }, {string: "Lorem Ipsum"});
      }
    });
    
    send({from: recv, to: recv.position, selector: 'subscribe-me'});
    send({from: recv, to: recv.being_considered, selector: 'subscribe-me'});
    send({from: recv, to: recv.is_focused, selector: 'subscribe-me'});
    
    send({from: recv, to: recv.position, selector: 'changed'}, {to: center});
  },
};

create_circle = (c) => {
  let o = {
    vtables: [circle_vtable]
  };
  send({ to: o, selector: 'created' }, { center: c });
  return o;
};

dump = "";

boxed_text_vtable = {
  ['created']: ({recv}, {creator}) => {
    recv.text = svgel('text', svg, {font_size: 20, fill: 'white'});
    recv.bbox = svgel('rect', svg, {fill_opacity: 0, stroke: '#42a1f4', stroke_opacity: 0});
    svg_userData(recv.text, recv);
    svg_userData(recv.bbox, recv);
    
    recv.vtables.push(has_position_vtable); // Hack in another vtable...
    has_position_vtable['created']({recv}); // Hack in its initialisation...
    
    let pos = send({from: recv, to: recv, selector: 'position'});
    send({from: recv, to: pos, selector: 'subscribe-me'});
    send({to: pos, selector: 'changed'}, {to: [500,500]});
    
    recv.being_considered = send({from: recv, to: pointer, selector: 'is-considering-me?'});
    send({from: recv, to: recv.being_considered, selector: 'subscribe-me'});
    
    recv.is_focused = send({from: recv, to: keyboard, selector: 'am-I-focused?'});
    send({from: recv, to: recv.is_focused, selector: 'subscribe-me'});
    
    recv.creator = creator;
  },
  ['changed']: ({sender, recv}, context) => {
    // Further dispatch occurring here, on sender
    if (sender === recv.position) {
      let [x,y] = context.to;
      attr(recv.text, {x, y});
      send({ to: recv, selector: 'update-box' });
    } else if (sender === recv.being_considered) { // Same as in circle
      // Early bound one-element stack, lol
      if (context.to === true) { // PUSH...
        attr(recv.bbox, 'stroke-opacity', 1);
        send({from: recv, to: left_mouse_button_is_down, selector: 'subscribe-me'});
      } else { // ... POP!
        attr(recv.bbox, 'stroke-opacity', 0);
        send({from: recv, to: left_mouse_button_is_down, selector: 'unsubscribe-me'});
      }
      
    } else if (sender === left_mouse_button_is_down) { // Same as in circle
      if (context.to === true) {
        send({from: recv.position,
              to: send({from: recv, to: pointer, selector: 'position'}),
              selector: 'subscribe-me'});
        send({to: send({to: keyboard, selector: 'focus'}), selector: 'changed'}, {to: recv});
      } else {
        send({from: recv.position,
              to: send({from: recv, to: pointer, selector: 'position'}),
              selector: 'unsubscribe-me'});
      }
    } else if (sender === recv.is_focused) { // Same as in circle
      if (context.to === true) {
        send({from: recv, to: send({to: keyboard, selector: 'text-input'}),
              selector: 'subscribe-me'});
      } else {
        send({from: recv, to: send({to: keyboard, selector: 'text-input'}),
              selector: 'unsubscribe-me'});
      }
    } else if (sender === send({to: keyboard, selector: 'text-input'})) {
      let e = {key: context.to};
      if (e.key === 'Backspace')
        send({ to: recv, selector: 'string-content' }, {string: s => s.slice(0,-1)});
      else if (e.key === 'Enter') {
        if (send({to: send({to: keyboard, selector: 'key-is-pressed'}, {name: 'Control'}),
                  selector: 'poll'}) === true) {
          let code = send({to: recv, selector: 'to-strings'});
          window.recv = recv;
            eval(code.join('\n'));
          window.recv = undefined;
        } else {
          send({to: send({to: keyboard, selector: 'focus'}), selector: 'changed'},
               { to: send({to: recv, selector: 'next-line'}) });
        }
      } else if (e.key === 'v' &&
            send({to: send({to: keyboard, selector: 'key-is-pressed'}, {name: 'Control'}),
                  selector: 'poll'}) === true) { // Easy C+P
        let str = typeof(dump) === 'string' ? dump : "";
        send({to: recv, selector: 'from-strings'}, {string: str});
      } else if (e.key.length === 1)
        send({ to: recv, selector: 'string-content' }, {string: s => s + e.key});
    }
  },
  ['string-content']: ({recv}, {string}) => {
    let str = string;
    if (typeof(str) === 'undefined') str = recv.text.textContent;
    if (typeof(str) === 'function') str = str(recv.text.textContent);
    recv.text.textContent = str;
    send({ to: recv, selector: 'update-box' });
    return str;
  },
  ['update-box']: ({recv}) => {
    let bbox = recv.text.getBBox();
    attr(recv.bbox, {x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height});
  },
  ['next-line']: ({recv}) => {
    if (recv.next_line === undefined) {
      let new_line = create_boxed_text({ creator: recv });
      let my_coords = [+attr(recv.text, 'x'), +attr(recv.text, 'y')];
      let my_height = +attr(recv.text, 'font-size');
      send({from: recv, to: new_line.position, selector: 'changed'},
           {to: add(my_coords, [0, my_height*1.3])});
      recv.next_line = new_line;
    }
    return recv.next_line;
  },
  ['from-strings']: ({recv},ctx) => {
    let strs = ctx.strings || ctx.string.split('\n');
    let line = recv;
    while (strs.length > 0) {
      let str = strs.shift();
      send({to: line, selector: 'string-content'}, {string: str});
      line = send({to: line, selector: 'next-line'});
    }
  },
  ['to-strings']: ({recv}) => {
    let strs = [];
    let line = recv;
    while (line !== undefined) {
      let str = send({ to: line, selector: 'string-content' });
      strs.push(str);
      line = line.next_line;
    }
    return strs;
  },
};

create_boxed_text = (ctx) => {
  let o = {
    vtables: [boxed_text_vtable]
  };
  send({ to: o, selector: 'created' }, ctx);
  return o;
}

/*
 *  *** "DEVICE DRIVERS" FOR BINARY-STATE INPUT ***
 */

left_mouse_button_is_down = create_observable();

// Forget about coords; they are not part of the left button, or the keyboard, or the power button...
svg.onmousedown = e =>
  send({to: left_mouse_button_is_down, selector: 'changed'}, {to: true});

svg.onmouseup = e =>
  send({to: left_mouse_button_is_down, selector: 'changed'}, {to: false});

keyboard = {
  vtables: [{
    ['created']: ({recv}) => {
      recv.focus = create_observable();
      send({from: recv, to: recv.focus, selector: 'subscribe-me'});
      
      // Should this be here? idk. Tbh, is a layer on top of the keyboard...
      recv.text_input = create_observable();
      
      // Another premature compression (optimisation) of keys-as-observables
      // ... if I can admit that it is premature, why can I not resist??
      // probably because I want to experiment.
      recv.keys_to_subs = new Map();
      
      // Compressed map key -> boolean
      // Not pressed? Not stored! (Huffman coding, right?)
      recv.pressed_keys = new Set(); 
      
      recv.are_they_focused = new Map();
    },
    ['focus']: ({recv}) => recv.focus,
    ['text-input']: ({recv}) => recv.text_input,
    ['key-is-pressed']: ({recv}, {name}) => {
      // At least here we see the benefit of permitting per-object receive() impls
      return {
        receive: (routing, context) => {
          routing.to = name;
          return send({to: recv, selector: 'key-msg'}, {routing, context});
        }
      };
    },
    ['key-msg']: ({recv}, {routing, context}) => {
      let [sender, key, selector] = [routing.from, routing.to, routing.selector];
      // Here we go, "oven-baked dispatch" once again
      if (selector === 'subscribe-me') {
        let subs = recv.keys_to_subs.get(key);
        if (subs === undefined) {
          subs = new Set(); // Because who doesn't enjoy reinventing multisets
          recv.keys_to_subs.set(key, subs);
        }
        subs.add(sender);
      } else if (selector === 'unsubscribe-me') {
        let subs = recv.keys_to_subs.get(key);
        if (subs !== undefined) {
          subs.delete(sender);
          if (subs.size === 0) recv.keys_to_subs.delete(key);
        }
      } else if (selector === 'poll') {
        return recv.pressed_keys.has(key);
      } else if (selector === 'changed') {
        // God, this is so complicated XD
        let subs = recv.keys_to_subs.get(key);
        if (subs !== undefined)
          for (let sub of new Set(subs))
            // Grrrr - not gonna work; new object !== old object >_<
            send({from: send({to: recv, selector: 'key-is-pressed'}, {name: key}),
                  to: sub, selector: 'changed'}, context);
                  
        if (context.to === true) {
          send({to: recv.text_input, selector: 'changed'}, {to: key});
          recv.pressed_keys.add(key);
        } else {
          recv.pressed_keys.delete(key);
        }
      }
    },
    ['am-I-focused?']: ({sender, recv}) => {
      let obs = recv.are_they_focused.get(sender);
      if (obs === undefined) {
        obs = create_observable();
        recv.are_they_focused.set(sender, obs);
      }
      return obs;
    },
    ['changed']: ({sender, recv}, {from, to}) => {
      if (sender === recv.focus) {
        let old = recv.are_they_focused.get(from);
        if (old !== undefined)
          send({to: old, selector: 'changed'}, {from: true, to: false});
        
        // srsly screw flat text  
        let ______________new________________ = recv.are_they_focused.get(to);
        if (______________new________________ !== undefined)
          send({to: ______________new________________, selector: 'changed'},
               {from: false, to: true});
      }
    },
  }],
};
send({to: keyboard, selector: 'created'});

body.onkeydown = e =>
  send({to: send({to: keyboard, selector: 'key-is-pressed'}, {name: e.key}),
        selector: 'changed'}, {from: false, to: true});
        
body.onkeyup = e =>
  send({to: send({to: keyboard, selector: 'key-is-pressed'}, {name: e.key}),
        selector: 'changed'}, {from: true, to: false});

/*
 *  *** "DEVICE DRIVER" FOR POSITIONAL INPUT ***
 */

// Simulated presence of the human finger (or gaze).
pointer = {
  vtables: [{},{
    ['created']: ({recv}) => {
      recv.vtables.push(has_position_vtable); // Hack in another vtable...
      has_position_vtable['created']({recv}); // Hack in its initialisation...
      
      let pos = send({to: recv, selector: 'position'});
      send({from: recv, to: pos, selector: 'subscribe-me'});
      
      recv.currently_considering = create_observable();
      send({from: recv, to: recv.currently_considering, selector: 'subscribe-me'});
      
      recv.consider_proxy = {
        subs: new Set(),
        vtables: [{
          ['subscribe-me']: ({sender, recv}) => recv.subs.add(sender),
          ['unsubsribe-me']: ({sender, recv}) => recv.subs.delete(sender),
        }],
      };
    },
    ['is-considering-me?']: ({sender, recv}) => {
      // Because I know that only one object can be "considered" i.e. pointed to
      // at once, I can optimise by presenting the same observable to all who ask
      // for their specific "is considering me?" observable, transparently.
      // EDIT: not so transparent. X cannot subscribe to whether Y is being considered,
      // and if it tries then X will end up subscribed to its OWN 'considered' observable...
      // TODO: un-optimise. It was premature to begin with. lol
      // Also: the computer should be able to accept new facts like "only one object
      // will be considered at once" and AUTOMATICALLY optimise...
      // ... and un-optimise when the fact is withdrawn.
      // It's all Knowledge Rep, people!
      // Type systems are logical systems!
      // Logical systems are reasoning and inference systems!
      // Reasoning and inference is intelligence!
      // If we get sick of routine tasks, we make them automated!
      // For intelligence this is known as ***A.I***!
      return recv.consider_proxy;
    },
    ['is-considering']: ({recv}) => recv.currently_considering,
    ['changed']: ({sender, recv}, context) => {
      if (sender === recv.currently_considering) {
        let c = recv.consider_proxy; // To whom they will be subscribed
        let old = context.from;
        if (recv.consider_proxy.subs.has(old)) {
          // simulate / spoof message on behalf of the observable
          send({from: c, to: old, selector: 'changed'},
               {to: false}); // "no longer considering you"
        }
        
        let target = context.to;
        if (recv.consider_proxy.subs.has(target)) {
          // spoof "now, the belief 'I am considering you' is true"
          send({from: c, to: target, selector: 'changed'}, {to: true});
        }
      }
    }
  }]
};
send({to: pointer, selector: 'created'});

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
 
send({to: svg_userData(backg), selector: 'created'});
