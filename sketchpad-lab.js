document.documentElement.style.height = '99%';

body = document.body;
body.style.margin = '0px';
body.style.minHeight = '100%';

// e.g. attribs(rect, {stroke_width: 5, stroke: 'red'})
attribs = (elem, attrs) => {
  for (let [k,v] of Object.entries(attrs)) {
    let value = v;
    elem.setAttribute(k.replace('_','-'), value);
  }
};

// e.g. rect = svgel('rect', svg, {x: 5, y: 5, width: 5, height: 5})
svgel = (tag, parent, attrs) => {
  let elem = document.createElementNS("http://www.w3.org/2000/svg", tag);
  if (attrs !== undefined) attribs(elem, attrs);
  if (parent !== undefined)
    parent.appendChild(elem);
  return elem;
};

state = function(o, k, v) {
  let old = o[k];
  if (v !== undefined) o[k] = v;
  return old;
}

attr = (elem, key, val) => {
  let old = elem.getAttribute(key);
  if (val !== undefined) elem.setAttribute(key, val);
  return old;
}

svg = svgel('svg', body, {width: body.offsetWidth*0.99, height: body.offsetHeight*0.99});
svg.style.border = '2px dashed red';

backg = svgel('rect', svg, {x: 0, y: 0,
                            width: attr(svg, 'width'),
                            height: attr(svg, 'height'),
                            fill: 'black'});

send = ({ to, selector }, context) => {
  let next_code_path = to.receive || default_dyn_single_dispatch;
  return next_code_path({ recv: to, selector }, context || {});
};

default_dyn_single_dispatch = ({ recv, selector }, context) => {
  let selector_to_next_code_path = recv.vtable || default_vtable;
  let next_code_path = selector_to_next_code_path[selector];
  if (next_code_path === undefined) throw "No comprende "+selector;
  
  return next_code_path({ recv, selector }, context);
};

svg_userData = (elem, obj) => state(elem, 'userData', obj);

offset = e => [e.offsetX, e.offsetY]

add = (as,bs) => {
  return as.map((a,k) => a + bs[k]);
};

sub = (as,bs) => {
  return as.map((a,k) => a - bs[k]);
};

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
  vtable: {
    ['clicked']: ({recv}, {dom_event}) => {
      // Create SVG circle and route keyboard input "to it"
      let e = dom_event;
      let circ = svgel('circle', svg, {r: 15, fill: 'red'});
      attribs(circ, {cx: e.offsetX, cy: e.offsetY});
      let obj = create_circle(circ);
      svg_userData(circ, obj);
      // Route keyboard input "to" the circle
      keyboard_focus = obj;
    },
    ['being-considered']: () => {},
  }
});

create_circle = (c) => {
  return {
    svgel: c,
    vtable: {
      ['clicked']: ({recv}) => {
        send({ to: recv, selector: 'start-moving' });
      },
      ['start-moving']: ({recv}) => {
        let circ = recv.svgel;
        // Implement the initial conditions of the difference equation
        // center @ t+1 - center @ t = pointer @ t+1 - pointer @ t
        recv.center_0 = [+attr(circ, 'cx'), +attr(circ, 'cy')];
        // Enable the maintenance of this equality
        moving = recv;
        keyboard_focus = recv;
      },
      ['being-moved']: ({recv}, {vector}) => {
        let circ = recv.svgel;
        // Maintain center @ t+1 = center @ t + (pointer @ t+1 - pointer @ t)
        let center_curr = add(recv.center_0, vector);
        // Update the SVG dumb-state
        attr(circ, 'cx', center_curr[0]);
        attr(circ, 'cy', center_curr[1]);
      },
      ['finish-moving']: ({recv}) => {
        // Halt maintenance of difference equation
        moving = undefined;
        recv.center_0 = undefined;
      },
      ['key-down']: ({recv}, {dom_event}) => {
        let e = dom_event;
        if (recv.str === undefined) { // Lazy initialise text line on key input
          let [cx,cy] = [attr(recv.svgel, 'cx'), attr(recv.svgel, 'cy')];
          // Place text baseline and start point at circle center
          recv.str = create_boxed_text();
          send({ to: recv.str, selector: 'set-baseline-start' }, {coords: [cx,cy]});
        }
        if (e.key === 'Backspace')
          send({ to: recv.str, selector: 'string-content' }, {string: s => s.slice(0,-1)});
        else if (e.key === 'Enter') {
          eval(send({ to: recv.str, selector: 'string-content' }));
        } else if (e.key === 'v' && e.ctrlKey) { // Easy C+P, but no display newline
          send({ to: recv.str, selector: 'string-content' }, {
            string: typeof(dump) === 'string' ? dump : ""
          });
        } else if (e.key.length === 1)
          send({ to: recv.str, selector: 'string-content' }, {string: s => s + e.key});
      },
      ['being-considered']: ({recv}, {truth}) => {
          // Early-bound one-element stack, lol
          if (truth === true) { // PUSH...
            recv.old_opacity = attr(recv.svgel, 'fill-opacity');
            attr(recv.svgel, 'fill-opacity', 0.5);
          } else { // ... POP!
            attr(recv.svgel, 'fill-opacity', recv.old_opacity);
          }
      },
    }
  };
};

create_boxed_text = () => {
  let o = {
    vtable: {
      ['created']: ({recv}) => {
        recv.text = svgel('text', svg, {x: 500, y: 500, font_size: 17, fill: 'white'});
        recv.rect = svgel('rect', svg, {fill_opacity: 0, stroke: 'gray'});
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
        attribs(recv.rect, {x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height});
      },
      ['set-baseline-start']: ({recv}, {coords}) => {
        let [x,y] = coords;
        attribs(recv.text, {x, y});
        send({ to: recv, selector: 'update-box' });
      }
    }
  };
  send({ to: o, selector: 'created' });
  return o;
}

create_signal = () => {
  let o = {
    vtable: {
      ['created']: ({recv}) => {
      },
      ['current-value']: ({recv}, {set_to}) => {
        let v = set_to;
        if (typeof(v) === 'function') v = v(recv.value);
        // changed from recv.value to v 
        recv.value = v;
        return v;
      },
    },
  };
  send({ to: o, selector: 'created' });
  return o;
};

svg.onmousedown = e => {
  // Two things have happened.
  // First, an external event has occurred.
  // Second, SVG has performed a spatial index and identified a shape at x,y.
  pointer_0 = offset(e);
  let obj = svg_userData(e.target);
  if (obj !== undefined) send({ to: obj, selector: 'clicked'}, {dom_event: e});
};

moving = undefined;
pointer_0 = undefined;
svg.onmousemove = e => {
   if (moving !== undefined) {
    let pointer_curr = offset(e);
    let pointer_delta = sub(pointer_curr, pointer_0);
    send({ to: moving, selector: 'being-moved' }, { vector: pointer_delta });
  }
};

svg.onmouseup = e => {
  let obj = svg_userData(e.target);
  if (obj !== undefined) send({ to: obj, selector: 'finish-moving'}, {truth: true, dom_event: e});
};

dump = "";
keyboard_focus = svg_userData(svg);

body.onkeydown = e => send({ to: keyboard_focus, selector: 'key-down' }, {dom_event: e});

svg.onmouseover = e => {
  let obj = svg_userData(e.target);
  if (obj !== undefined) send({ to: obj, selector: 'being-considered'}, {truth: true, dom_event: e});
};

svg.onmouseout = e => {
  let obj = svg_userData(e.target);
  if (obj !== undefined) send({ to: obj, selector: 'being-considered'}, {truth: false, dom_event: e});
};
