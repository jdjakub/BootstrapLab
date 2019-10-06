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

svg = svgel('svg', body);
svg.style.border = '2px dashed red';

last = (arr, n) => arr[arr.length-(n || 1)];
only = arr => {
  if (arr.length > 1) throw ['Expected 1 element; got: ', arr]
  else return arr[0];
};

log = (...args) => { console.log(...args); return last(args); }

match = d => (k,...args) => d[k](...args);

resize = () => {
  let dims = {width: body.offsetWidth*0.99, height: body.offsetHeight*0.99};
  attr(svg, dims);
};

start  = l => [+attr(l, 'x1'), +attr(l, 'y1')];
end    = l => [+attr(l, 'x2'), +attr(l, 'y2')];
center = c => [+attr(c, 'cx'), +attr(c, 'cy')];
radius = c => +attr(c, 'r');

vadd = ([a, b], [c, d]) => [a+c, b+d];
vsub = ([a, b], [c, d]) => [a-c, b-d];
vmul = (k, [x, y]) => [k*x, k*y];
vdot = ([a, b], [c, d]) => a*c + b*d;
vquad = v => vdot(v,v);
vlen = v => Math.sqrt(vquad(v));
varea = ([a, b], [c, d]) => a*d - b*c;
// varea(u,v) = |u||v|sinA
// v is the base of the rect
// u sets the height of the rect = |u|sinA
// A is the angle between u and v

mappings = {};
lookup = (name, input) => {
  let mapping = mappings[name];
  if (mapping === undefined) return undefined;
  let [forward, inverse] = mapping;
  return forward.get(input);
};
rlookup = (output, name) => {
  let mapping = mappings[name];
  if (mapping === undefined) return undefined;
  let [forward, inverse] = mapping;
  return inverse.get(output);
};
// TODO: ensure no mmeory leaks
associate = (name, input, new_output) => {
  let mapping = mappings[name];
  // Lazy initialise
  if (mapping === undefined) {
    mapping = [new Map(), new Map()];
    mappings[name] = mapping;
  }
  let [forward, inverse] = mapping;

  let old_output = forward.get(input);
  if (new_output === undefined) {
    forward.delete(input);
    // Remove if empty
    if (forward.size === 0) delete mappings[name];
  } else { // New output is defined
    forward.set(input, new_output);
    let other_inputs = inverse.get(new_output);
    // Lazy initialise
    if (other_inputs === undefined) {
      other_inputs = new Set();
      inverse.set(new_output, other_inputs);
    }
    other_inputs.add(input);
  }
  // Input no longer maps to old output
  // old output is still mapped to by input...!
  if (old_output !== undefined) {
    let other_inputs = inverse.get(old_output);
    if (input !== undefined)
      other_inputs.delete(input);
    // Remove if empty
    if (other_inputs.size === 0)
      inverse.delete(old_output);
  }
};

window.onresize = resize;

resize();

let RAD_PER_TURN = 2*Math.PI;

// Click => create or select point.
svg.onmousedown = e => {
  let r = svg.getBoundingClientRect();
  let [x, y] = vsub([e.clientX, e.clientY], [r.left, r.top]);
  if (e.target === svg) {
    point('new', [x, y]);
  } else if (e.target.type === 'point') {
    point('exists', e.target);
  } else if (e.target.type === 'line') {
    let l = e.target;
    /*         pt
     *         /|
     *     u /  |
     *     /A   |   l
     * start----|--------end
     *       ^  t = (|u|cos(A)) / |l|
     *       |    = |u||l|cos(A) / |l|2
     *    |u|cos(A)
     */
    let start_to_pt  = vsub([x, y], start(l)); // u
    let start_to_end = vsub(end(l), start(l)); // l
    let t = vdot(start_to_pt, start_to_end) / vquad(start_to_end);
    point('line', l, t);
  } else if (e.target.type === 'circle') {
    let circle = e.target;
    let c_to_pt = vsub([x, y], center(circle));
    let t = Math.atan2(c_to_pt[1], c_to_pt[0]) / RAD_PER_TURN;
    point('circle', circle, t);
  }
};

body.onkeydown = e => {
  let { key } = e;
  if (key === 'l')      line();
  else if (key === 'e') execute();
  else if (key === 'm') move();
  else if (key === 'r') rect();
  else if (key === 'c') circle();
  else if (key === 'i') intersect();
};

dom = {};

dom.defs    = svgel('defs', svg);
dom.lines   = svgel('g', svg, { id: "lines" });
dom.circles = svgel('g', svg, { id: "circles" });
dom.points  = svgel('g', svg, { id: "points" });

// Points stack
points = [];
point = match({
  new: p => { // initialise new
    let [x,y] = p;
    let new_point = svgel('circle', dom.points, {cx: x, cy: y, r: 10, fill: 'purple'});
    new_point.type = 'point';
    new_point.used_by = new Set(); // change affects these shapes
    new_point.constrained_by = new Set(); // position must be compatible with these
    points.push(new_point);
    return new_point;
  },
  exists: p => {
    if (last(points) !== p) // select existing ONCE
      points.push(p);
    return p;
  },
  line: (l, t) => {
    let p = point('new', glomp(l, t));
    l.glomps.set(p, t);
    p.glomping = l;
    p.constrained_by.add(l);
    attr(p, 'fill', 'blue');
    return p;
  },
  circle: (c, t) => {
    let p = point('new', cglomp(c, t));
    c.glomps.set(p, t);
    p.glomping = c;
    p.constrained_by.add(c);
    attr(p, 'fill', 'blue');
    return p;
  }
});

marker = svgel('marker', dom.defs, {
  id: 'Arrowhead', viewBox: '0 0 10 10',
  refX: 10, refY: 5,
  markerUnits: 'strokeWidth',
  markerWidth: 4, markerHeight: 3,
  orient: 'auto'
});

svgel('path', marker, {
  d: 'M 0 0 L 10 5 L 0 10 z'
});

glomp = (l, t) => vadd(vmul(1-t, start(l)), vmul(t, end(l)));

line = () => {
  if (points.length >= 2) {
    let p2 = points.pop();
    let p1 = points.pop();

    if (p1 !== p2) { // initialise new
      let l = svgel('line', dom.lines, {
        x1: attr(p1, 'cx'), y1: attr(p1, 'cy'),
        x2: attr(p2, 'cx'), y2: attr(p2, 'cy'),
        stroke: 'black',
        stroke_width: 7,
        marker_end: 'url(#Arrowhead)'
      });
      l.type = 'line';

      l.start = p1;
      p1.used_by.add(l);
      l.end = p2;
      p2.used_by.add(l);
      l.glomps = new Map(); // points some distance along line
    }
  }
};

follow_arrows = p => {
  // Find the thing it points to
  let targets = [];
  for (let shape of p.used_by)
    if (shape.type === 'line')
      if (shape.start === p && shape.end !== p)
        targets.push(shape.end);
  return targets;
};

execute = () => {
  if (points.length >= 1) {
    let p = points.pop();
    let args = follow_arrows(p);
    if (args.length == 2) {
      let src_ptr, dst_ptr;
      let outs0 = new Set(follow_arrows(args[0]));
      let outs1 = new Set(follow_arrows(args[1]));
      if (outs0.has(args[1])) {
        src_ptr = args[0]; dst_ptr = args[1];
      } else if (outs1.has(args[0])) {
        src_ptr = args[1]; dst_ptr = args[0];
      }
      if (!src_ptr) throw "Couldn't find src_ptr";
      let dst = only(follow_arrows(dst_ptr));
      let src = only(follow_arrows(src_ptr).filter(x => x !== dst_ptr));
      point('exists', src);
      point('exists', dst);
      line();
    }
  }
};

cglomp = (circle, t) => {
  let c = center(circle);
  let r = radius(circle);
  let t_rad = t * RAD_PER_TURN;
  let from_c = vmul(r, [Math.cos(t_rad), Math.sin(t_rad)]);
  return vadd(c, from_c);
}

circle = () => {
  if (points.length >= 2) {
    let p_defining_r = points.pop();
    let [px, py] = center(p_defining_r);
    let p_center = points.pop();
    let [cx, cy] = center(p_center);

    if (p_defining_r !== p_center) {
      let c = svgel('circle', dom.circles, {
        cx, cy, r: vlen(vsub([px, py], [cx, cy])),
        stroke: 'black', stroke_width: 7, fill: 'none'
      });
      c.type = 'circle';

      c.center = p_center;
      p_center.used_by.add(c);
      c.sized_by = p_defining_r;
      p_defining_r.used_by.add(c);
      c.glomps = new Map();
    }
  }
};

replace_point = (shape, p1, p2) => {
  if (shape.type === 'line') {
    if (shape.start === p1) {
      shape.start = p2;
      attr(shape, 'x1', attr(p2, 'cx'));
      attr(shape, 'y1', attr(p2, 'cy'));
    }
    if (shape.end === p1) {
      shape.end = p2;
      attr(shape, 'x2', attr(p2, 'cx'));
      attr(shape, 'y2', attr(p2, 'cy'));
    }
  } else if (shape.type === 'circle') {
    if (shape.center === p1) {
      shape.center = p2;
      attr(shape, 'cx', attr(p2, 'cx'));
      attr(shape, 'cy', attr(p2, 'cy'));
      attr(shape, 'r', vlen(
        vsub(center(shape.sized_by), center(shape))
      ));
    }
    if (shape.sized_by === p1) {
      shape.sized_by = p2;
      attr(shape, 'r', vlen(vsub(center(p2), center(shape))));
    }
  }
};

move = () => {
  if (points.length >= 2) {
    let dest = points.pop();
    let src = points.pop();

    if (src !== dest) { // move src to dest
      to_reglomp = new Set();

      for (let shape of src.used_by) {
        to_reglomp.add(shape);
        replace_point(shape, src, dest);
        dest.used_by.add(shape);
      }

      for (let x of to_reglomp) {
        let old_glomps = Array.from(x.glomps.entries());
        for (let [p,t] of old_glomps) {
          point('exists', p);
          point(x.type, x, t);
          move();
        }
      }

      // delete src
      if (src.glomping !== undefined)
        src.glomping.glomps.delete(src);
      src.remove();
    }
  }
};

intersect = () => {
  if (points.length >= 4) {
    p4 = points.pop();
    p3 = points.pop();
    p2 = points.pop();
    p1 = points.pop();

    // wlog: take p1 as origin
    let v1_to_2 = vsub(center(p2), center(p1));
    let v1_to_3 = vsub(center(p3), center(p1));
    let v3_to_4 = vsub(center(p4), center(p3));

    let t1_to_2 = varea(v1_to_3, v3_to_4) / varea(v1_to_2, v3_to_4);
    let v1_to_X = vmul(t1_to_2, v1_to_2);
    let t3_to_4 = vdot(vsub(v1_to_X, v1_to_3), v3_to_4) / vquad(v3_to_4);

    if (!(0 <= t1_to_2 && t1_to_2 <= 1)) console.log("1 outside", t1_to_2);
    else if (!(0 <= t3_to_4 && t3_to_4 <= 1)) console.log("2 outside", t3_to_4);
    else return point('new', vadd(center(p1), v1_to_X));
  }
};

rect = () => {
  if (points.length >= 2) {
    let p4 = points.pop();
    let p1 = points.pop();

    point('new', [attr(p4, 'cx'), attr(p1, 'cy')]);
    let p2 = points.pop();
    point('new', [attr(p1, 'cx'), attr(p4, 'cy')]);
    let p3 = points.pop();

    point('exists', p1); point('exists', p2); line();
    point('exists', p2); point('exists', p4); line();
    point('exists', p4); point('exists', p3); line();
    point('exists', p3); point('exists', p1); line();
  }
}
