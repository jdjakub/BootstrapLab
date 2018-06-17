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
  let next_code_path = to.receive || defaults.dyn_single_dispatch;
  return next_code_path({ sender: from, recv: to, selector }, context || {});
};

defaults = {}

defaults.vtable = {
  ['clicked']: () => {},
  ['un-clicked']: () => {},
};

defaults.dyn_single_dispatch = ({ sender, recv, selector }, context) => {
  let vtables = recv.vtables.concat([ defaults.vtable ]);
  for (let selector_to_next_code_path of vtables) {
    let next_code_path = selector_to_next_code_path[selector];
    if (next_code_path !== undefined)
      return next_code_path({ sender, recv, selector }, context);
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
    ['clicked']: ({recv}, {dom_event}) => {
      // Create SVG circle and route keyboard input "to it"
      let e = dom_event;
      let obj = create_circle(offset(e));
      
      // Route keyboard input "to" the circle
      keyboard_focus = obj;
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
  ['clicked']: ({sender, recv}) => {
    keyboard_focus = recv;
    moving = recv;
    send({from: recv.position,
          to: send({from: recv, to: sender, selector: 'position'}),
          selector: 'subscribe-me'});
  },
  ['un-clicked']: ({sender, recv}) => {
    moving = undefined;
    send({from: recv.position,
          to: send({from: recv, to: sender, selector: 'position'}),
          selector: 'unsubscribe-me'});
  },
};

circle_vtable = {
  ['created']: ({recv}, {center}) => {
    recv.circ = svgel('circle', svg, {r: 15, fill: 'red'});
    svg_userData(recv.circ, recv);
    recv.bbox = svgel('rect', svg, {fill_opacity: 0, stroke: '#42a1f4', stroke_opacity: 0});
    svg_userData(recv.bbox, recv);
    
    recv.vtables.push(has_position_vtable); // Hack in another vtable...
    has_position_vtable['created']({recv}); // Hack in its initialisation...
    
    let pos = send({from: recv, to: recv, selector: 'position'});
    send({from: recv, to: pos, selector: 'subscribe-me'});
    send({from: recv, to: pos, selector: 'changed'}, {to: center});
    
    recv.being_considered = send({from: recv, to: pointer, selector: 'is-considering-me?'});
    send({from: recv, to: recv.being_considered, selector: 'subscribe-me'});
  },
  // "one of your pieces of knowledge regarding the universe has changed"
  // -- more specific than a fully general "message send", and repeated pattern
  // that I call the "observable"
  ['changed']: ({recv,sender}, context) => {
    // Further dispatch occurring here, on sender
    if (sender === recv.position) {
      let p = context.to;
      attr(recv.circ, {cx: p[0], cy: p[1]});
      let r = +attr(recv.circ, 'r');
      attr(recv.bbox, {x: p[0]-r, y: p[1]-r, width: 2*r, height: 2*r});
    } else if (sender === recv.being_considered) {
      // Early bound one-element stack, lol
      if (context.to === true) { // PUSH...
        attr(recv.bbox, 'stroke-opacity', 1);
      } else { // ... POP!
        attr(recv.bbox, 'stroke-opacity', 0);
      }
    }
  },
  ['key-down']: ({recv}) => {
    if (recv.str === undefined) { // Lazy initialise text line on key input
      let [cx,cy] = [attr(recv.circ, 'cx'), attr(recv.circ, 'cy')];
      // Place text baseline and start point at circle center
      recv.str = create_boxed_text({ creator: recv });
      send({ to: send({to: recv.str, selector: 'position'}),
             selector: 'changed' }, {to: [cx,cy]});
      send({ to: recv.str, selector: 'string-content' }, {string: "Lorem Ipsum"});
    }
  },
};

create_circle = (c) => {
  let o = {
    vtables: [circle_vtable]
  };
  send({ to: o, selector: 'created' }, { center: c });
  return o;
};

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
    
    recv.creator = creator;
  },
  ['changed']: ({sender, recv}, context) => {
    // Further dispatch occurring here, on sender
    if (sender === recv.position) {
      let [x,y] = context.to;
      attr(recv.text, {x, y});
      send({ to: recv, selector: 'update-box' });
    } else if (sender === recv.being_considered) { // Same as in circle...
      // Early bound one-element stack, lol
      if (context.to === true) { // PUSH...
        attr(recv.bbox, 'stroke-opacity', 1);
      } else { // ... POP!
        attr(recv.bbox, 'stroke-opacity', 0);
      }
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
  ['key-down']: ({recv}, {dom_event}) => {
    let e = dom_event;
    if (e.key === 'Backspace')
      send({ to: recv, selector: 'string-content' }, {string: s => s.slice(0,-1)});
    else if (e.key === 'Enter') {
      if (e.ctrlKey) {
        let code = send({to: recv, selector: 'to-strings'});
        window.recv = recv;
          eval(code.join('\n'));
        window.recv = undefined;
      } else {
        keyboard_focus = send({to: recv, selector: 'next-line'});
      }
    } else if (e.key === 'v' && e.ctrlKey) { // Easy C+P
      let str = typeof(dump) === 'string' ? dump : "";
      send({to: recv, selector: 'from-strings'}, {string: str});
    } else if (e.key.length === 1)
      send({ to: recv, selector: 'string-content' }, {string: s => s + e.key});
  },
};

create_boxed_text = (ctx) => {
  let o = {
    vtables: [boxed_text_vtable]
  };
  send({ to: o, selector: 'created' }, ctx);
  return o;
}

// Extension of the human hand into the simulated world.
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

moving = undefined;
svg.onmousemove = e =>
  send({to: send({to: pointer, selector: 'position'}),
        selector: 'changed'}, {to: offset(e)});

svg.onmouseover = e => {
  let obj = svg_userData(e.target);
  if (obj !== undefined)
    send({ to: send({to: pointer, selector: 'is-considering'}),
           selector: 'changed' }, { to: obj });
};

svg.onmouseout = e => {
  let obj = svg_userData(e.target);
  if (obj !== undefined)
    send({ to: send({to: pointer, selector: 'is-considering'}),
       selector: 'changed' }, { to: undefined });
};

svg.onmousedown = e => {
  // Two things have happened.
  // First, an external event has occurred.
  // Second, SVG has performed a spatial index and identified a shape at x,y.
  let obj = svg_userData(e.target);
  if (obj !== undefined) send({from: pointer, to: obj, selector: 'clicked'}, {dom_event: e});
};

svg.onmouseup = e => {
  let obj = svg_userData(e.target);
  if (obj !== undefined) send({from: pointer, to: obj, selector: 'un-clicked'}, {dom_event: e});
};

dump = "";
keyboard_focus = svg_userData(svg);

body.onkeydown = e => {
  if (keyboard_focus !== undefined)
    send({ to: keyboard_focus, selector: 'key-down' }, {dom_event: e});
};
