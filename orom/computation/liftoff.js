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
scene = new e3.Scene();
aspect = rw / rh;
camera = new e3.OrthographicCamera( -aspect, +aspect, +1, -1, 0, 1000);
scene.add(camera);

geom = new e3.PlaneGeometry(2, 2);
mat = new e3.MeshBasicMaterial({ color: 0xff00ff, side: e3.DoubleSide });
mesh = new e3.Mesh(geom, mat);
scene.add(mesh);
mesh.translateZ(-100);

function clientToWorld(v) {
  const center = new e3.Vector2(); renderer.getSize(center);
  const [xe, ye] = [center.x/2, center.y/2];
  // 2D hom z component encodes vec/pt distinction; promote to 3D w component
  // Pixels -> Normalized Device Coords
  const ndc = new e3.Vector4(v.x, v.y, 0, v.z).applyMatrix4(new e3.Matrix4().set(
    1/xe,     0, 0, -1,    // 0----xe--->..........
       0, -1/ye, 0, +1,    // |-------x------>
       0,     0, 0,  0,    // 0-----x/xe-----> = 1.5
       0,     0, 0,  1,    // |         |---->   1.5 - 1 = 0.5
  ));
  ndc.applyMatrix4(camera.projectionMatrixInverse); // NDC -> camera
  ndc.applyMatrix4(camera.matrixWorld); // camera -> world
  return ndc;
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
renderer.domElement.onmousedown = e => { is_dragging = true };
renderer.domElement.onmouseup   = e => { is_dragging = false };

last_pointer = undefined;
last_delta = new e3.Vector3();
renderer.domElement.onmousemove = e => {
  const curr = new e3.Vector3(e.clientX, e.clientY, 1);
  if (last_pointer !== undefined)
    last_delta.subVectors(curr, last_pointer);
  last_pointer = curr;

  if (is_dragging) {
    const delta_camera = clientToWorld(last_delta);
    delta_camera.z = 0;
    camera.position.sub(delta_camera);
    r();
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
39) l 1; s source; l 0; s; (42 uops)

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
  if (typeof(id) === 'number') {
    return jsobj_from_id.get(id);
  } else {
    const key = id.key;
    id = id.id; // lol
    return jsobj_from_id.get(id)[key];
  }
}

function single_step(do_render_tree) {
  const inst = ctx.next_instruction.value;
  // Cache values, before any modifications, for later
  const op       = inst.op;
  const focus    = ctx.focus;
  const map      = ctx.map;
  const source   = ctx.source;
  const dest_reg = inst.register;

  ctx.next_instruction.ref.key++;
  ctx.next_instruction.value = deref(ctx.next_instruction.ref);

  // Modify state according to instruction
    // load: copy value to .focus register
       if (op === 'load') ctx.focus = inst.value;
    // store: copy value in .focus to the given reg (if included)
    //        OR copy value in .source to .map[.focus] (if absent)
  else if (op === 'store') {
    if (inst.register === undefined) ctx.map[ctx.focus] = ctx.source;
    else ctx[inst.register] = ctx.focus;
    // deref: replace .focus with the value of the reg it references (if string)
  } //        OR with the object with the specified id (otherwise)
  else if (op === 'deref') {
    if (typeof(ctx.focus) === 'string') ctx.focus = ctx[ctx.focus];
    else ctx.focus = deref(ctx.focus);
  } // index: index the .map with .focus as the key, replacing .map
  else if (op === 'index') {
    ctx.map = ctx.map[ctx.focus];
  } // js: execute arbitrary JS code :P
  else if (op === 'js') inst.func(ctx);

  // Update visible tree
  if (do_render_tree) {
    let obj = ctx, key = 'focus'; // i.e. what changed?
    if (op === 'store')
      if (dest_reg === undefined) { obj = map; key = focus; }
      else key = dest_reg;
    else if (op === 'index') key = 'map';

    JSONTree.update(obj, key);
    JSONTree.update(ctx.next_instruction.ref, 'key');
    JSONTree.update(ctx.next_instruction, 'value');
    JSONTree.highlight('jstNextInstruction', ctx.next_instruction.value);
    JSONTree.highlight('jstLastChange', obj, key);
  }
}

function assemble_code(str) {
  const instructions = str.replaceAll('\n', '').split(';').map(s => {
    s = s.toLowerCase().trim().split(' ');
         if (s[0] === 'l') return { op: 'load', value: s[1] };
    else if (s[0] === 's') return { op: 'store', register: s[1] };
    else if (s[0] === 'd') return { op: 'deref' };
    else if (s[0] === 'i') return { op: 'index' };
    else return;
  });
  const o = {};
  instructions.forEach((inst,n) => { o[n+1] = inst; });
  return o;
}

function example_store_obj() {
  ctx = new_map({
    next_instruction: null,
    focus: null,
    map: null,
    source: null,
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
    // Set lisp_stuff.args_e.value.args_e.body_e.1.type = foobar
    instructions: new_map(assemble_code(
      'l lisp_stuff; d; s map; l args_e; i; l value; i; l args_e; i;'
      + 'l body_e; i; l 1; i; l foobar; s source; l type; s'
    )),
  });

  ctx.next_instruction = {
    ref: { id: id_from_jsobj.get(ctx.instructions), key: 1 },
  };
  ctx.next_instruction.value = deref(ctx.next_instruction.ref);

  treeView.innerHTML = JSONTree.create(ctx/*{
    foo: {
      bar: 'foobar', baz: 'foobaz',
      qux: { 1: { foobar: 'bar', foobaz: 'baz' } }
    },
    bar: {
      1: {foo: 'barfoo'},
      2: {qux: null}
    },
    qux: { 1: 'foo', 2: 'bar', 3: 'foobar' },
    baz: true,
    foobar: {1: 1, 2: 2, 3: 3}
  }*/, id_from_jsobj);
  JSONTree.highlight('jstNextInstruction', ctx.next_instruction.value);
}

function example_move_shape() {
  ctx = new_map({
    next_instruction: null,
    focus: null,
    map: null,
    source: null,
    pointer: {
      position: { basis: 'screen-pt', right: 200, down: 300 },
      delta: { basis: 'screen-vec', right: -2, down: 1 },
    },
    camera: {
      position: { basis: 'world-pt', right: 1, up: 2, forward: 3 }
    },
    // ???
    instructions: new_map({}),
  });

  ctx.next_instruction = {
    ref: { id: id_from_jsobj.get(ctx.instructions), key: 1 },
  };
  ctx.next_instruction.value = deref(ctx.next_instruction.ref);

  treeView.innerHTML = JSONTree.create(ctx, id_from_jsobj);
  JSONTree.highlight('jstNextInstruction', ctx.next_instruction.value);
}

example_store_obj();
