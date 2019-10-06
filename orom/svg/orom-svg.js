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

attrs = (el, ...keys) => keys.map(k => attr(el, k));

// e.g. rect = svgel('rect', svg, {x: 5, y: 5, width: 5, height: 5})
svgel = (tag, parent, attrs) => {
  let elem = document.createElementNS("http://www.w3.org/2000/svg", tag);
  if (attrs !== undefined) attr(elem, attrs);
  if (parent !== undefined)
    parent.appendChild(elem);
  return elem;
};

vadd = ([a, b], [c, d]) => [a+c, b+d];
vsub = ([a, b], [c, d]) => [a-c, b-d];

xy = t => attrs(t, 'x', 'y').map(v => +v);

bbox = el => {
  let {x, y, width, height} = el.getBBox();
  let l = x,     t = y;
  let w = width, h = height;
  let r = l+w,   b = t+h;
  return {
    left: l, right: r, top: t, bottom: b, width: w, height: h,
    l, r, t, b, w, h
  };
}

svg = svgel('svg', body);
svg.style.border = '2px dashed red';

resize = () => {
  let dims = {width: body.offsetWidth*0.99, height: body.offsetHeight*0.99};
  attr(svg, dims);
};

window.onresize = resize;
resize();

new_entity = () => {
  let grid = svgel('g', svg);
  grid.translate = [0,0];

  let handle = svgel('rect', grid, {
    'class': 'handle',
    x: 0, y: 0, width: 200, height: 20
  });

  let below = svgel('g', grid, {'transform': 'translate(0, 20)'});

  let mappings = svgel('g', below, {'class': 'mappings'});

  let horizontals = svgel('g', mappings, {'class': 'horizontals'});
  let verticals   = svgel('g', mappings, {'class': 'verticals'});

  let text = svgel('text', mappings, {
    x: 8, y: 40, font_size: 20, font_family: 'Arial Narrow', fill: 'gray'
  });

  text.textContent = 'New...';

  // Left-align this text
  let textbb = bbox(text);

  let tl = [24,4];
  let delta = vsub(tl, [textbb.l, textbb.t]); // curr TL --> desired TL corner
  let [x, y] = vadd(xy(text), delta);         // corresponding new text origin

  attr(text, {x, y}); // re-position text at new text origin
  textbb = bbox(text); // get updated bbox
  textbb.r += 4; // inflate bbox
  textbb.b += 4;

  // let cellGrid = new CellGrid(mappings);
  // cellGrid.newRow();
  // cellGrid.newColumn('handle');
  // cellGrid.newColumn('input');
  // cellGrid.newColumn('output');

  let lleft    = svgel('line', verticals,   {x1: 0,        x2: 0,        y1: 0, y2: textbb.b});
  let linputs  = svgel('line', verticals,   {x1: 20,       x2: 20,       y1: 0, y2: textbb.b});
  let lright   = svgel('line', verticals,   {x1: 200,      x2: 200,      y1: 0, y2: textbb.b});
  let loutputs = svgel('line', verticals,   {x1: textbb.r, x2: textbb.r, y1: 0, y2: textbb.b});
  let lbottom  = svgel('line', horizontals, {y1: textbb.b, y2: textbb.b, x1: 0, x2: 200     });

  handle.onmousedown = e => {
    window.following_pointer = grid;
  };

  return grid;
}

window.following_pointer = undefined;

svg.onmousemove = e => {
  if (window.following_pointer !== undefined) {
    let delta = [e.movementX, e.movementY];
    let container = window.following_pointer;
    container.translate = vadd(container.translate, delta);
    let [x,y] = container.translate;
    attr(container, 'transform', `translate(${x},${y})`);
  }
};

svg.onmouseup = e => {
  window.following_pointer = undefined;
}

new_entity();
