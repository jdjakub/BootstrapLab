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

log = (...args) => { console.log(...args); return last(args); }

match = d => (k,...args) => d[k](...args);

resize = () => {
  let dims = {width: body.offsetWidth*0.99, height: body.offsetHeight*0.99};
  attr(svg, dims);
};

start = l => [+attr(l, 'x1'), +attr(l, 'y1')];
end   = l => [+attr(l, 'x2'), +attr(l, 'y2')];

vadd = ([a, b], [c, d]) => [a+c, b+d];
vsub = ([a, b], [c, d]) => [a-c, b-d];
vmul = (k, [x, y]) => [k*x, k*y];
vdot = ([a, b], [c, d]) => a*c + b*d;
vquad = v => vdot(v,v);

window.onresize = resize;

resize();

// Click => create or select point.
svg.onmousedown = e => {
  let r = svg.getBoundingClientRect();
  let [x, y] = vsub([e.clientX, e.clientY], [r.left, r.top]);
  if (e.target === svg) {
    point('new', [x, y]);
  } else if (e.target.tagName === 'circle') {
    point('exists', e.target);
  } else if (e.target.tagName === 'line') {
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
  }
};

body.onkeydown = e => {
  let { key } = e;
  if (key === 'l') {
    line();
  } else if (key === 'm') {
    move();
  } else if (key === 'r') {
    rect();
  }
};

dom = {};

dom.lines  = svgel('g', svg, { id: "lines" });
dom.points = svgel('g', svg, { id: "points" });

// Points stack
points = [];
point = match({
  new: p => { // initialise new
    let [x,y] = p;
    let new_point = svgel('circle', dom.points, {cx: x, cy: y, r: 10, fill: 'purple'});
    new_point.start_of = new Set(); // lines starting at this point
    new_point.end_of = new Set(); // lines ending at this point
    points.push(new_point);
  },
  exists: p => {
    if (last(points) !== p) // select existing ONCE
      points.push(p);
  },
  line: (l, t) => {
    point('new', glomp(l, t));
    l.glomps.set(last(points), t);
    last(points).glomping = l;
  },
});

line = () => {
  if (points.length >= 2) {
    let p2 = points.pop();
    let p1 = points.pop();

    if (p1 !== p2) { // initialise new
      let l = svgel('line', dom.lines, {
        x1: attr(p1, 'cx'), y1: attr(p1, 'cy'),
        x2: attr(p2, 'cx'), y2: attr(p2, 'cy'),
        stroke: 'black',
        stroke_width: 5
      });

      l.start = p1;
      p1.start_of.add(l);
      l.end = p2;
      p2.end_of.add(l);
      l.glomps = new Map(); // points some distance along line
    }
  }
};

glomp = (l, t) => vadd(vmul(1-t, start(l)), vmul(t, end(l)));

move = () => {
  if (points.length >= 2) {
    let p2 = points.pop();
    let p1 = points.pop();

    if (p1 !== p2) { // move p1 to p2
      lines_to_reglomp = new Set();

      // merge outgoing lines out of p2
      for (let l of p1.start_of) {
        lines_to_reglomp.add(l);
        attr(l, 'x1', attr(p2, 'cx'));
        attr(l, 'y1', attr(p2, 'cy'));
        l.start = p2;
        p2.start_of.add(l);
      }
      // merge incoming lines onto p2
      for (let l of p1.end_of) {
        lines_to_reglomp.add(l);
        attr(l, 'x2', attr(p2, 'cx'));
        attr(l, 'y2', attr(p2, 'cy'));
        l.end = p2;
        p2.end_of.add(l);
      }

      for (let l of lines_to_reglomp) {
        let old_glomps = Array.from(l.glomps.entries());
        for (let [p,t] of old_glomps) {
          point('exists', p);
          point('line', l, t);
          move();
        }
      }

      // delete p1
      if (p1.glomping !== undefined)
        p1.glomping.glomps.delete(p1);
      p1.remove();
    }
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
