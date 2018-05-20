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
  if (v !== undefined) {
    o[k] = v;
  }
  return old;
}

offset = e => [e.offsetX, e.offsetY]

add = (as,bs) => {
  return as.map((a,k) => a + bs[k]);
}

sub = (as,bs) => {
  return as.map((a,k) => a - bs[k]);
}

svg = svgel('svg', body, {width: body.offsetWidth*0.99, height: body.offsetHeight*0.99});
svg.style.border = '2px dashed red';

send = ({ to, selector }, context) => {
  return to.receive({ recv: to, selector }, context);
}

svg_userData = (elem, obj) => state(elem, 'userData', obj);

svg_userData(svg, {
  receive: ({ recv, selector }, context) => {
    if (selector === 'clicked') {
      // Create SVG circle and route keyboard input "to it"
      let e = context.dom_event;
      let circ = svgel('circle', svg, {r: 15, fill: 'red'});
      attribs(circ, {cx: e.offsetX, cy: e.offsetY});
      let obj = create_circle(circ);
      svg_userData(circ, obj);
      // Route keyboard input "to" the circle
      keyboard_focus = obj;
    } else throw "No comprende "+selector;
  }
});

create_circle = (c) => {
  return {
    svgel: c,
    receive: ({ recv, selector }, context) => {
      let e = context.dom_event;
      if (selector === 'clicked') {
        let circ = recv.svgel;
        // Implement the initial conditions of the difference equation
        // center @ t+1 - center @ t = pointer @ t+1 - pointer @ t
        center_0 = [+circ.getAttribute('cx'), +circ.getAttribute('cy')];
        pointer_0 = offset(e);
        // Enable the maintenance of this equality
        moving = circ;
        keyboard_focus = recv;
      } else if (selector === 'key-down') {
        if (recv.str === undefined) { // Lazy initialise text line on key input
          let [cx,cy] = [recv.svgel.getAttribute('cx'), recv.svgel.getAttribute('cy')];
          // Place text baseline and start point at circle center
          recv.str = svgel('text', svg, {x: cx, y: cy, font_size: 15, fill: 'black'});
        }
        if (e.key === 'Backspace') // Modify the SVG dumb-state
          recv.str.textContent = recv.str.textContent.slice(0,-1);
        else if (e.key === 'Enter') { // Use SVG dumb-state as JS source code
          eval(recv.str.textContent);
        } else if (e.key === 'v' && e.ctrlKey) { // Easy C+P, but no display newline
          recv.str.textContent = typeof(dump) === 'string' ? dump : "";
        } else if (e.key.length === 1) // Modify the SVG dumb-state
          recv.str.textContent += e.key;
      } else throw "No comprende "+selector;
    }
  };
};

svg.onmousedown = e => {
  // Two things have happened.
  // First, an external event has occurred.
  // Second, SVG has performed a spatial index and identified a shape at x,y.
  let obj = svg_userData(e.target);
  if (obj !== undefined) send({ to: obj, selector: 'clicked'}, {dom_event: e});
};

moving = undefined;
pointer_0 = undefined;
center_0 = undefined;
svg.onmousemove = e => {
   if (moving !== undefined) {
    let pointer_curr = offset(e);
    // Maintain center @ t+1 = center @ t + (pointer @ t+1 - pointer @ t)
    let pointer_delta = sub(pointer_curr, pointer_0);
    let center_curr = add(center_0, pointer_delta);
    // Update the SVG dumb-state
    moving.setAttribute('cx', center_curr[0]);
    moving.setAttribute('cy', center_curr[1]);
  }
};

svg.onmouseup = e => {
  // Halt maintenance of difference equation
  moving = undefined;
};

dump = "";
keyboard_focus = svg_userData(svg);

body.onkeydown = e => send({ to: keyboard_focus, selector: 'key-down' }, {dom_event: e});

