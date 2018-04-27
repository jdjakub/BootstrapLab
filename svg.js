document.documentElement.style.height = '99%';

body = document.body;
body.style.border = '2px dashed red';
body.style.margin = '0px';
body.style.minHeight = '100%';

attribs = (elem, attrs) => {
  for (let [k,v] of Object.entries(attrs)) {
    elem.setAttribute(k.replace('_','-'), v);
  }
};

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

svg = svgel('svg', body, {width: body.offsetWidth*.99, height: body.offsetHeight*.99})

// Objective: re-ify mouse and keyboard.
/*
svg.onmousedown = e => {
  if (e.button === 0) {
    // LMB state is now down
    // "LMB is down" is not "LMB is equal to down"
    // LMB and "down" are separate objects
    // Instead, "LMB is down" => "LMB current state = down"
    // Some way to translate name-queries to the JS object pointers
    send(substrate, 'change', left_mouse_button, {new_state: button_down})
  }
};

// Simulate:
// Independently evolving JS objects
// That can receive messages at any time
// Which can have whatever effect they want
*/

