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
    'class': 'ent-handle',
    x: 0, y: 0, width: 200, height: 20
  });

  let below = svgel('g', grid, {transform: 'translate(0, 20)'});

  let mappings = svgel('g', below, {'class': 'mappings'});

  let horizontals = svgel('g', mappings, {'class': 'horizontals'});
  let verticals   = svgel('g', mappings, {'class': 'verticals'});

  let input_column = svgel('g', horizontals, {transform: 'translate(20, 0)'});

  let text = svgel('text', input_column, {
    x: 0, y: 0, font_size: 20, font_family: 'Arial Narrow',
    fill: 'gray', stroke: 'none'
  });

  text.textContent = 'New...';

  // Left-align this text
  let textbb = bbox(text);

  let tl = [4,4];
  let delta = vsub(tl, [textbb.l, textbb.t]); // curr TL --> desired TL corner
  let [x, y] = vadd(xy(text), delta);         // corresponding new text origin

  attr(text, {x, y}); // re-position text at new text origin
  textbb = bbox(text); // get updated bbox
  textbb.r += 4; // inflate bbox
  textbb.b += 4;

  let output_column = svgel('g', input_column, {transform: `translate(${4+textbb.w+4}, 0)`});

  let output_ptr_handle = svgel('circle', horizontals, {
    cx: 200-4-5, cy: textbb.b / 2, r: 5, fill: 'black'
  });

  // let cellGrid = new CellGrid(mappings);
  // cellGrid.newRow();
  // cellGrid.newColumn('handle');
  // cellGrid.newColumn('input');
  // cellGrid.newColumn('output');

  let lleft    = svgel('line', verticals,     {x1: 0,      x2: 0,      y1: 0, y2: textbb.b});
  let lright   = svgel('line', verticals,     {x1: 200,    x2: 200,    y1: 0, y2: textbb.b});
  let linput   = svgel('line', input_column,  {x1: 0,      x2: 0,      y1: 0, y2: textbb.b});
  let loutput  = svgel('line', output_column, {x1: 0,      x2: 0,      y1: 0, y2: textbb.b});
  let lbottom  = svgel('line', horizontals, {y1: textbb.b, y2: textbb.b, x1: 0, x2: 200});

  handle.onmousedown = e => {
    window.following_pointer = grid;
  };

  text.beginEdit = () => {console.log('Begin edit')};
  text.finishEdit = () => {console.log('Finish edit')};

  text.onmousedown = e => {
    if (window.active_text !== undefined)
        window.active_text.finishEdit();
    window.active_text = text;
    window.active_text.beginEdit();
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
};

body.onkeydown = e => {
  let t = window.active_text;
  if (t === undefined) return;
  if (e.key === 'Backspace') {
    t.textContent = t.textContent.slice(0, -1);
  } else if (e.key === 'Enter') {
    t.finishEdit();
  } else if (e.key.length === 1) {
    t.textContent += e.key;
  } else {
    return;
  }
  e.preventDefault();
};

new_entity();
