DEBUG = (x) => { debugger; return x; };
last = (arr, n) => arr[arr.length-(n || 1)];
log = (...args) => { console.log(...args); return last(args); };
function forMat4(m) {
  const s = m.elements.map(n => n.toPrecision(2));
  return [
    [s[0], s[4], s[8],  s[12]].join('\t'),
    [s[1], s[5], s[9],  s[13]].join('\t'),
    [s[2], s[6], s[10], s[14]].join('\t'),
    [s[3], s[7], s[11], s[15]].join('\t'),
  ].join('\n');
}
lr = n => n.toPrecision(2) + (n < 0 ? ' left' : ' right');
ud = n => n.toPrecision(2) + (n < 0 ? ' down' : ' up');
xyz = (o) => new e3.Vector3(o.right, o.up, o.forward);
ruf = (o) => ({ right: o.x, up: o.y, forward: o.z });
e3 = THREE;
renderer = new e3.WebGLRenderer({ antialias: true });
document.body.appendChild(renderer.domElement);
renderer.domElement.style.display = 'inline-block';
const [rw, rh] = [window.innerWidth*.50, window.innerHeight*.99];
renderer.setSize(rw, rh);
const DPR = window.devicePixelRatio || 1;
renderer.setPixelRatio(DPR);
scene = new e3.Scene(); scene.name = 'world';
aspect = rw / rh;
camera = new e3.OrthographicCamera( -aspect, +aspect, +1, -1, 0, 1000);
//camera.name = 'camera'; scene.add(camera);

geom = new e3.PlaneGeometry(2, 2);
mat = new e3.MeshBasicMaterial({ color: 0x770077, side: e3.DoubleSide });
shapes = new e3.Mesh(geom, mat);
shapes.name = 'shapes'; scene.add(shapes);
shapes.translateZ(-100);

origin = new e3.Vector3();
dir = new e3.Vector3(1,0,0);
x_helper = new e3.ArrowHelper(dir, origin, 1, 0xff0000);
scene.add(x_helper);
dir = new e3.Vector3(0,1,0);
y_helper = new e3.ArrowHelper(dir, origin, 1, 0x00ff00);
scene.add(y_helper);

function leastCommonAncestor(_3obj1, _3obj2) {
  const nodes = [_3obj1, _3obj2];
  const opp = x => 1-x; // 0 <-> 1
  const visited = [new Set([_3obj1]), new Set([_3obj2])];
  let curr = 0;
  while (!visited[opp(curr)].has(nodes[curr])) { // current node not in other set
    visited[curr].add(nodes[curr]); // mark current node as visited
    const parent = nodes[curr].parent;
    if (parent !== null) nodes[curr] = parent; // climb up
    else if (nodes[opp(curr)].parent === null)
      if (nodes[0] === nodes[1]) return nodes[0];
      else throw ["Coord frames live in disjoint trees: ", _3obj1.name, _3obj2.name];
    curr = opp(curr); // alternate between three1's and three2's path
  }
  return nodes[curr];
}

function coordMatrixFromTo(from3obj /* A */, to3obj /* E */) {
  /*      C         We desire [A->E] = [E<-A]
   *     / \        = [E<-D][D<-C][C<-B][B<-A]
   *    B   D        each .matrix means [local->parent] = [parent<-local] coords
   *   /     \        so [E<-A] = E' D' B ' = (E' D')(B A) = [DOWN] [UP]
   *  A       E
   */
  const common = leastCommonAncestor(from3obj, to3obj); // C
  const up_mat = new e3.Matrix4();
  const tmp = new e3.Matrix4();
  while (from3obj !== common) { // go up from A to C
    // 3JS "pre"-multiply means LEFT-multiply - NOT "transform happens before"...
    up_mat.premultiply(from3obj.matrix); // go local->parent coords
    from3obj = from3obj.parent;
  }
  const down_mat = new e3.Matrix4();
  while (to3obj !== common) { // go up from E to C
    // 3JS "post"-multiply does NOT mean "transform happens after" - but RIGHT >:(
    down_mat.multiply(tmp.copy(to3obj.matrix).invert()); // build up [DOWN] left-to-right
    to3obj = to3obj.parent;
  }
  return down_mat.multiply(up_mat);
}

ndc = new e3.Object3D(); ndc.name = 'ndc';
camera.add(ndc);
ndc.matrix.copy(camera.projectionMatrixInverse); // Needs sync
ndc.matrixAutoUpdate = false;

screen = new e3.Object3D(); screen.name = 'screen';
ndc.add(screen);
(() => {
  const [xe,ye] = [rw/2, rh/2];
  screen.matrix.set(
    1/xe,     0, 0, -1,    // 0----xe--->..........
       0, -1/ye, 0, +1,    // |-------x------>
       0,     0, 1,  0,    // 0-----x/xe-----> = 1.5
       0,     0, 0,  1,    // |         |---->   1.5 - 1 = 0.5
  );
  screen.matrixAutoUpdate = false;
})();

function vecInBasis(v, isPoint, currBasis, targBasis) {
  return new e3.Vector4(v.x, v.y, v.z, isPoint? 1 : 0)
             .applyMatrix4(coordMatrixFromTo(currBasis, targBasis));
}

function clientToWorld(v) {
  return new e3.Vector4(v.x, v.y, 0, v.z).applyMatrix4(coordMatrixFromTo(screen, scene));
}

/*
screen -> ndc -> camera-local -> world
screen vec: s0 s-org + s1 s-right + s2 s-down
   ndc vec: n0 n-org + n1 n-right + n2 n-up

s-org = n-org - n-right + n-up
n-org = s-org + hw s-right - hw s-up

s-right = n-right/hw
n-right = hw s-right

s-down = - n-up/hh
n-up   = - hh s-down
*/

function bl_vec_from_3js(_3obj, propName) {
  const vec = _3obj[propName];
  if (propName === 'position') {
    return map_new({ basis: _3obj.parent.name, ...ruf(vec) });
  }
}

// Warning: forward refs to tree stuff
renderer.domElement.onmousedown = e => {
  upd(ctx, 'pointer', 'is_dragging', true);
  /*if (!ctx.dragging_in_system) return; // Smell: demo-dependence
  const tmp = ctx.pointer.pressed_at; tmp.right = e.clientX; tmp.down = e.clientY;
  JSONTree.update(ctx.pointer, 'pressed_at');
  JSONTree.highlight('jstExternalChange', tmp);*/
};
renderer.domElement.onmouseup = e => {
  upd(ctx, 'pointer', 'is_dragging', false);
  /*if (ctx.pointer === undefined || !ctx.dragging_in_system) return; // Smell: demo-dependence
  const tmp = ctx.pointer.released_at; tmp.right = e.clientX; tmp.down = e.clientY;
  JSONTree.update(ctx.pointer, 'released_at');
  JSONTree.highlight('jstExternalChange', tmp);*/
};

last_pointer = undefined;
last_delta = new e3.Vector3();
renderer.domElement.onmousemove = e => {
  const curr = new e3.Vector3(e.clientX, e.clientY, 1);
  if (last_pointer !== undefined)
    last_delta.subVectors(curr, last_pointer);
  last_pointer = curr;

  if (map_get(ctx, 'pointer', 'is_dragging')) {
    const selected_shape = map_get(ctx, 'selected_shape');
    if (selected_shape === undefined) {
      const delta_camera = clientToWorld(last_delta);
      delta_camera.z = 0;
      if (!map_get(ctx, 'dragging_in_system')) {
        camera.position.sub(delta_camera);
        upd(ctx, 'scene', 'camera', 'position', bl_vec_from_3js(camera, 'position'));
      }
    } else { // SMELL hapoc demo dependence
      const d = last_delta;
      const delta_shape = new e3.Vector4(d.x, d.y, 0, d.z).applyMatrix4(coordMatrixFromTo(screen, shapes));
      delta_shape.z = 0;
      selected_shape._3js_proxy.position.add(delta_shape);
      upd(selected_shape, 'center', bl_vec_from_3js(selected_shape._3js_proxy, 'position'));
    }
  }
};

zoom_per_pixel = 0.95; // Every px of scroll shrinks view window to 95%

renderer.domElement.onwheel = e => {
  if (e.deltaMode !== WheelEvent.DOM_DELTA_PIXEL) return;
  const focus_px = new e3.Vector3(e.clientX, e.clientY, 1);
  let focus = clientToWorld(focus_px);
  focus = new e3.Vector4(focus.x, focus.y, 0, 1);
  const new_focus = focus.clone().applyMatrix4(camera.matrixWorldInverse);

  const change_factor = e.deltaY > 0 ? 1/zoom_per_pixel : zoom_per_pixel;
  camera.zoom *= change_factor;
  upd(ctx, 'scene', 'camera', 'zoom', camera.zoom);
  new_focus.divideScalar(change_factor); new_focus.w = 1;
  new_focus.applyMatrix4(camera.matrixWorld);

  const delta = focus.clone().sub(new_focus);
  delta.z = 0;
  camera.position.add(delta);
  upd(ctx, 'scene', 'camera', 'position', bl_vec_from_3js(camera, 'position'));

  e.preventDefault();
};

function r() {
  ThreeMeshUI.update();
  renderer.render(scene, camera);
  need_rerender = false;
}

r();

next_id = 0;
jsobj_from_id = new Map();
id_from_jsobj = new Map();

function deref(id) {
  if (typeof id === 'number') {
    return jsobj_from_id.get(id);
  } else {
    const key = id.key;
    id = id.id; // lol
    return jsobj_from_id.get(id)[key];
  }
}

function ref(obj) {
  if (typeof obj === 'object' || typeof obj === 'function') {
    if (!id_from_jsobj.has(obj)) {
      const id = next_id++;
      jsobj_from_id.set(id, obj);
      id_from_jsobj.set(obj, id);
    };
    return { id: id_from_jsobj.get(obj) };
  } else return null;
}

// In-universe, we call objs / dicts "maps"

function maps_init(o) { // REWRITES o
  const map = { entries: o };
  Object.entries(o).forEach(([k,v]) => { // Traverse TREE (no cycles!)
    if (typeof v === 'object' && v !== null) o[k] = maps_init(v);
  });
  return map;
}
function map_new(o={}) {
  return { entries: o };
}
function map_get(o, ...path) {
  path.forEach(k => o = o.entries[k]); return o;
}
function map_set(o, ...args) {
  if (args.length === 1) { o.entries[args[1]] = undefined; return; }
  let k = args.shift(); const v = args.pop();
  args.forEach(a => { o = o.entries[k]; k = a; });
  o.entries[k] = v;
  return v;
}
function map_set_rel(o, ...args) {
  let k = args.shift(); const f = args.pop();
  args.forEach(a => { o = o.entries[k]; k = a; });
  o.entries[k] = f(o.entries[k]);
}
map_iter = (o, f) => Object.entries(o.entries).forEach(([k,v],i) => f(k,v,i));
map_num_entries = (o) => Object.keys(o.entries).length;

ctx = {};

treeView = document.getElementById('treeview');
document.body.appendChild(treeView); // So that it's last

function fetch() {
  const ref = map_get(ctx, 'next_instruction', 'ref');
  let next_inst = map_get(ref, 'map', map_get(ref, 'key'));
  if (next_inst === undefined) {
    let continue_to = map_get(ref, 'map', 'continue_to'); // check current block's continue addr
    if (!continue_to) continue_to = map_get(ctx, 'continue_to'); // fall back to register
    if (continue_to) {
      if (map_get(continue_to, 'map')) {
        map_set(ref, 'map', map_get(continue_to, 'map'));
        JSONTree.update(map_get(ctx, 'next_instruction', 'ref'), 'map');
      }
      if (map_get(continue_to, 'key')) map_set(ref, 'key', map_get(continue_to, 'key'));
      else map_set(ref, 'key', 1); // beginning of new basic block
    } else { // check return_to SMELL just do this with continue_to?
      const return_to = map_get(ctx, 'return_to');
      if (return_to) { // pop and restore prev execution point
        map_set(ref, 'map', map_get(return_to, 'map'));
        map_set(ref, 'key', map_get(return_to, 'key'));
        map_set(ctx, 'return_to', map_get(return_to, 'next'));
        JSONTree.update(ref, 'map');
        JSONTree.update(ctx, 'return_to');
      }
    }
    next_inst = map_get(ref, 'map', map_get(ref, 'key'));
  }
  map_set(ctx, 'next_instruction', 'value', next_inst);

  // Duped from run_and_render
  JSONTree.update(map_get(ctx, 'next_instruction', 'ref'), 'key');
  JSONTree.update(map_get(ctx, 'next_instruction'), 'value');
  JSONTree.highlight('jstNextInstruction', map_get(ctx, 'next_instruction', 'value'));
}

function clone(o) {
  if (typeof o === 'object') { // deep copy, intended for tree literals
    const o2 = {};
    Object.entries(o).forEach(([k, v]) => { o2[k] = clone(v); });
    return o2;
  } // CAUTION: won't work for Functions, DOM nodes etc.
  return o;
}

function single_step(nofetch=false) {
  const inst = map_get(ctx, 'next_instruction', 'value'); // i.e. Instruction Pointer
  // Cache values, before any modifications, for later
  const op       = map_get(inst, 'op');    // i.e. opcode
  const focus    = map_get(ctx, 'focus');  // i.e. accumulator / bottleneck / map key register
  const map      = map_get(ctx, 'map');    // i.e. "map to read to / write from" register
  const source   = map_get(ctx, 'source'); // i.e. register to copy to write destination
  const basis    = map_get(ctx, 'basis');  // i.e. name of coords to convert to
  const dest_reg = map_get(inst, 'register');

  map_set_rel(ctx, 'next_instruction', 'ref', 'key', v => v+1);

  // Modify state according to instruction
    // load: copy value to .focus register
  if      (op === 'load') {
    const value = map_get(inst, 'value');
    map_set(ctx, 'focus', clone(value));
    // store: copy value in .focus to the given reg (if included)
  } //        OR copy value in .source to .map[.focus] (if absent)
  else if (op === 'store') {
    if (dest_reg === undefined) {
      map_set(ctx, 'map', focus, source);
    } else map_set(ctx, dest_reg, focus);
  } // deref: replace .focus with the value of the reg it references
  else if (op === 'deref') {
    map_set(ctx, 'focus', map_get(ctx, focus));
  } // index: index the .map with .focus as the key, replacing .map
  else if (op === 'index') {
    let tmp = map_get(ctx, 'map', focus);
    // Maps can include the _ key as "default", "else" or "otherwise"
    if (tmp === undefined) tmp = map_get(ctx, 'map', '_'); // TODO smell: risky?
    map_set(ctx, 'map', tmp);
  } // js: execute arbitrary JS code :P TODO return changeset
  else if (op === 'js') {
    map_get(inst, 'func')(inst);
  } // in_basis: convert vector in .focus to the basis named in .basis
  else if (op === 'in_basis') {
    const curr_basis = map_get(focus, 'basis');
    if (curr_basis !== basis) {
      let v = xyz(focus.entries);
      v = vecInBasis(v, !map_get(focus, 'is_vec'), bases[curr_basis]._3js_proxy, bases[basis]._3js_proxy);
      map_set(focus, 'right', v.x); map_set(focus, 'up', v.y); map_set(focus, 'forward', v.z);
      map_set(focus, 'basis', basis);
    }
  }
  else if (op === 'add') { // TODO: operand stack?
    map_set(ctx, 'focus', focus + map_get(ctx, 'addend'));
  }
  else if (op === 'mul') {
    map_set(ctx, 'focus', focus * map_get(ctx, 'factor'));
  }
  else if (op === 'sign') {
    map_set(ctx, 'focus', Math.sign(focus));
  } // no op field: assume nested instruction list
  else if (op === undefined) {
    const ref = map_get(ctx, 'next_instruction', 'ref');
    const prev_return_pt = map_get(ctx, 'return_to');
    map_set(ctx, 'return_to', map_new({ ...ref, next: prev_return_pt })); // Push current execution point
    map_set(ref, 'map', inst); map_set(ref, 'key', 1); // Dive in
  }

  if (!nofetch) fetch(); // This goes here in case the instruction changed next_instruction

  let obj = ctx, key = 'focus'; // i.e. what changed?
  if (op === 'store')
    if (dest_reg === undefined) { obj = map; key = focus; }
    else key = dest_reg;
  else if (op === 'index') key = 'map';
  else if (op === undefined) key = 'return_to';

  // Check if the map being changed is a proxy for some 3JS thing
  update_relevant_proxy_objs(obj, key);

  // Return changeset
  return [
    [obj, key], [map_get(ctx, 'next_instruction', 'ref'), 'key'], [map_get(ctx, 'next_instruction'), 'value']
  ].map(([o, k]) => [ref(o).id, k]);
}

function update_relevant_proxy_objs(obj, key) {
  let f;
  if (obj.isChildrenFor !== undefined) f = sync_3js_children;
  else if (obj.isPositionFor !== undefined) f = sync_3js_pos;
  else if (obj._3js_proxy !== undefined) f = sync_3js_proxy;
  else return;
  const val = map_get(obj, key);
  f(obj)(key, val);
}

square_geom = new e3.PlaneGeometry(1, 1);
need_rerender = false;
bases = {};

sync_3js_children = (children) => (ch_name, child) => {
  const parent = children.isChildrenFor;
  map_iter(child, sync_3js_proxy(child, parent));
  if (child._3js_proxy) {
    child._3js_proxy.name = ch_name; // set name in 3js
    parent._3js_proxy.add(child._3js_proxy); // <-- the syncing part
    if (bases[ch_name] === undefined) bases[ch_name] = child; // SMELL unique names
  }
}

sync_3js_proxy = (obj, parent) => (key, val) => {
  if (key === 'children') {
    val.isChildrenFor = obj;
    if (obj._3js_proxy === undefined) obj._3js_proxy = new e3.Group();
    map_iter(val, sync_3js_children(val));
  } else if (key === 'color' && val !== undefined) {
    init_3js_rect(obj); obj._3js_rect.material.color.setHex(parseInt(val));
  } else if (key === 'width') { // TODO: rect ontologies
    init_3js_rect(obj); obj._3js_rect.scale.x = val;
  } else if (key === 'height') {
    init_3js_rect(obj); obj._3js_rect.scale.y = val;
  } else if (key === 'zoom' && obj._3js_proxy.isCamera) {
    obj._3js_proxy.zoom = val;
    camera.updateProjectionMatrix();
    ndc.matrix.copy(camera.projectionMatrixInverse);
  } else if (key === 'center' || key === 'position' || key === 'top_left') {
    if (key === 'center') init_3js_rect(obj);
    if (key === 'top_left') init_3js_text(obj);
    val.isPositionFor = obj._3js_proxy;
    map_iter(val, sync_3js_pos(val));
    let curr_basis = map_get(val, 'basis');
    let targ_basis = parent? parent._3js_proxy.name : val.isPositionFor.parent.name;
    if (curr_basis !== undefined && curr_basis !== targ_basis) {
      curr_basis = bases[curr_basis]; targ_basis = bases[targ_basis];
      const v = val.isPositionFor.position;
      if (obj._3js_proxy.isCamera) { // keep cameras at z=10 world
        v.copy(vecInBasis(v, true, curr_basis._3js_proxy, scene));
        v.z = 10;
        if (targ_basis._3js_proxy !== scene)
          v.copy(vecInBasis(v, true, scene, targ_basis._3js_proxy));
      } else
        v.copy(vecInBasis(v, true, curr_basis._3js_proxy, targ_basis._3js_proxy));
    }
  } else if (key === 'text') {
    init_3js_text(obj); obj._3js_text.set({ content: val.toString() });
  }
  need_rerender = true;
}

function init_3js_rect(obj) {
  if (obj._3js_proxy === undefined) obj._3js_proxy = new e3.Group();
  if (obj._3js_rect === undefined) {
    const mat = new e3.MeshBasicMaterial({ color: 0xff00ff, side: e3.DoubleSide });
    obj._3js_rect = new e3.Mesh(square_geom, mat);
    obj._3js_proxy.add(obj._3js_rect);
  }
}

function init_3js_text(obj) {
  if (obj._3js_proxy === undefined) obj._3js_proxy = new e3.Group();
  if (obj._3js_text === undefined) {
    const width = 4, height = 1;
    const block = new ThreeMeshUI.Block({
      fontFamily: 'Roboto-msdf.json', fontTexture: 'Roboto-msdf.png',
      width, height, fontSize: 0.2,  backgroundOpacity: 0, alignContent: 'left',
      padding: 0, margin: 0
    });
    obj._3js_proxy.add(block);
    obj._3js_text = new ThreeMeshUI.Text({content: map_get(obj, 'text')});
    block.add(obj._3js_text);
    block.position.set(width/2, -height/2, 0); // so .position = top-left
  }
}

sync_3js_pos = (obj) => (key, val) => {
  let k = { right: 'x', up: 'y', forward: 'z' }[key];
  if (k === undefined) return;
  obj.isPositionFor.position[k] = val;
  need_rerender = true;
}

function run_and_render(num_steps=1) {
  let nofetch = false;
  if (num_steps === 0) {
    num_steps = 1; nofetch = true;
  }

  const in_order = [];
  for (let i=0; i<num_steps; i++) {
    const [id, key] = single_step(nofetch)[0];
    in_order.push([deref(id), key]); // add it to the end
  }

  const changes = new Map();
  const no_repeats = [];
  for (let i=in_order.length-1; i>=0; i--) {
    const [id, key] = in_order[i];
    if (!changes.has(id)) changes.set(id, new Set()); // lazy init
    if (!changes.get(id).has(key)) {
      no_repeats.push(in_order[i]); // Save most recent occurrence
      changes.get(id).add(key);
    }
  }

  no_repeats.reverse();

  let last_change;
  no_repeats.forEach(([obj, key]) => {
    last_change = [obj, key];
    JSONTree.update(...last_change);
  });
  // Highlight the most recent change in the tree
  JSONTree.highlight('jstLastChange', ...last_change);

  // We know these will have changed
  JSONTree.update(map_get(ctx, 'next_instruction', 'ref'), 'key');
  JSONTree.update(map_get(ctx, 'next_instruction'), 'value');
  JSONTree.highlight('jstNextInstruction', map_get(ctx, 'next_instruction', 'value'));

  if (need_rerender) r();
}

function typed(str, objs) {
  if (str === '{}') return {};
  if (str[0] === '$') return objs[+str.substring(1)]; // $N = insert obj[N]
  const n = +str;
  if (isNaN(n)) return str;
  else return n;
}

function assemble_code(blocks, ...args) {
  const obj = {};
  let start_i = 1;
  let instructions = blocks.map(block => typeof block !== 'string' ? block :
    block.replaceAll('\n', '').split(';').map(s => {
      s = s.trim().split(' ');
      s[0] = s[0].toLowerCase();
           if (s[0] === 'l') return { op: 'load', value: typed(s[1], args) };
      else if (s[0] === 's') return { op: 'store', register: s[1] };
      else if (s[0] === 'd') return { op: 'deref' };
      else if (s[0] === 'i') return { op: 'index' };
      else if (s[0] === '+') return { op: 'add' };
      else if (s[0] === '*') return { op: 'mul' };
      else return { op: s[0] };
      return;
    })
  );
  instructions = instructions.flat();
  instructions.forEach((inst,n) => { obj[start_i+n] = inst; });
  return obj;
}

function load_state() {
  ctx = maps_init({
    next_instruction: { ref: { map: null, key: 1 } },
    continue_to: null,
    focus: null,
    map: null,
    vec_from: null,
    vec_to: null,
    source: null,
    instructions: {
      // Set lisp_stuff.args_e.value.args_e.body_e.1.type = foobar
      example_store_obj: {
        // [['l lisp_stuff; d; s map'], ['l args_e; i; l value; i; l args_e; i;'+
        // 'l_body_y; i; l 1; i'], [ 'l foobar; s source; l type; s' ]]
        1: {
          1: {op:"load",value:"lisp_stuff"},
          2: {op:"deref"},
          3: {op:"store",register:"map"},
        },
        2: {
          1:{op:"load",value:"args_e"},
          2:{op:"index"},
          3:{op:"load",value:"value"},
          4:{op:"index"},
          5:{op:"load",value:"args_e"},
          6:{op:"index"},
          7:{op:"load",value:"body_e"},
          8:{op:"index"},
          9:{op:"load",value:1},
          10:{op:"index"},
        },
        3: {
          1:{op:"load",value:"foobar"},
          2:{op:"store",register:"source"},
          3:{op:"load",value:"type"},
          4:{op:"store"}
        }
      },
      /* last_delta = pointer.(released_at - pressed_at)
       * camera.position.sub(last_delta in world with z=0)
       * ---
       * vec_from := pointer.pressed_at; vec_to := pointer.released_at;
       * sub; in world; focus.forward := 0; s vec_from; vec_to := camera.position;
       * sub; camera.position := focus
       */
      example_move_shape: assemble_code([
        `l pointer; d; s map; l pressed_at; i; l map; d; s vec_from;
        l pointer; d; s map; l released_at; i; l map; d; s vec_to`,
        { op: 'vsub' }, { op: 'in', basis: 'world' },
        `s map; l 0; s source; l forward; s; l map; d; s vec_from;
        l scene; d; s map; l camera; i; l position; i; l map; d; s vec_to`,
        { op: 'vsub' },
        `s source; l scene; d; s map; l camera; i; l position; s`,
      ]),
      // Set .conclusion based on .weather, and then mark .finished
      example_conditional: {
        start: assemble_code([
          'l instructions; d; s map; l example_conditional; i; l branch1; i; l weather; d; i;' +
          'l map; d; s source', { op: 'load', value: { map: null } },
          's map; l map; s; d; s continue_to' // essentially, conditional jump = 9 uops
        ]),
        branch1: {
          warm: assemble_code([
            { op: 'load', value: "it's warm" }, // cuz assemble_code can't handle spaces yet lol
            's conclusion'
          ]),
          cold: assemble_code([ { op: 'load', value: "it's cold" }, 's conclusion' ]),
          _:    assemble_code([ { op: 'load', value: "it's neither!" }, 's conclusion' ]),
        },
        finish: assemble_code(['l true; s finished']),
      },
      example_render: {
        start: assemble_code([
          'l stack; d; s map; l stack_top; d; i; l map; d; s frame;' + // frame := stack[stack_top]
          'l {}; s continue_to;' +
          'l instructions; d; s map; l example_render; i; l branch1; i;' +
          'l -1; s addend; l stack_top; d; +; s tmp; sign; i;' +
          'l map; d; s source; l continue_to; d; s map; l map; s' // goto branch[sgn(stack_top-1)]
        ]),
        branch1: {
          0: assemble_code(['l 0; s voffs']),
          1: assemble_code([
            'l -.3; s factor; l stack; d; s map; l tmp; d; i; l nlines; i;' +
            'l map; d; *; s voffs' // voffs := stack[stack_top-1].nlines * -.3
          ]),
        },
        render: assemble_code([
          'l $0; s tmp; s map; l top_left; i; l voffs; d; s source; l up; s;' + // ...top_left.up := voffs
          'l :; s addend; l frame; d; s map; l src_key; i; l map; d; +; s source;' +
          'l tmp; d; s map; l text; s;' + // key_r.text := frame.src_key+':'
          'l tmp; d; s source; l frame; d; s map; l key_r; s;' + // frame.key_r := key_r
          'l dst_key; i; s tmp; l frame; d; s map; l dst_map; i; l tmp; d; s' // frame.dst_map[frame.dst_key] := key_r
        ], { top_left: {right: .2}, children: {} }),
      }
    },
    dragging_in_system: false,
    pointer: {
      is_dragging: false,
      pressed_at: { basis: 'screen-pt', right: 0, down: 0 },
      released_at: { basis: 'screen-pt', right: 0, down: 0 },
      //position: { basis: 'screen-pt', right: 200, down: 300 },
      //delta: { basis: 'screen-vec', right: -2, down: 1 },
    },
    scene: {
      camera: {
        zoom: camera.zoom,
        position: { basis: 'world', ...ruf(camera.position) },
        children: {
          ndc: {
            children: {
              screen: {},
            }
          }
        },
      },
      lisp_3js: {children: {}},
      lisp_iter: {children: {}},
      shapes: {
        position: { basis: 'world', ...ruf(shapes.position) },
        children: {
          yellow_shape: {
            color: '0x999900', width: 2, height: 2,
            center: { basis: 'shapes', right: -1.75, up: 1.75, forward: -1 },
          },
          blue_shape: {
            color: '0x009999', width: 2, height: 2,
            center: { basis: 'shapes', right: 1.75, up: -3, forward: -1 },
          },
        }
      },
    },
    weather: 'cold',
    conclusion: null,
    finished: false,
    lisp_stuff: {
      type: 'apply',  proc_e: 'define',  args_e: {
        name: 'fac',
        value: {
          type: 'apply',  proc_e: 'lambda',  args_e: {
            pattern_e: { 1: 'n' },
            body_e: {
              1: {
                type: 'apply',  proc_e: {
                  type: 'dict',  entries: {
                    0: 1,  _: {
                      type: 'apply',  proc_e: 'sub',  args_e: {
                        1: 'fac',  2: {
                          type: 'apply',  proc_e: 'sub',  args_e: { 1: 'n', 2: 1 }
                        }
                      }
                    }
                  }
                },
                args_e: { 1: 'n' }
              }
            }
          }
        }
      }
    },
  });
  const instrs = map_get(ctx, 'instructions');
  map_set(ctx, 'next_instruction', 'ref', 'map', map_get(instrs, 'example_render', 'start'));
  //map_set(ctx, 'map', map_get(ctx, 'scene', 'shapes', 'children', 'blue_shape', 'position'));

  bases['world'] = { _3js_proxy: scene };
  map_get(ctx, 'scene', 'camera')._3js_proxy = camera;
  map_get(ctx, 'scene', 'shapes')._3js_proxy = shapes;
  map_get(ctx, 'scene', 'camera', 'children', 'ndc')._3js_proxy = ndc;
  map_get(ctx, 'scene', 'camera', 'children', 'ndc', 'children', 'screen')._3js_proxy = screen;
  sync_3js_proxy(bases['world'])('children', map_get(ctx, 'scene'));

  const cond_instrs = map_get(ctx, 'instructions', 'example_conditional');
  let common_exit = map_new({ map: map_get(cond_instrs, 'finish') });
  map_set(cond_instrs, 'branch1', 'warm', 'continue_to', common_exit);
  map_set(cond_instrs, 'branch1', 'cold', 'continue_to', common_exit);
  map_set(cond_instrs, 'branch1', '_', 'continue_to', common_exit);
  
  const rnd_instrs = map_get(ctx, 'instructions', 'example_render');
  common_exit = map_new({ map: map_get(rnd_instrs, 'render') });
  map_set(rnd_instrs, 'branch1', 0, 'continue_to', common_exit);
  map_set(rnd_instrs, 'branch1', 1, 'continue_to', common_exit);
  map_set(rnd_instrs, 'branch1', -1, map_get(rnd_instrs, 'branch1', 0));

  treeView.innerHTML = JSONTree.create(ctx, id_from_jsobj);
  //JSONTree.toggle(map_get(ctx, 'next_instruction', 'ref', 'map'));
  JSONTree.toggle(map_get(ctx, 'instructions', 'example_store_obj'));
  //JSONTree.toggle(map_get(ctx, 'lisp_stuff'));
  JSONTree.toggle(map_get(ctx, 'scene', 'shapes'));
  JSONTree.toggle(map_get(ctx, 'instructions', 'example_move_shape'));
  JSONTree.toggle(cond_instrs);
  JSONTree.toggle(map_get(cond_instrs, 'branch1', 'warm'));
  JSONTree.toggle(map_get(cond_instrs, 'branch1', 'cold'));
  JSONTree.toggle(map_get(cond_instrs, 'branch1', '_'));
  fetch();
}

function upd(o, ...args) {
  const v = args.pop();
  const k = args.pop();
  o = map_get(o, ...args);
  map_set(o, k, v);
  update_relevant_proxy_objs(o, k);
  JSONTree.update(o, k);
  if (v !== undefined)
    JSONTree.highlight('jstExternalChange', o, k);
  if (need_rerender) r();
  return v;
}

load_state();

// Recursive JS version
function tree_to_3js(node) { // TODO: layout
  if (typeof node === 'object') {
    const children = {};
    let tot_nlines = 0;
    map_iter(node, (key, val, i) => {
      const [val_3js, nlines] = tree_to_3js(val);
      tot_nlines++;
      children[i+1] = {
        top_left: {right: .2, up: -.3*tot_nlines}, text: key+':',
        children: val_3js
      };
      tot_nlines += nlines;
    });
    return [children, tot_nlines];
  } else
    return [{1: { top_left: {right: .75}, text: node }}, 0];
}
upd(ctx, 'src_tree', map_get(ctx, 'lisp_stuff', /*'args_e', 'value', 'args_e', 'body_e', 1, 'proc_e', 'entries', '_', 'args_e', 2, 'args_e'*/));
//upd(ctx, 'scene', 'lisp_3js', 'children', maps_init(tree_to_3js(map_get(ctx, 'src_tree'))[0]));

upd(ctx, 'scene', 'camera', 'position', map_new({basis: 'world', right: 1.01, up: -4.764}));
upd(ctx, 'scene', 'camera', 'zoom', .2147);

// Iterative tree-state JS version. TODO: translate to BL-asm!
stack = upd(ctx, 'stack', maps_init({
  1: {src_key: 'lisp_iter', nlines: 1, dst_key: 1}
}));
upd(ctx, 'stack', 1, 'src_val', map_get(ctx, 'src_tree'));
upd(ctx, 'stack', 1, 'dst_map', map_get(ctx, 'scene', 'lisp_iter', 'children'));
JSONTree.toggle(upd(ctx, 'padding', maps_init(
  {padding: {padding: {padding: 'padding'}}}
)));
JSONTree.toggle(stack);

curr_i = upd(ctx, 'stack_top', 1);
function conv_iter1() { //debugger;
  frame = map_get(stack, curr_i);
  key_r = map_get(frame, 'key_r');
  if (key_r === undefined) { // Render key part if not already done so.
    const voffs = curr_i > 1? map_get(stack, curr_i-1, 'nlines') * -.3 : 0;
    key_r = upd(frame, 'key_r', maps_init({
      text: map_get(frame, 'src_key')+':', top_left: {right: .2, up: voffs},
      children: {}
    }));
     // emit keypart render
    upd(map_get(frame, 'dst_map'), map_get(frame, 'dst_key'), key_r);
  }
  return conv_iter2;
}
/*
frame := stack[stack_top]  ;  l stack; d; s map; l stack_top; d; i; l map; d; s frame
key_r := frame.key_r      ;  l key_r; i; l map; d; s key_r
l conds; d; s map; l -1; s addend; l stack_top; d; +; s tmp; sign; i;
s source; l {}; store continue_to; l continue_to; d; s map; l map; s;
conds[-1] = conds[0] = l 0; s voffs
conds[1] = l -.3; s factor; l stack; d; s map; l tmp; d; i; l nlines; i;
           l map; d; *; s voffs
l { top_left: {right: .2}, children: {} }; s tmp; s map;
l top_left; i; l voffs; d; s source; l up; s;
l ':'; s addend; l frame; d; s map; l src_key; i; l map; d; +; s source;
l tmp; d; s map; l text; s
frame.key_r := key_r
frame.dst_map[frame.dst_key] := key_r
*/

function conv_iter2() { //debugger;
  curr_val = map_get(frame, 'src_val');
  if (typeof curr_val === 'object') {
    const entries = Object.entries(curr_val.entries);
    if (map_get(frame, 'entry_i') === undefined) upd(frame, 'entry_i', 0);
    const entry_i = map_get(frame, 'entry_i');
    if (entry_i < entries.length) {
      const [k, v] = entries[entry_i];
      const ch_frame = maps_init({ src_key: k, dst_key: entry_i+1, nlines: 1 });
      map_set(ch_frame, 'src_val', v);
      map_set(ch_frame, 'dst_map', map_get(key_r, 'children'));
      upd(frame, 'entry_i', entry_i+1);
      curr_i++; JSONTree.toggle(upd(stack, curr_i, ch_frame)); // push
      return conv_iter1;
    }
  } else {
    upd(key_r, 'children', 1, maps_init({ top_left: {right: .75}, text: curr_val }));
  }
  return conv_iter3;
}

function conv_iter3() { //debugger;
  upd(stack, curr_i, undefined); curr_i--; // pop
  if (curr_i > 0) {
    const parent_frame = map_get(stack, curr_i);
    upd(parent_frame, 'nlines', map_get(parent_frame, 'nlines')+map_get(frame, 'nlines'));
    return conv_iter1;
  }
}

f = conv_iter1;
//while (f) f=f();

// python3 -m cors-server

camera.position.z = 10;
r();
