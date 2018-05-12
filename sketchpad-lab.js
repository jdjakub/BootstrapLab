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

svg.onmousedown = e => {
  // Two things have happened.
  // First, an external event has occurred.
  // Second, SVG has performed a spatial index and identified a shape at x,y.
  if (e.target === svg) {
    let circ = svgel('circle', svg, {r: 20, fill: 'red'});
    attribs(circ, {cx: e.offsetX, cy: e.offsetY});
  } else {
    let circ = e.target;
    center_0 = [+circ.getAttribute('cx'), +circ.getAttribute('cy')];
    pointer_0 = offset(e);
    moving = circ;
  }
};

moving = undefined;
pointer_0 = undefined;
center_0 = undefined;
svg.onmousemove = e => {
   if (moving !== undefined) {
    let pointer_curr = offset(e);
    let pointer_delta = sub(pointer_curr, pointer_0);
    let center_curr = add(center_0, pointer_delta);
    moving.setAttribute('cx', center_curr[0]);
    moving.setAttribute('cy', center_curr[1]);
  }
};

svg.onmouseup = e => {
  moving = undefined;
};

keyboard_focus = svg;

body.onkeydown = e => {

};

body.onkeyup = e => {

};

