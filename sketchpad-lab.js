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
    this.dependents = new Map(); // obj --> names registered by obj
  }
  
  // x.subscribe('x', point)
  subscribe(k, obj) {
    let names = this.dependents.get(obj); // Get names registered for obj
    if (names === undefined) { // If obj is not already subscribed
      names = new Set();
      this.dependents.set(obj, names);
    }
    names.add(k);
    obj.changed(k, this); // Provide initial value
    return this;
  }
  
  unsubscribe(obj, k) {
    let names = this.dependents.get(obj); // Get names registered for obj
    if (names !== undefined) { // If there is a subscription
      if (k !== undefined) names.delete(k); // Unsubscribe specific name
      else names.clear(); // Or unsubscribe all names by default
      if (names.size === 0) // If there is effectively no subscription
        this.dependents.delete(obj); // Then make this officially true
    }
    return this;
  }

  change(...args) {
    this.changeSelf(...args);
    for (let [dep, names] of this.dependents)
      for (let k of names)
        dep.changed(k, this);
  }

  // Override to do something other than update value...?
  changeSelf(value) {
    this._value = value;
  }
  
  value() {
    return this._value;
  }
  
  // allow a Variable to be a dependent
  changed(k, v) {
    this.change(v.value());
  }
}

class VarList extends Variable {
  constructor(...vars) {
    super();
    this.vars = vars;
  }
  
  changeSelf(values) {
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
  constructor(type, parent, attrs) {
    this.svgel = svgel(type, parent);
    this.svgel.userData = this;
    this.attrs = {};
    for (let k of attrs) {
      this.attrs[k] = new Variable().subscribe(k, this);
    }
  }
  
  changed(key, v) {
    v = v.value();
    if (v !== undefined)
      attribs(this.svgel, {[key]: v});
  }
}

class SvgCircle extends SvgElement {
  constructor() {
    super('circle', svg, ['cx', 'cy', 'r', 'stroke', 'fill']);
    this.center = new VarList(this.attrs['cx'], this.attrs['cy']);
  }
}

class SvgLine extends SvgElement {
  constructor() {
    super('line', svg, ['x1', 'y1', 'x2', 'y2', 'stroke', 'stroke-width']);
    this.start = new VarList(this.attrs['x1'], this.attrs['y1']);
    this.end = new VarList(this.attrs['x2'], this.attrs['y2']);
  }
}

pointer = new VarList(new Variable(), new Variable());

svg.onmousemove = e => {
  let coords = [e.offsetX, e.offsetY];
  pointer.change(coords);
};

new_node = () => {
  let c = new SvgCircle();
  c.attrs['r'].change(15);
  c.attrs['stroke'].change('black');
  c.attrs['fill'].change('white');
  return c;
};

new_edge = (start, end) => {
  let l = new SvgLine();
  l.svgel.style.pointerEvents = 'none';
  l.attrs['stroke-width'].change(2);
  l.attrs['stroke'].change('black');
  start.center.subscribe('start', l.start);
  end.center.subscribe('end', l.end);
  return l;
}

svg_pick_up = (elem) => {
  elem.svgel.style.pointerEvents = 'none';
  pointer.subscribe('center', elem.center);
};

svg_drop = (elem) => {
  elem.svgel.style.pointerEvents = 'all';
  pointer.unsubscribe(elem.center);
};

tool = new Variable();
tool.subscribe('tool', { changed: (k, v) => console.log('Tool: '+v.value()) });
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
      elem.center.subscribe('end', current_edge.end);
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
