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

yellow_shape = new e3.Mesh(geom, new e3.MeshBasicMaterial({ color: 0x999900, side: e3.DoubleSide }));
shapes.add(yellow_shape);
yellow_shape.translateX(-1.75); yellow_shape.translateY(1.75); yellow_shape.translateZ(-1);

blue_shape = new e3.Mesh(geom, new e3.MeshBasicMaterial({ color: 0x009999, side: e3.DoubleSide }));
shapes.add(blue_shape);
blue_shape.translateX(1.75); blue_shape.translateY(-3); blue_shape.translateZ(-1);

origin = new e3.Vector3();
dir = new e3.Vector3(1,0,0);
x_helper = new e3.ArrowHelper(dir, origin, 5/4, 0xff0000);
scene.add(x_helper);
dir = new e3.Vector3(0,1,0);
y_helper = new e3.ArrowHelper(dir, origin, 5/4, 0x00ff00);
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
        upd(ctx, 'scene', 'camera', 'position', map_new(ruf(camera.position)));
      }
    } else { // SMELL hapoc demo dependence
      const d = last_delta;
      const delta_shape = new e3.Vector4(d.x, d.y, 0, d.z).applyMatrix4(coordMatrixFromTo(screen, shapes));
      delta_shape.z = 0;
      if (selected_shape === ctx.scene.shapes.children.yellow_shape) { // ALL HORRIBLE
        yellow_shape.position.add(delta_shape);
        Object.assign(selected_shape.position, {
          right: yellow_shape.position.x.toPrecision(2), up: yellow_shape.position.y.toPrecision(2),
        });
        JSONTree.update(selected_shape, 'position');
        JSONTree.highlight('jstLastChange', selected_shape, 'position');
        r();
      }
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
  camera.position.add(delta);
  upd(ctx, 'scene', 'camera', 'position', map_new(ruf(camera.position)));

  e.preventDefault();
};

function r() {
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
}
function map_set_rel(o, ...args) {
  let k = args.shift(); const f = args.pop();
  args.forEach(a => { o = o.entries[k]; k = a; });
  o.entries[k] = f(o.entries[k]);
}
map_iter = (o, f) => Object.entries(o.entries).forEach(([k,v],i) => f(k,v,i));
map_num_entries = (o) => Object.keys(o.entries).length;
/*function map_new(o) {
  if (o === undefined) return {}; else return o;
}
function map_get(o, ...path) {
  path.forEach(k => o = o[k]); return o;
}
function map_set(o, ...args) {
  if (args.length === 1) { o[args[1]] = undefined; return; }
  let k = args.shift(); const v = args.pop();
  args.forEach(a => { o = o[k]; k = a; });
  o[k] = v;
}
function map_set_rel(o, ...args) {
  let k = args.shift(); const f = args.pop();
  args.forEach(a => { o = o[k]; k = a; });
  o[k] = f(o[k]);
}
map_iter = (o, f) => Object.entries(o).forEach(([k,v],i) => f(k,v,i));
map_num_entries = (o) => Object.keys(o).length;*/

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

function single_step() {
  const inst = map_get(ctx, 'next_instruction', 'value'); // i.e. Instruction Pointer
  // Cache values, before any modifications, for later
  const op       = map_get(inst, 'op');    // i.e. opcode
  const focus    = map_get(ctx, 'focus');  // i.e. accumulator / bottleneck / map key register
  const map      = map_get(ctx, 'map');    // i.e. "map to read to / write from" register
  const source   = map_get(ctx, 'source'); // i.e. register to copy to write destination
  const dest_reg = map_get(inst, 'register');

  map_set_rel(ctx, 'next_instruction', 'ref', 'key', v => v+1);

  // Modify state according to instruction
    // load: copy value to .focus register
  if      (op === 'load') {
    const value = map_get(inst, 'value');
    map_set(ctx, 'focus', typeof value === 'object' ? { ...value } : value);
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
  } // vsub: subtract vectors TODO smell
  else if (op === 'vsub') {
    const vf = map_get(ctx, 'vec_from');
    const vt = map_get(ctx, 'vec_to');
    if (map_get(vf, 'basis') !== map_get(vt, 'basis'))
      throw `TODO: convert one of ${vf.basis}, ${vt.basis} to match`;
    map_set(ctx, 'focus', map_new());
    map_iter(vf, (k,x) => { map_set(ctx, 'focus', k, map_get(vt, k) - x); });
    map_set(ctx, 'focus', 'basis', map_get(vf, 'basis')); // TODO: pt -> vec
  }
  else if (op === 'in') {
    if (map_get(inst, 'basis') !== 'world' || map_get(focus, 'basis') !== 'screen-pt')
      throw "TODO: only screen->world supported";
    const v = clientToWorld(new e3.Vector3(map_get(focus, 'right'), map_get(focus, 'down'), 0));
    map_set(ctx, 'focus', map_new({ basis: 'world-vec', ...ruf(v) }));
  } // no op field: assume nested instruction list
  else if (op === undefined) {
    const ref = map_get(ctx, 'next_instruction', 'ref');
    const prev_return_pt = map_get(ctx, 'return_to');
    map_set(ctx, 'return_to', map_new({ ...ref, next: prev_return_pt })); // Push current execution point
    map_set(ref, 'map', inst); map_set(ref, 'key', 1); // Dive in
  }

  fetch(); // This goes here in case the instruction changed next_instruction

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

sync_3js_children = (children) => (ch_name, child) => {
  const parent = children.isChildrenFor;
  map_iter(child, sync_3js_proxy(child));
  if (child._3js_proxy) {
    child._3js_proxy.name = ch_name; // set name in 3js
    parent._3js_proxy.add(child._3js_proxy); // <-- the syncing part
  }
}

square_geom = new e3.PlaneGeometry(1, 1);
need_rerender = false;

sync_3js_proxy = (obj) => (key, val) => {
  if (key === 'children') {
    val.isChildrenFor = obj;
    map_iter(val, sync_3js_children(val));
  } else if (key === 'color' && val !== undefined) {
    init_3js_mat(obj); obj._3js_mat.color.setHex(parseInt(val));
    obj._3js_mat.needsUpdate = true;
  } else if (key === 'width') { // TODO: rect ontologies
    init_3js_rect(obj); obj._3js_rect.scale.x = val;
  } else if (key === 'height') {
    init_3js_rect(obj); obj._3js_rect.scale.y = val;
  } else if (key === 'zoom' && obj._3js_proxy.isCamera) {
    obj._3js_proxy.zoom = val;
    camera.updateProjectionMatrix();
    ndc.matrix.copy(camera.projectionMatrixInverse);
  } else if (key === 'top_left' || key === 'position') {
    val.isPositionFor = obj._3js_proxy;
    map_iter(val, sync_3js_pos(val));
  }
  need_rerender = true;
}

function init_3js_mat(obj) {
  if (obj._3js_mat === undefined)
    obj._3js_mat = new e3.MeshBasicMaterial({ color: 0xff00ff, side: e3.DoubleSide });
}

function init_3js_rect(obj) {
  if (obj._3js_proxy === undefined) {
    obj._3js_proxy = new e3.Group();
    init_3js_mat(obj); obj._3js_rect = new e3.Mesh(square_geom, mat);
    obj._3js_proxy.add(obj._3js_rect);
    map_set(obj, 'width', 1); map_set(obj, 'height', 1);
    const {x, y, z} = obj._3js_proxy.position;
    const top_left = map_new({ right: x, up: y, forward: z });
    top_left.isPositionFor = obj._3js_proxy;
    map_set(obj, 'top_left', top_left);
  }
}

sync_3js_pos = (obj) => (key, val) => {
  let k = { right: 'x', up: 'y', forward: 'z' }[key];
  if (k === undefined) k = key;
  obj.isPositionFor.position[k] = val;
  need_rerender = true;
}

function run_and_render(num_steps=1) {
  const in_order = [];
  for (let i=0; i<num_steps; i++) {
    const [id, key] = single_step()[0];
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

function typed(str) {
  if (str === '{}') return {};
  const n = +str;
  if (isNaN(n)) return str;
  else return n;
}

function assemble_code(blocks, obj={}, start_i=1) {
  let instructions = blocks.map(block => typeof block !== 'string' ? block :
    block.replaceAll('\n', '').split(';').map(s => {
      s = s.trim().split(' ');
      s[0] = s[0].toLowerCase();
           if (s[0] === 'l') return { op: 'load', value: typed(s[1]) };
      else if (s[0] === 's') return { op: 'store', register: s[1] };
      else if (s[0] === 'd') return { op: 'deref' };
      else if (s[0] === 'r') return { op: 'ref' };
      else if (s[0] === 'i') return { op: 'index' };
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
        { op: 'js', func: () => {
          const cp = camera.position;
          const ccp = map_get(ctx, 'scene', 'camera', 'position');
          map_set(ccp, 'right', cp.x);
          map_set(ccp, 'up', cp.y);
          map_set(ccp, 'forward', cp.z);
          JSONTree.update(map_get(ctx, 'scene', 'camera'), 'position');
        }},
        `l pointer; d; s map; l pressed_at; i; l map; d; s vec_from;
        l pointer; d; s map; l released_at; i; l map; d; s vec_to`,
        { op: 'vsub' }, { op: 'in', basis: 'world' },
        `s map; l 0; s source; l forward; s; l map; d; s vec_from;
        l scene; d; s map; l camera; i; l position; i; l map; d; s vec_to`,
        { op: 'vsub' },
        `s source; l scene; d; s map; l camera; i; l position; s`,
        { op: 'js', func: () => {
          const cp = camera.position;
          const ccp = map_get(ctx, 'scene', 'camera', 'position');
          cp.set(map_get(ccp, 'right'), map_get(ccp, 'up'), map_get(ccp, 'forward'));
          r();
        } },
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
      hapoc_demo: {
        1: { op: 'load', value: -3 },
        2: { op: 'store', register: 'source' },
        3: { op: 'load', value: 'right' },
        4: { op: 'store' },
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
        position: { ...ruf(camera.position) },
      },
      shapes: {
        position: { ...ruf(shapes.position) },
        children: {
          yellow_shape: {
            position: { ...ruf(yellow_shape.position) },
          },
          blue_shape: {
            position: { ...ruf(blue_shape.position) },
          },
        }
      }
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
  map_set(ctx, 'next_instruction', 'ref', 'map', map_get(instrs, 'hapoc_demo'));
  map_set(ctx, 'map', map_get(ctx, 'scene', 'shapes', 'children', 'blue_shape', 'position'));

  const ch = map_get(ctx, 'scene', 'shapes', 'children');
  ['yellow_shape', 'blue_shape'].forEach(name => {
    const s = map_get(ch, name, 'position');
    const j = window[name].position;
    map_set(s, 'right', j.x);
    map_set(s, 'up', j.y);
  });

  map_get(ctx, 'scene', 'camera')._3js_proxy = camera;
  map_get(ctx, 'scene', 'shapes')._3js_proxy = shapes;
  map_get(ctx, 'scene', 'shapes', 'children', 'yellow_shape')._3js_proxy = yellow_shape;
  map_get(ctx, 'scene', 'shapes', 'children', 'blue_shape')._3js_proxy = blue_shape;
  sync_3js_proxy({ _3js_proxy: scene })('children', map_get(ctx, 'scene'));

  const cond_instrs = map_get(ctx, 'instructions', 'example_conditional');
  const common_exit = map_new({ map: map_get(cond_instrs, 'finish') });
  map_set(cond_instrs, 'branch1', 'warm', 'continue_to', common_exit);
  map_set(cond_instrs, 'branch1', 'cold', 'continue_to', common_exit);
  map_set(cond_instrs, 'branch1', '_', 'continue_to', common_exit);

  treeView.innerHTML = JSONTree.create(ctx, id_from_jsobj);
  JSONTree.toggle(map_get(ctx, 'next_instruction', 'ref', 'map'));
  JSONTree.toggle(map_get(ctx, 'instructions', 'example_store_obj'));
  JSONTree.toggle(map_get(ctx, 'lisp_stuff'));
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
}

load_state();
