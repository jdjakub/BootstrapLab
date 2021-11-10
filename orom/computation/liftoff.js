DEBUG = () => { debugger; };
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
camera.name = 'camera'; scene.add(camera);

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

/*
proxies = new Map();
const unit_plane_geom = new e3.PlaneGeometry(1,1);

function obj3d_proxy(obj_name, obj3d, map) {
  if (obj3d === undefined) {
    return new e3.Mesh();
  }
  proxies.set(map, (key, val) => {
    if (key === 'children') {
      if (typeof val === 'object') proxies.set(val, (ch_name, child)) => {
        obj3d.add(obj3d_proxy(ch_name, child));
      }
      else proxies.delete(map[key]);
    }
  });
}

scene_proxy = map => obj3d_proxy('scene', scene, map);
*/

function leastCommonAncestor(_3obj1, _3obj2) {
  const nodes = [_3obj1, _3obj2];
  const opp = x => 1-x; // 0 <-> 1
  const visited = [new Set([_3obj1]), new Set([_3obj2])];
  let curr = 0;
  while (!visited[opp(curr)].has(nodes[curr])) { // current node not in other set
    visited[curr].add(nodes[curr]); // mark current node as visited
    const parent = nodes[curr].parent;
    if (parent !== null) nodes[curr] = parent; // climb up
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


is_dragging = false;
// Warning: forward refs to tree stuff
renderer.domElement.onmousedown = e => {
  is_dragging = true;
  if (ctx.pointer === undefined || !ctx.dragging_in_system) return; // Smell: demo-dependence
  const tmp = ctx.pointer.pressed_at; tmp.right = e.clientX; tmp.down = e.clientY;
  JSONTree.update(ctx.pointer, 'pressed_at');
  JSONTree.highlight('jstExternalChange', tmp);
};
renderer.domElement.onmouseup = e => {
  is_dragging = false
  if (ctx.pointer === undefined || !ctx.dragging_in_system) return; // Smell: demo-dependence
  const tmp = ctx.pointer.released_at; tmp.right = e.clientX; tmp.down = e.clientY;
  JSONTree.update(ctx.pointer, 'released_at');
  JSONTree.highlight('jstExternalChange', tmp);
};

last_pointer = undefined;
last_delta = new e3.Vector3();
renderer.domElement.onmousemove = e => {
  const curr = new e3.Vector3(e.clientX, e.clientY, 1);
  if (last_pointer !== undefined)
    last_delta.subVectors(curr, last_pointer);
  last_pointer = curr;

  if (is_dragging) {
    const selected_shape = ctx.selected_shape;
    if (selected_shape === undefined) {
      const delta_camera = clientToWorld(last_delta);
      delta_camera.z = 0;
      if (!ctx.dragging_in_system) {
        camera.position.sub(delta_camera);
        r();
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

/*
curr := { basis: screen, 0: 1, 1: e.clientX, 2: e.clientY } # assembles to:
main:
 1) l {}; s map2;
 3) l e; d; s map; l clientX; i; l map; d; s source; l map2; d; s map; l 1; s;
16) l map; d; s map2;
18) l e; d; s map; l clientY; i; l map; d; s source; l map2; d; s map; l 2; s;
31) l screen; s source; l basis; s;
35) l 1; s source; l 0; s;
39) l 1; s source; l 0; s; (42 uops) // was this a dupe by mistake?

      focus := regS  ===>  load regS; deref
       regD := regS  ===>  focus := regS; store regD
 regM[regK] := regS  ===>  map := regM; source := regS; focus := regK; store
 regD := reg0.a.b.c  ===>  map := reg0; load a; index; load b; index; load c; index; regD := map

tmp := { key: 1 }
tmp.id = last_pointer thru
  undefined: ref
    last_delta := curr - last_pointer
    jump to rejoin
  _: ref @rejoin

tmp := {}; tmp.key := 1;
tmp.id := {undefined: { id: @branch }, _: { id: @rejoin }};
tmp.id := tmp.id[last_pointer];
next_instruction := tmp;

 1) l {}; s map; l @branch; s source; l id; s; l map; d; s map2;
10) l {}; s map; l @rejoin; s source; l id; s; l map; d; s source;
19) l {}; s map; l _; s; l map2; d; s source; l undefined; s;
28) l last_pointer; d; i; l map; d; s source;
34) l {}; s map; l id; s; l 1; s source; l key; s;
42) l map; d; s next_instruction; (44 uops)

rejoin:
last_pointer := curr

next_instruction :=
  key: 1
  id: is_dragging thru
    false: ref @rejoin2
    true: ref
      delta_camera := last_delta in world
      delta_camera.3 := 0
      camera.position.sub(delta_camera)
      r()
      jump to rejoin2
*/

zoom_per_pixel = 0.95; // Every px of scroll shrinks view window to 95%

renderer.domElement.onwheel = e => {
  if (e.deltaMode !== WheelEvent.DOM_DELTA_PIXEL) return;
  const focus_px = new e3.Vector3(e.clientX, e.clientY, 1);
  let focus = clientToWorld(focus_px);
  focus = new e3.Vector4(focus.x, focus.y, 0, 1);
  const new_focus = focus.clone().applyMatrix4(camera.matrixWorldInverse);

  const change_factor = e.deltaY > 0 ? 1/zoom_per_pixel : zoom_per_pixel;
  camera.zoom *= change_factor;
  new_focus.divideScalar(change_factor); new_focus.w = 1;
  new_focus.applyMatrix4(camera.matrixWorld);

  const delta = focus.clone().sub(new_focus);
  camera.position.add(delta);
  camera.updateProjectionMatrix();
  ndc.matrix.copy(camera.projectionMatrixInverse);
  r();

  e.preventDefault();
};

function r() {
  renderer.render(scene, camera);
}

r();

next_id = 0;
jsobj_from_id = new Map();
id_from_jsobj = new Map();

// In-universe, we call objs / dicts "maps"
function new_map(map) {
  const id = next_id++;
  jsobj_from_id.set(id, map);
  id_from_jsobj.set(map, id);
  return map;
}

ctx = {};

treeView = document.getElementById('treeview');
document.body.appendChild(treeView); // So that it's last

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
    if (!id_from_jsobj.has(obj)) new_map(obj);
    return { id: id_from_jsobj.get(obj) };
  } else return null;
}

function fetch() {
  const ref = ctx.next_instruction.ref;
  let next_inst = ref.map[ref.key];
  if (next_inst === undefined) {
    let continue_to = ref.map.continue_to; // check current block's continue addr
    if (!continue_to) continue_to = ctx.continue_to; // fall back to register
    if (continue_to) {
      if (continue_to.map) {
        ref.map = continue_to.map;
        JSONTree.update(ctx.next_instruction.ref, 'map');
      }
      if (continue_to.key) ref.key = continue_to.key;
      else ref.key = 1; // beginning of new basic block
    } else { // check return_to SMELL just do this with continue_to?
      const return_to = ctx.return_to;
      if (return_to) { // pop and restore prev execution point
        ref.map = return_to.map; ref.key = return_to.key;
        ctx.return_to = return_to.next;
        JSONTree.update(ref, 'map');
        JSONTree.update(ctx, 'return_to');
      }
    }
    next_inst = ref.map[ref.key];
  }
  ctx.next_instruction.value = next_inst;

  // Duped from run_and_render
  JSONTree.update(ctx.next_instruction.ref, 'key');
  JSONTree.update(ctx.next_instruction, 'value');
  JSONTree.highlight('jstNextInstruction', ctx.next_instruction.value);
}

function single_step() {
  const inst = ctx.next_instruction.value; // i.e. Instruction Pointer
  // Cache values, before any modifications, for later
  const op       = inst.op;    // i.e. opcode
  const focus    = ctx.focus;  // i.e. accumulator / bottleneck / map key register
  const map      = ctx.map;    // i.e. "map to read to / write from" register
  const source   = ctx.source; // i.e. register to copy to write destination
  const dest_reg = inst.register;

  ctx.next_instruction.ref.key++;

  // Modify state according to instruction
    // load: copy value to .focus register
  if      (op === 'load') {
    ctx.focus = typeof inst.value === 'object' ? { ...inst.value } : inst.value;
    // store: copy value in .focus to the given reg (if included)
  } //        OR copy value in .source to .map[.focus] (if absent)
  else if (op === 'store') {
    if (inst.register === undefined) {
      ctx.map[ctx.focus] = ctx.source;
      // HORRIBLE SMELL hapoc demo dependence
      if (ctx.scene && ctx.map === ctx.scene.shapes.children.blue_shape.position) {
        blue_shape.position.x = ctx.source; r();
      }
    } else ctx[inst.register] = ctx.focus;
    // deref: replace .focus with the value of the reg it references (if string)
  } //        OR with the object with the specified id (otherwise)
  else if (op === 'deref') {
    if (typeof ctx.focus === 'string') ctx.focus = ctx[ctx.focus];
    else ctx.focus = deref(ctx.focus);
  } // ref: replace .focus with the wrapped ID of the object in .map, or null
  else if (op === 'ref') {
    ctx.focus = ref(ctx.map);
  } // index: index the .map with .focus as the key, replacing .map
  else if (op === 'index') {
    let tmp = ctx.map[ctx.focus];
    // Maps can include the _ key as "default", "else" or "otherwise"
    if (tmp === undefined) tmp = ctx.map._; // TODO smell: risky?
    ctx.map = tmp;
  } // js: execute arbitrary JS code :P TODO return changeset
  else if (op === 'js') {
    inst.func(inst);
  } // vsub: subtract vectors TODO smell
  else if (op === 'vsub') {
    const vf = ctx.vec_from;
    const vt = ctx.vec_to;
    if (!vf.basis === vt.basis) throw `TODO: convert one of ${vf.basis}, ${vt.basis} to match`;
    ctx.focus = {};
    Object.keys(vf).forEach(k => { ctx.focus[k] = vt[k] - vf[k]; });
    ctx.focus.basis = vf.basis; // TODO: pt -> vec
  }
  else if (op === 'in') {
    if (inst.basis !== 'world' || focus.basis !== 'screen-pt') throw "TODO: only screen->world supported";
    const v = clientToWorld(new e3.Vector3(focus.right, focus.down, 0));
    ctx.focus = { basis: 'world-vec', right: v.x, up: v.y, forward: v.z };
  } // no op field: assume nested instruction list
  else if (op === undefined) {
    const ref = ctx.next_instruction.ref;
    const prev_return_pt = ctx.return_to;
    ctx.return_to = { ...ref, next: prev_return_pt }; // Push current execution point
    ref.map = inst; ref.key = 1; // Dive in
  }

  fetch(); // This goes here in case the instruction changed next_instruction

  let obj = ctx, key = 'focus'; // i.e. what changed?
  if (op === 'store')
    if (dest_reg === undefined) { obj = map; key = focus; }
    else key = dest_reg;
  else if (op === 'index') key = 'map';
  else if (op === undefined) key = 'return_to';

  // Check if the map being changed is a proxy for some JS thing
  update_relevant_proxy_objs(obj, key);

  // Return changeset
  return [
    [obj, key], [ctx.next_instruction.ref, 'key'], [ctx.next_instruction, 'value']
  ].map(([o, k]) => [ref(o).id, k]);
}

function update_relevant_proxy_objs(obj, key) {

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
  JSONTree.update(ctx.next_instruction.ref, 'key');
  JSONTree.update(ctx.next_instruction, 'value');
  JSONTree.highlight('jstNextInstruction', ctx.next_instruction.value);
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
      else return;
    })
  );
  instructions = instructions.flat();
  instructions.forEach((inst,n) => { obj[start_i+n] = inst; });
  return obj;
}

function load_state() {
  ctx = new_map({
    next_instruction: null,
    continue_to: null,
    focus: null,
    map: null,
    vec_from: null,
    vec_to: null,
    source: null,
    instructions: {
      // Set lisp_stuff.args_e.value.args_e.body_e.1.type = foobar
      example_store_obj: new_map({
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
      }),
      /* last_delta = pointer.(released_at - pressed_at)
       * camera.position.sub(last_delta in world with z=0)
       * ---
       * vec_from := pointer.pressed_at; vec_to := pointer.released_at;
       * sub; in world; focus.forward := 0; s vec_from; vec_to := camera.position;
       * sub; camera.position := focus
       */
      example_move_shape: new_map(assemble_code([
        { op: 'js', func: () => {
          const cp = camera.position;
          const ccp = ctx.scene.camera.position;
          ccp.right = cp.x; ccp.up = cp.y; ccp.forward = cp.z;
          JSONTree.update(ctx.scene.camera, 'position');
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
          const ccp = ctx.scene.camera.position;
          cp.set(ccp.right, ccp.up, ccp.forward);
          r();
        } },
      ])),
      // Set .conclusion based on .weather, and then mark .finished
      example_conditional: {
        start: new_map(assemble_code([
          'l instructions; d; s map; l example_conditional; i; l branch1; i; l weather; d; i;' +
          'l map; d; s source', { op: 'load', value: { map: null } },
          's map; l map; s; d; s continue_to' // essentially, conditional jump = 9 uops
        ])),
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
    selected_shape: null,
    dragging_in_system: false,
    pointer: {
      pressed_at: { basis: 'screen-pt', right: 0, down: 0 },
      released_at: { basis: 'screen-pt', right: 0, down: 0 },
      //position: { basis: 'screen-pt', right: 200, down: 300 },
      //delta: { basis: 'screen-vec', right: -2, down: 1 },
    },
    camera: {
      position: { basis: 'world-pt', right: 1, up: 2, forward: 3 }
    },
    scene: {
      camera: {
        position: { basis: 'world-pt', right: 0, up: 0, forward: 0 },
      },
      shapes: {
        children: {
          yellow_shape: {
            position: { basis: 'shapes-pt', right: 0, up: 0, forward: 0 },
          },
          blue_shape: {
            position: { basis: 'shapes-pt', right: 0, up: 0, forward: 0 },
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
  const instrs = ctx.instructions;
  ctx.next_instruction = { ref: { map: instrs.hapoc_demo, key: 1 } };
  ctx.map = ctx.scene.shapes.children.blue_shape.position;

  const ch = ctx.scene.shapes.children;
  ['yellow_shape', 'blue_shape'].forEach(name => {
    const s = ch[name].position;
    const j = window[name].position;
    s.right = j.x.toPrecision(2);
    s.up = j.y.toPrecision(2);
  });

  const cond_instrs = ctx.instructions.example_conditional;
  const common_exit = { map: cond_instrs.finish };
  cond_instrs.branch1.warm.continue_to = common_exit;
  cond_instrs.branch1.cold.continue_to = common_exit;
  cond_instrs.branch1._.continue_to = common_exit;

  treeView.innerHTML = JSONTree.create(ctx, id_from_jsobj);
  JSONTree.toggle(ctx.next_instruction.ref.map);
  JSONTree.toggle(ctx.instructions.example_store_obj);
  JSONTree.toggle(ctx.lisp_stuff);
  JSONTree.toggle(ctx.instructions.example_move_shape);
  JSONTree.toggle(cond_instrs);
  JSONTree.toggle(cond_instrs.branch1.warm);
  JSONTree.toggle(cond_instrs.branch1.cold);
  JSONTree.toggle(cond_instrs.branch1._);
  fetch();
}

function upd(o, k, v) {
  o[k] = v;
  JSONTree.update(o, k);
  if (v !== undefined)
    JSONTree.highlight('jstLastChange', o, k);
}

load_state();
