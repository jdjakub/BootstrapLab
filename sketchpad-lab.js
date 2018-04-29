document.documentElement.style.height = '99%';

body = document.body;
body.style.margin = '0px';
body.style.minHeight = '100%';

// e.g. attribs(rect, {stroke_width: 5, stroke: 'red'})
attribs = (elem, attrs) => {
  for (let [k,v] of Object.entries(attrs)) {
    let value = v;//.value === undefined? v : v.value;
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
    this.value = value;
  }
  
  // allow a Variable to be a dependent
  changed(k, v) {
    this.change(v.value);
  }
}

// Intended use: setting variable relationships.
// variable(o, k, l, v) sets o[k] to v and subscribes l to v under the name k.
// If there was already a variable under o[k], it first unsubscribes k from this.
// e.g. variable(line.attrs, 'x1', line, pointer.x)
// makes line's start x-coordinate follow the mouse
// and a subsequent variable(line.attrs, 'x1', line, pointer.y)
// will make it follow y **instead**.
function variable(o, k, l, v) {
  let old = o[k];
  if (old !== undefined && old.unsubscribe !== undefined)
    old.unsubscribe(l, k);
    
  o[k] = v;
  v.subscribe(k, l);
}

//DOM node objects should be called DUMB node objects.
// Their attributes must be reified into Variables:
class SvgElement {
  constructor(type, parent, attrs) {
    this.svgel = svgel(type, parent);
    this.svgel.userData = this;
    this.attrs = {};
    for (let k of attrs) {
      variable(this.attrs, k, this, new Variable());
    }
  }
  
  changed(key, v) {
    v = v.value;
    if (v !== undefined)
      attribs(this.svgel, {[key]: v});
  }
}

class SvgCircle extends SvgElement {
  constructor() {
    super('circle', svg, ['cx', 'cy', 'r', 'stroke', 'fill']);
  }
}

class SvgLine extends SvgElement {
  constructor() {
    super('line', svg, ['x1', 'y1', 'x2', 'y2', 'stroke', 'stroke-width']);
  }
}

pointer = { x: new Variable(), y: new Variable() };

svg.onmousemove = e => {
  let [x,y] = [e.offsetX, e.offsetY];
  pointer.x.change(x);
  pointer.y.change(y);
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
  start.attrs['cx'].subscribe('x1', l.attrs['x1']);
  start.attrs['cy'].subscribe('y1', l.attrs['y1']);
  end.attrs['cx'].subscribe('x2', l.attrs['x2']);
  end.attrs['cy'].subscribe('y2', l.attrs['y2']);
  return l;
}

svg_pick_up = (elem, attr_x, attr_y) => {
  elem.svgel.style.pointerEvents = 'none';
  pointer.x.subscribe('', elem.attrs[attr_x]);
  pointer.y.subscribe('', elem.attrs[attr_y]);
};

svg_drop = (elem, attr_x, attr_y) => {
  elem.svgel.style.pointerEvents = 'all';
  pointer.x.unsubscribe(elem.attrs[attr_x]);
  pointer.y.unsubscribe(elem.attrs[attr_y]);
};

// TODO: When point.x changes, the point as a whole changes.
// A dependent line should be told: one of your points has changed.
// However, it should also be able to see the exact nature of this change, since
// it is linked to a svg x attribute anyway.

tool = 'draw';
edge_start = new_node();
svg_pick_up(edge_start, 'cx', 'cy');

current_edge = undefined;

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
  if (tool === 'draw') {
    if (e.target.tagName === 'circle') {
      edge_end = edge_start;
      edge_start = e.target.userData;
    } else {
      svg_drop(edge_start, 'cx', 'cy');
      edge_end = new_node();
      svg_pick_up(edge_end, 'cx', 'cy');
    }
    current_edge = new_edge(edge_start, edge_end);
  } else if (tool === 'move') {
    if (e.target.tagName === 'circle') {
      let elem = e.target.userData;
      svg_pick_up(elem, 'cx', 'cy');
      moving = elem;
    }
  }
};

svg.onmouseup = e => {
  if (tool === 'draw') {
    if (e.target.tagName === 'circle') {
      let elem = e.target.userData;
        edge_end.attrs['cx'].unsubscribe(current_edge.attrs['x2']);
        edge_end.attrs['cy'].unsubscribe(current_edge.attrs['y2']);
        elem.attrs['cx'].subscribe('x2', current_edge.attrs['x2']);
        elem.attrs['cy'].subscribe('y2', current_edge.attrs['y2']);
        edge_start = edge_end;
    } else {
      svg_drop(edge_end, 'cx', 'cy');
      edge_start = new_node();
      svg_pick_up(edge_start, 'cx', 'cy');
    }
    edge_end = undefined;
    current_edge = undefined;
  } else if (tool === 'move') {
    if (moving !== undefined)
      svg_drop(moving, 'cx', 'cy');
  }
};

/* To begin moving stuff do:
svg_drop(edge_start, 'cx', 'cy');
tool = 'move';
*/
/* To draw stuff again to:
svg_pick_up(edge_start, 'cx', 'cy');
tool = 'draw';
*/
