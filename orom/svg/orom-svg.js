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

svg = svgel('svg', body);
svg.style.border = '2px dashed red';

resize = () => {
  let dims = {width: body.offsetWidth*0.99, height: body.offsetHeight*0.99};
  attr(svg, dims);
};

window.onresize = resize;
resize();

create_entity = name => {
  let grid = svgel('g', svg);
  grid.translate = [0,0];

  let handle = svgel('rect', grid, {
    'class': 'handle',
    x: 0, y: 0, width: 200, height: 20
  });

  let mappings = svgel('g', grid);

  let text = svgel('text', mappings, {
    x: 8, y: 40, font_size: 20, font_family: 'Arial'
  });

  text.textContent = name || "Hello World!";

  let textbb = text.getBBox();
  let handlebb = handle.getBBox();

  let tl = [handlebb.x + 8, handlebb.y+handlebb.height + 8];
  let delta = vsub(tl, [textbb.x, textbb.y]);
  let [x, y] = vadd(xy(text), delta);

  attr(text, {x, y});
  attr(handle, 'width', textbb.width + 16);

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
