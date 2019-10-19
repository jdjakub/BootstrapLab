document.documentElement.style.height = '99%';

body = document.body;
body.style.margin = '0px';
body.style.minHeight = '100%';

// e.g. attr(rect, {stroke_width: 5, stroke: 'red'})
//      attr(rect, 'stroke', 'red')
//      attr(rect, 'height', h => h+32)
//      attr(rect, {fill: 'orange', height: h => h+32})
attr = (elem, key_or_dict, val_or_nothing) => {
  if (typeof(key_or_dict) === 'string') {
    let key = key_or_dict;
    let val = val_or_nothing;
    let old = elem.getAttribute(key);
    if (typeof(val) === 'function') elem.setAttribute(key, val(old));
    else if (val !== undefined)     elem.setAttribute(key, val);
    return old;
  } else {
    let dict = key_or_dict;
    for (let [k,v_or_f] of Object.entries(dict)) {
      let key = k.replace('_','-');
      let old = elem.getAttribute(key);
      let value = typeof(v_or_f) === 'function' ? v_or_f(old) : v_or_f;
      elem.setAttribute(key, value);
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

final = xs => xs[xs.length-1];

htranslate = x => `translate(${x}, 0)`;
vtranslate = y => `translate(0, ${y})`;
translate = (x,y) => `translate(${x},${y})`;

svg = svgel('svg', body);
svg.style.border = '2px dashed red';

resize = () => {
  let dims = {width: body.offsetWidth*0.99, height: body.offsetHeight*0.99};
  attr(svg, dims);
};

window.onresize = resize;
resize();

pad = 4;
col_width = 80;

class CellGrid2D {

  constructor(container, width, height) {
    this.width = width || 8;
    this.row_height = height || 30;
    let top_left = svgel('g', container);
    top_left.translate = [0,0];
    let big_rect = svgel('rect', top_left, {
      x: 0, y: 0, width: pad+this.width+pad, height: this.row_height+pad,
      'class': 'ent-handle'
    });
    let rows = svgel('g', top_left, {
      'class': 'rows', transform: translate(pad,0)
    });
    this.top_left = top_left;
    top_left.main_rect = big_rect;

    top_left.onmousedown = e => {
      window.following_pointer = top_left;
      window.orig_pointer_pos = [e.clientX, e.clientY];
      top_left.orig_translate = top_left.translate;
    };
  }

  newRow() {
    let last_row = this.top_left.querySelector('.rows');
    while (true) {
      let next_row = last_row.querySelector('.row');
      if (next_row) last_row = next_row;
      else break;
    }
    let new_row = svgel('g', last_row, {
      'class': 'row', transform: vtranslate(this.row_height+pad)
    });
    svgel('rect', new_row, {
      x: 0, y: 0, width: this.width, height: this.row_height
    });
    svgel('g', new_row, {
      'class': 'cols', transform: translate(-col_width, pad)
    });
    attr(this.top_left.main_rect, 'height', h => +h+this.row_height+pad);
  }

  newColumn() {
    let prev_row = this.top_left.querySelector('.rows');
    while (true) {
      let curr_row = prev_row.querySelector('.row');
      if (curr_row) {
        let last_col = curr_row.querySelector('.cols');
        while (true) {
          let next_col = last_col.querySelector('.col');
          if (next_col) last_col = next_col;
          else break;
        }

        let new_col = svgel('g', last_col, {
          'class': 'col', transform: htranslate(pad+col_width)
        });
        svgel('rect', new_col, {
          x: 0, y: 0, width: col_width, height: this.row_height-2*pad
        });
        attr(curr_row.querySelector('rect'), 'width', w => +w+pad+col_width);

        prev_row = curr_row;
      } else break;
    }

    attr(this.top_left.main_rect, 'width', w => +w+pad+col_width);
  }
}

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
    window.orig_pointer_pos = [e.clientX, e.clientY];
    grid.orig_translate = grid.translate;
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
window.orig_pointer_pos = undefined;

svg.onmousemove = e => {
  if (window.following_pointer !== undefined) {
    let new_pointer_pos = [e.clientX, e.clientY];
    let delta = vsub(new_pointer_pos, window.orig_pointer_pos);
    let container = window.following_pointer;
    container.translate = vadd(container.orig_translate, delta);
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
grid = new CellGrid2D(svg);
grid.newRow();
grid.newRow();
grid.newRow();
grid.newColumn();
grid.newColumn();
grid.newRow();
