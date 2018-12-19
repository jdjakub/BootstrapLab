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

resize = () => {
  let dims = {width: body.offsetWidth*0.99, height: body.offsetHeight*0.99};
  attr(svg, dims);
};

window.onresize = resize;

resize();

svg.onmousedown = e => {
  let {offsetX, offsetY} = e
  if (e.target === svg) {
    point([offsetX, offsetY]);
  } else if (e.target.tagName === 'circle') {
    point(e.target);
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

points = [];
point = p => {
  if (p.tagName === undefined) {
    let [x,y] = p;
    let new_point = svgel('circle', dom.points, {cx: x, cy: y, r: 10, fill: 'red'});
    new_point.start_of = new Set(); // lines starting at this point
    new_point.end_of = new Set(); // lines ending at this point
    points.push(new_point);
  } else if (last(points) !== p) {
    points.push(p);
  }
};

line = () => {
  if (points.length >= 2) {
    let p2 = points.pop();
    let p1 = points.pop();

    if (p1 !== p2) {
      let l = svgel('line', dom.lines, {
        x1: attr(p1, 'cx'), y1: attr(p1, 'cy'),
        x2: attr(p2, 'cx'), y2: attr(p2, 'cy'),
        stroke: 'black' });

      l.start = p1;
      p1.start_of.add(l);
      l.end = p2;
      p2.end_of.add(l);
    }
  }
};

move = () => {
  if (points.length >= 2) {
    let p2 = points.pop();
    let p1 = points.pop();

    if (p1 !== p2) {
      // merge outgoing lines onto p2
      for (let l of p1.start_of) {
        attr(l, 'x1', attr(p2, 'cx'));
        attr(l, 'y1', attr(p2, 'cy'));
        p2.start_of.add(l);
      }
      // merge incoming lines onto p2
      for (let l of p1.end_of) {
        attr(l, 'x2', attr(p2, 'cx'));
        attr(l, 'y2', attr(p2, 'cy'));
        p2.end_of.add(l);
      }
      // delete p1
      p1.remove();
    }
  }
};

rect = () => {
  if (points.length >= 2) {
    let p4 = points.pop();
    let p1 = points.pop();

    point([attr(p4, 'cx'), attr(p1, 'cy')]);
    let p2 = points.pop();
    point([attr(p1, 'cx'), attr(p4, 'cy')]);
    let p3 = points.pop();

    point(p1); point(p2); line();
    point(p2); point(p4); line();
    point(p4); point(p3); line();
    point(p3); point(p1); line();
  }
}
