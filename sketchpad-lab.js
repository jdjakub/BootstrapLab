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

svg = svgel('svg', body, {width: body.offsetWidth*0.99, height: body.offsetHeight*0.99});
svg.style.border = '2px dashed red';

// Variable: smallest unit of change.
// Observer pattern. Holds a registry of "dependents", i.e. subscribers.
// An object o subscribes to variable v under name(s) k. (k need not be a string.)
// When v changes, it calls o.changed(k, v) for each name k
// E.g. radius_variable.subscribe(circle, 'r')
// Calls circle.changed('r', radius_variable) when changed.
class Variable {
  constructor() {
    this.targets = new Set();
    this.sources = new Set();
  }
  
  subscribe(obj, id) {
    this.targets.add(obj);
    obj.subscribed_to(this, id); // Confirm
    obj.changed(this); // Provide initial value
    return this;
  }
  
  unsubscribe(obj) {
    this.targets.delete(obj);
    obj.unsubscribed_from(this);
    return this;
  }

  change(...args) {
    this.change_self(...args);
    for (let t of this.targets)
        t.changed(this);
  }

  // Override to do something other than update value...?
  change_self(value) {
    this._value = value;
  }
  
  value() {
    return this._value;
  }
  
  // allow a Variable to be a dependent
  subscribed_to(v) {
    this.sources.add(v);
  }
  
  unsubscribed_from(v) {
    this.sources.delete(v);
  }
  
  changed(v) {
    this.change(v.value());
  }
}

class VarList extends Variable {
  constructor(...vars) {
    super();
    this.vars = vars;
  }
  
  change_self(values) {
    for (let i=0; i<this.vars.length; i++) {
      this.vars[i].change(values[i])
    }
  }
  
  value() {
    return this.vars.map(v => v.value())
  }
}

//DOM node objects should be called DUMB node objects.
// Their attributes must be reified into Variables:
class SvgElement {
  constructor(type, parent) {
    this.svgel = svgel(type, parent);
    this.svgel.userData = this;
    this.var_to_attr_map = new Map();
    this.attr_to_var_map = new Map();
  }
  
  attr(k) {
    let v = this.attr_to_var_map.get(k);
    // Lazy initialise
    if (v === undefined) {
      v = new Variable();
      v.subscribe(this, k);
    }
    return v;
  }
  
  _key_of(v) {
    return this.var_to_attr_map.get(v);
  }
  
  subscribed_to(v, key) {
    if (this.var_to_attr_map.has(v))
      throw "Multiple subscription to attr "+key;
    this.var_to_attr_map.set(v, key);
    this.attr_to_var_map.set(key, v);
  }
  
  unsubscribed_from(v) {
    let k = this._key_of(v);
    this.var_to_attr_map.delete(v);
    this.attr_to_var_map.delete(k);
  }
  
  changed(v) {
    let val = v.value();
    let key = this._key_of(v);
    if (val !== undefined && key !== undefined)
        attribs(this.svgel, {[key]: val});
  }
}

class SvgCircle extends SvgElement {
  constructor() {
    super('circle', svg);
    this.center = new VarList(this.attr('cx'), this.attr('cy'));
    this.radius = this.attr('r');
  }
}

class SvgLine extends SvgElement {
  constructor() {
    super('line', svg);
    this.start = new VarList(this.attr('x1'), this.attr('y1'));
    this.end = new VarList(this.attr('x2'), this.attr('y2'));
  }
}

pointer = new VarList(new Variable(), new Variable());

svg.onmousemove = e => {
  let coords = [e.offsetX, e.offsetY];
  pointer.change(coords);
};

new_node = () => {
  let c = new SvgCircle();
  c.radius.change(15);
  c.attr('stroke').change('black');
  c.attr('fill').change('white');
  return c;
};

new_edge = (start, end) => {
  let l = new SvgLine();
  l.svgel.style.pointerEvents = 'none';
  l.attr('stroke-width').change(2);
  l.attr('stroke').change('black');
  start.center.subscribe(l.start);
  end.center.subscribe(l.end);
  return l;
}

svg_pick_up = (elem) => {
  elem.svgel.style.pointerEvents = 'none';
  pointer.subscribe(elem.center);
};

svg_drop = (elem) => {
  elem.svgel.style.pointerEvents = 'all';
  pointer.unsubscribe(elem.center);
};

tool = new Variable();
tool.subscribe({
  changed: v => console.log('Tool: '+v.value()),
  subscribed_to: v => v,
  unsubscribed_from: v => v
});
tool.change('draw');

edge_start = new_node();
svg_pick_up(edge_start);

current_edge = undefined;

body.onkeydown = e => {
  if (e.key === 'd') tool.change('draw');
  else if (e.key === 'm') tool.change('move');
  else if (e.key === 'x') tool.change('delete');
};

svg.onmouseover = e => {
  if (e.target !== svg)
    e.target.setAttribute('stroke', 'red');
}

svg.onmouseout = e => {
  if (e.target !== svg)
    e.target.setAttribute('stroke', 'black');
}

moving = undefined;
svg.onmousedown = e => {
  if (tool.value() === 'draw') {
    if (e.target.tagName === 'circle') {
      edge_end = edge_start;
      edge_start = e.target.userData;
    } else {
      svg_drop(edge_start);
      edge_end = new_node();
      svg_pick_up(edge_end);
    }
    current_edge = new_edge(edge_start, edge_end);
  } else if (tool.value() === 'move') {
    if (e.target.tagName === 'circle') {
      let elem = e.target.userData;
      svg_pick_up(elem);
      moving = elem;
    }
  } else if (tool.value() === 'delete') {
    if (e.target.tagName === 'circle') {
      let elem = e.target.userData;
      svg_delete(elem);
    }
  }
};

svg.onmouseup = e => {
  if (tool.value() === 'draw') {
    if (e.target.tagName === 'circle') {
      let elem = e.target.userData;
      edge_end.center.unsubscribe(current_edge.end);
      elem.center.subscribe(current_edge.end);
      edge_start = edge_end;
    } else {
      svg_drop(edge_end);
      edge_start = new_node();
      svg_pick_up(edge_start);
    }
    edge_end = undefined;
    current_edge = undefined;
  } else if (tool.value() === 'move') {
    if (moving !== undefined)
      svg_drop(moving);
  }
};

/* To begin moving stuff press m
*/
/* To draw stuff again press d
*/