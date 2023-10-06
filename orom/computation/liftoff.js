/*
 * Q: Why is everything in one file?
 * A: For building a self-sustainable system, the pressure to move stuff in-system
 *    is well-served this way. This file is too long; this is an honest, unignorable
 *    signal about the early state of implementation of the system. It would be worse
 *    to hide it.
 */

/*
 * ### EASY-TO-TYPE UTILITIES
 * For use in the JS console.
*/
// For entering the debugger in a JS console statement. Add it as a dummy param
// or use it to wrap a param in a function call so it evaluates first.
// E.g: I want to step through the execution of `foo(1, 2, 3)`.
// So I put: `foo(1, 2, DEBUG(3))` or `foo(1, 2, 3, DEBUG())`.
DEBUG = (x) => { debugger; return x; };
// `last([1,2,3])` = 3, `last([1,2,3], 2)` = 2
last = (arr, n) => arr[arr.length-(n || 1)];
// Interpose anywhere in an expression to transparently probe its value.
// E.g. `foo(1, bar(x)*baz(y))` - I wonder what the 2nd argument is.
// So I put: `foo(1, log(bar(x)*baz(y)))`
log = (...args) => { console.log(...args); return last(args); };
// Render a THREE.js matrix in a non-stupid way
function forMat4(m) {
  const s = m.elements.map(n => n.toPrecision(2));
  return [
    [s[0], s[4], s[8],  s[12]].join('\t'),
    [s[1], s[5], s[9],  s[13]].join('\t'),
    [s[2], s[6], s[10], s[14]].join('\t'),
    [s[3], s[7], s[11], s[15]].join('\t'),
  ].join('\n');
}
/* ### EXPLICIT AXIS NAMES
 * Opinion: calling things x, y, z or 0, 1, 2 is a terrible norm.
 * These symbols have little stable meaning:
 * - x in 2D and 3D usually means the rightward direction.
 * - y in 2D can be up or down. In 3D it can be those OR forward/backward!
 * - z in 3D can be forward, backward, up...
 *
 * The result is trial-and-error graphics coding, puzzling reflections and
 * rotations, and it's completely unnecessary. When we additionally make this
 * dependent on the *order* they are stored in, we are just asking for trouble.
 *
 * Better: just be explicit about the intended direction.
 * In an ideal system, you can express coordinates however is convenient using
 * the words left, right, up, down, forward, backward, or abbreviations thereof.
 * The system knows which are opposites and when to internally flip signs.
 *
 * BootstrapLab does not yet have that capability, but we do use the names
 * right, up, forward.
 */
// Stringify a negative quantity as left/down, right/up otherwise.
lr = n => n.toPrecision(2) + (n < 0 ? ' left' : ' right');
ud = n => n.toPrecision(2) + (n < 0 ? ' down' : ' up');
// Convert between BL vecs and THREE.js vecs according to the likely convention
xyz = (o) => new e3.Vector3(o.right, o.up, o.forward);
ruf = (o) => ({ right: o.x, up: o.y, forward: o.z });
// THREE takes way too long to type in the console for every API object. Ideally
// we would type 3 but that is a number literal. The `e` key is closest to 3 so
// this is the next best option.
e3 = THREE;

/* ### THREE.js BOILERPLATE */
// Goal: call `renderer.render(scene, camera)` to see what the camera sees.
// We need a renderer:
renderer = new e3.WebGLRenderer({ antialias: true });
// The render creates its own `<canvas>` element which needs attaching:
document.body.appendChild(renderer.domElement);
// Fill the available area:
renderer.domElement.style.display = 'inline-block';
const [rw, rh] = [window.innerWidth*.50, window.innerHeight*.99];
renderer.setSize(rw, rh);
const DPR = window.devicePixelRatio || 1;
renderer.setPixelRatio(DPR); // Take advantage of my Mac retina display
scene = new e3.Scene(); scene.name = 'world'; // Named coord systems
aspect = rw / rh;
// We need a 2D (ortho) camera:   (    left,   right, up, down, near, far )
camera = new e3.OrthographicCamera( -aspect, +aspect, +1,   -1,    0, 1000);
//camera.name = 'camera'; scene.add(camera);
// ^ We'd normally add the camera like this, but for BL we'll connect it as the
// 3js proxy for the in-system `camera` map. Our substrate will then add it to
// the scene.

// JARGON: A "map" is a key-value dictionary, the basic structuring unit of
// the in-system state.

// Create a 2x2 magenta square, which we'll later add to the scene
geom = new e3.PlaneGeometry(2, 2);
mat = new e3.MeshBasicMaterial({ color: 0x770077, side: e3.DoubleSide });
// Create a coordinate system called "shapes"
shapes = new e3.Group();//e3.Mesh(geom, mat); DEMO
shapes.name = 'shapes'; scene.add(shapes);
shapes.translateZ(-100); // Make sure it's moved in front of the camera

// Set up some coloured arrows for the world axes.
origin = new e3.Vector3();
dir = new e3.Vector3(1,0,0);
// So we can see where the axis called "x" ends up pointing:
x_helper = new e3.ArrowHelper(dir, origin, 1, 0xff0000);
scene.add(x_helper);
dir = new e3.Vector3(0,1,0);
// Ditto for "y":
y_helper = new e3.ArrowHelper(dir, origin, 1, 0x00ff00);
scene.add(y_helper);

/* ### AUTO COORD SYSTEM CONVERSIONS
 * Programmers should *never* have to do matrix mathematics ourselves. We
 * should be able to refer to named coordinate frames and express vectors as
 * convenient. Operations between vectors should convert automatically.
 */

// Given two 3js objects in the same scene tree, traverse their parents until
// encountering the same node. This common ancestor can then be used for coord
// conversions.
function leastCommonAncestor(_3obj1, _3obj2) {
  // We're going to alternate between the two, climbing one parent at a time
  const nodes = [_3obj1, _3obj2]; // Start at the roots
  const opp = x => 1-x; // Gives the "other" node's array index (0 <-> 1)
  // We will track which nodes have been visited from each root
  const visited = [new Set([_3obj1]), new Set([_3obj2])]; // Roots visited!
  let curr = 0; // opp(curr) indexes the "other" node in the pair
  // If the current node hasn't been visited from the other root...
  while (!visited[opp(curr)].has(nodes[curr])) {
    visited[curr].add(nodes[curr]); // First, we've just visited it
    const parent = nodes[curr].parent;
    if (parent !== null) nodes[curr] = parent; // Climb up if there's a parent
    else if (nodes[opp(curr)].parent === null) // If neither have parents
      if (nodes[0] === nodes[1]) return nodes[0]; // Top of tree? OK
      else throw ["Coord frames live in disjoint trees: ", _3obj1.name, _3obj2.name];
    curr = opp(curr); // Alternate between the two paths
  }
  // Here, the current node has already been visited on the other path
  return nodes[curr]; // So return this ancestor
}

// Obtain the matrix that will take components in frame A, and transform them
// into components in frame E, such that they represent the same vector.
function coordMatrixFromTo(from3obj /* A */, to3obj /* E */) {
  // Matrices operate on the RHS, so we want M such that e = M a
  // We can expand M notationally as follows: e = [E <- A] a
  // Reading backwards: a through [A -> E] = e
  // And [A -> E] = [A->B][B->C][D->E] if there are intermediate B,C,D frames
  
  /*      C         We desire [E<-A] = [E<-D][D<-C][C<-B][B<-A]
   *  ↑  / \  ↓     In THREE.js, each node's `.matrix` "goes up", representing
   *    B   D       [local->parent] a.k.a. [parent<-local] coords
   *   /     \      So, writing M-inverse as M', [A->E] = A B D' E'
   *  A       E     So [E<-A] = E' D' B A = (E' D')(B A) = [DOWN] [UP]
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

/* ### MAKE THE DEFAULT COORDINATE FRAMES EXPLICIT */

// NORMALISED DEVICE COORDINATES: NDC. This is where we express 3D positions as
// proportions of the cubic view dimensions, where each axis goes from -1 to +1
// (or, sometimes, -0.5 to +0.5 so the total length is 1: watch out for that).
ndc = new e3.Object3D(); ndc.name = 'ndc';
camera.add(ndc); // NDC is inherently relative to the view i.e. camera
// In THREE.js, a camera's .projectionMatrix is [Camera -> NDC] so...
// Constraint: always NDC.matrix = camera.projectionMatrixInverse
ndc.matrix.copy(camera.projectionMatrixInverse);
// To maintain this equality, we'll need to sync whenever camera params change
// (e.g. when zooming)
ndc.matrixAutoUpdate = false; // 3JS please don't get in the way of that

// SCREEN SPACE: pixel units from the top-left corner. Child of NDC.
// x direction is the same, y has opposite sign: up in NDC, down in screen space
screen = new e3.Object3D(); screen.name = 'screen';
ndc.add(screen);
(() => { // JavaScript: establish a local variable context
  // JARGON: An *extent* is a half-width/half-height. It's useful because we
  // usually measure from centre, the notable exception being screen space.
  const [xe,ye] = [rw/2, rh/2];
  // Screen matrix: given top-left px coords, normalise and centre 'em.
  screen.matrix.set(       // Step-by-step, ignore matrix row correspondence:
    1/xe,     0, 0, -1,    // 0----xe--->..........       behold the x extent
       0, -1/ye, 0, +1,    // |-------x------>            behold the px x coord
       0,     0, 1,  0,    // 0-----x/xe-----> = 1.5        ...as % of x extent
       0,     0, 0,  1,    // |         |---->   1.5 - 1 = 0.5  ...as from 100%
  ); // So x -> e/xe - 1 and y -> -(y/ye - 1)
  screen.matrixAutoUpdate = false;
})();

// Given a Vector3 with components meant in currBasis, obtain a Vector4 with
// components meant in targBasis
function vecInBasis(v, isPoint, currBasis, targBasis) {
  return new e3.Vector4(v.x, v.y, v.z, isPoint? 1 : 0)
             .applyMatrix4(coordMatrixFromTo(currBasis, targBasis));
}

// Fossil function that used to be massive, now just an abbreviation.
// Takes event handler client (pixel) coords to world (scene) coords
function clientToWorld(v) {
  return new e3.Vector4(v.x, v.y, 0, v.z).applyMatrix4(coordMatrixFromTo(screen, scene));
}

/* Pseudocode for a machine-readable DSL for coord system specs.
 * org = origin, hw = half-width, hh = half-height

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

// Take a 3JS vec in some role (property name) and construct the appropriate BL
// map including the correct basis
function bl_vec_from_3js(_3obj, propName) {
  const vec = _3obj[propName];
  if (propName === 'position') {
    return map_new({ basis: _3obj.parent.name, ...ruf(vec) });
  }
}

/* ### EVENT HANDLERS / TREE EDITOR */
// Warning: forward refs to tree stuff
renderer.domElement.onmousedown = e => {
  // Make the fact that the button is down visible in-system
  // Global `ctx` is the entire in-system state graph
  // `upd()` updates a state path and updates the DOM state view
  upd(ctx, 'pointer', 'is_dragging', true);
  //if (!ctx.dragging_in_system) return; // Smell: demo-dependence
  const tmp = map_get(ctx, 'pointer', 'pressed_at');
  // Make where the button was pressed visible in-system
  // Unlike `upd()`, `map_set()` updates the state without graphical update
  map_set(tmp, 'right', e.clientX); map_set(tmp, 'down', e.clientY);
  JSONTree.update(ctx, 'pointer', 'pressed_at');
  JSONTree.highlight('jstExternalChange', tmp);
};

raycaster = new e3.Raycaster(); // For going px coords -> 3D object
renderer.domElement.onmouseup = e => {
  // Make this fact and where it occurred visible in-system
  const ptr = map_get(ctx, 'pointer');
  upd(ptr, 'is_dragging', false);
  //if (ctx.pointer === undefined || !ctx.dragging_in_system) return; // Smell: demo-dependence
  const tmp = map_get(ptr, 'released_at');
  map_set(tmp, 'right', e.clientX); map_set(tmp, 'down', e.clientY);
  JSONTree.update(ptr, 'released_at');
  JSONTree.highlight('jstExternalChange', tmp);
  
  // If the "drag" distance is small enough, count it as a click.
  const pressedX = map_get(ptr, 'pressed_at', 'right');
  const pressedY = map_get(ptr, 'pressed_at', 'down');
  const [dx,dy] = [e.clientX-pressedX, e.clientY-pressedY];
  if (dx*dx + dy*dy > 5) return;
  
  // Cast a ray through the clicked point
  const screen_v = new e3.Vector3(e.clientX, e.clientY, 0);
  const ndc_v = vecInBasis(screen_v, true, screen, ndc);
  raycaster.setFromCamera(ndc_v, camera);
  const isects = raycaster.intersectObjects(scene.children, true);
  if (isects.length !== 0) {
    // Time to expand/collapse tree editor nodes, select fields, etc.
    let scene_node, t;
    try {
      // We use Three Mesh UI (3mu) for text rendering. Empirically, the thing
      // we want is navigated to via the following:
      scene_node = isects[0].object.parent.parent.parent.userData.sceneNode;
      // This "scene node" is a map inside the special `scene` tree of the state.
      t = map_get(scene_node, 'text');
      if (t !== undefined) t = t + ''; // Ensure any `text` content is a string
    } catch (e) {} // If the navigation failed, move on
    if (scene_node) {
      // `currently_editing` is the BL top-level register for the current text
      // field, i.e. where keystrokes should be sent.
      let old = map_get(ctx, 'currently_editing');
      // Legacy: we used to store thunks in case they pointed higher up in the
      // tree, breaking the DOM tree view via cycles. No longer necessary but
      // some later code might still store thunks.
      if (typeof old === 'function') old = old();
      
      // If we'd already selected the scene node with a previous click, this
      // click will expand/collapse it... as long as it's a *key* node (with
      // text content that looks like `foo:`) instead of a value node
      if (t !== undefined && t.slice(-1) === ':' && old === scene_node)
        toggle_expand(scene_node);
      
      // If we're clicking on something else, select it and unselect the old one
      if (old !== scene_node) {
        if (old !== undefined) ed_unselect(old);
        ed_select(scene_node);
      }
    }
    return;
  }
  // Cmd+click should create a new map, but this functionality is incomplete.
  if (!e.metaKey) return;
  const world_v = vecInBasis(ndc_v, true, ndc, scene);
  // Currently we just create a key-value field in the world frame.
  upd(ctx, 'scene', 'edit_box', maps_init({
    text: 'key:', top_left: { right: world_v.x, up: world_v.y },
    children: { 1: {
      text: 'value', top_left: { right: 0.75 }
    }}
  }));
  // `nodes_to_bump` is a kludgy manual way to improve layout of text once it's
  // been rendered and we actually know how wide it is. Here we're just saying
  // these newly created text nodes should be "bumped" after the next render.
  nodes_to_bump.push(map_get(ctx, 'scene', 'edit_box'));
  upd(ctx, 'currently_editing', map_get(ctx, 'scene', 'edit_box'));
};

function ed_unselect(old) {
  // We expect its first child to be a rectangle, default zero opacity.
  try { upd(old, 'children', 1, 'opacity', undefined); } catch (e) {}
  // A text field is "fresh" if it's just appeared with the default placeholder
  // text. If the user clicks away, it will vanish.
  let isFresh = map_get(old, 'isFresh');
  // A tree node in the `scene` map looks like this:
  // text: 'myKey:'
  // top_left: { right: 0.2, up: -3.9 }
  // children:
  //    1:
  //       text: 'myValue'
  //       top_left: { right: 0.75 }, isFresh: false
  // `old` could be the key part or the value part. If the latter, we can
  // get the key part by going upwards in the tree.
  // (If `old` is `n.children.1`, `old.parent` is `n.children` and
  // `old.parent.parent` is `n`)
  const keyNode = map_get(old, 'children')? old : old.parent.parent;
  try {
    isFresh ||= map_get(old, 'children', 1, 'isFresh');
    // Now isFresh reflects whether the key OR the value is still fresh
    // (i.e. we're unselecting a new entry that hasn't been finished yet)
  } catch (e) {}
  if (isFresh) { // new mapentry - delete / make empty
    // We're unselecting a UI element for an entry that doesn't exist yet because
    // the key/value weren't finished, so get rid of it
    const [p, pk] = [keyNode.parent, keyNode.parent_key];
    if (pk == 1)
      // This "new entry" was the first in its parent; instead of deleting the new
      // entry we should replace it with the "(empty)" dummy marker
      ed_make_empty(keyNode);
    else {
      // Graphically move all lower entries one space higher
      displace_treeview(keyNode, -1);
      // Actually remove the temporary new entry
      upd(p, pk, undefined);
    }
  }
}

function ed_select(scene_node) {
  let key_node = scene_node;
  let focus;
  if (map_get(scene_node, 'dummy')) {
    // We're selecting an empty map, so immediately create a Fresh entry where the
    // key gets edited first
    const new_keyNode = maps_init({
      text: 'newKey:', top_left: {right: .2, up: -.3}, isFresh: true, editKey: true,
      children: {1: { top_left: {right: .75}, text: 'newValue', isFresh: true }}
    });
    // Replace the "(empty)" dummy with this
    upd(key_node.parent, key_node.parent_key, new_keyNode);
    // Prepare to udpate display and route typing to this node (`focus`)
    key_node = focus = new_keyNode;
  } else if (!map_get(scene_node, 'children')) {
    // We assume this is the value node, route typing to it
    key_node = scene_node.parent.parent; focus = scene_node;
    // Otherwise, if clicked on key node, route typing to value node
  } else focus = map_get(scene_node, 'children', 1);
  // Make these facts visible in-system
  upd(ctx, 'currently_editing', /*() => */key_node);
  if (focus) upd(focus, 'opacity', 1); // Highlight new focus
}

// Replace a key node with the (empty) dummy placeholder
function ed_make_empty(keyNode) {
  const newNode = maps_init({
    text: '(empty)', top_left: {right: .2, up: -.3}, dummy: true,
  });
  upd(keyNode.parent, keyNode.parent_key, newNode);
  return newNode;
}

// Display temporary newKey:newValue UI at a given scene tree address and
// vertical height within the parent.
function ed_make_new(map, key, up) {
  const new_keyNode = maps_init({
    text: 'newKey:', top_left: {right: .2, up}, isFresh: true, editKey: true,
    children: {1: { top_left: {right: .75}, text: 'newValue', isFresh: true }}
  });
  const old = map_get(map, key);
  upd(map, key, new_keyNode);
  // If we're not replacing any existing node, we need to displace/re-layout
  // lines further down. (Why the second condition???)
  if (old === undefined || map_get(old, 'top_left', 'up') === undefined)
    displace_treeview(map.parent, 1);
  return new_keyNode;
}

document.body.onkeydown = e => {
  let key_node = map_get(ctx, 'currently_editing');
  if (key_node === undefined) return;
  if (typeof key_node === 'function') key_node = key_node(); // un-thunk
  const children = map_get(key_node, 'children');
  let valueIsPrimitive = true;
  let focus = key_node, suffix = ':';
  // If focus is on an ordinary map entry, focus the value node
  if (!map_get(key_node, 'editKey') && !map_get(key_node, 'dummy')) {
    focus = map_get(children, 1); suffix = '';
    // If primitive, we'll edit the primitive value. Otherwise, we're editing
    // the entire list of children (e.g. to make it (empty) via backspace)
    valueIsPrimitive = map_get(focus, 'top_left', 'up') === undefined;
  }
  // Cache the current text content in focus, excluding :
  let oldContent = map_get(focus, 'text')+'';
  if (suffix === ':') oldContent = oldContent.slice(0, -1);
  
  let isBackspace = e.key === 'Backspace';
  let isChar = e.key.length === 1 && !e.metaKey && !map_get(focus, 'dummy');
  if (isBackspace || isChar) {
    /* TODO debug and fix this Masp for backspace
    upd(focus, 'text', oldContent); // ensure string
    upd(focus, 'suffix', suffix);
    upd(masp, 'initial_env', 'entries', 'self', focus);
    if (isChar) upd(masp, 'initial_env', 'entries', 'char', e.key);
    upd(masp, 'ctx', 'value', undefined);
    upd(masp, 'ctx', 'arg_i', undefined);
    const method = isBackspace ? 'backspace' : 'append';
    upd(masp, 'ctx', 'expr', map_get(ctx, 'textbox', method));
    masp_eval();
    if (isBackspace && map_get(masp, 'ctx', 'value') === 'unhandled') {*/
    if (map_get(focus, 'isFresh')) {
      // Clear newKey:/newValue: and begin typing
      upd(focus, 'text', (isChar ? e.key : '') + suffix);
      upd(focus, 'isFresh', undefined); // Mark no longer fresh
      // Append char / backspace as necessary
    } else upd(focus, 'text', (isBackspace ? oldContent.slice(0, -1)
                                           : oldContent+e.key) + suffix);
    // We're backspacing over an empty field
    if (isBackspace && oldContent.length === 0) {
      const siblings = key_node.parent;
      let index = key_node.parent_key|0;
      if (map_get(focus, 'dummy')) { // Focus is (empty)
        // Turn focus (back) into a prim value
        upd(children, focus.parent_key, maps_init({
          text: 'value', top_left: { right: 0.75 }, opacity: 1
        }));
        displace_treeview(key_node, -1);
      }
      // If old content was empty, delete entry
      if (oldContent.length === 0) {
        if (map_get(siblings, 2) === undefined) { // It's the sole entry
          const dummy_node = ed_make_empty(key_node); // Make it into (empty)
          const new_keyNode = dummy_node.parent.parent;
          upd(ctx, 'currently_editing', /*() => */new_keyNode);
        } else {
          // Highlight previous entry
          let prev_sibling = map_get(siblings, index-1);
          if (prev_sibling) ed_select(prev_sibling);
          // Remove entry from the listing
          upd(siblings, key_node.parent_key, undefined);
          let next_sibling = map_get(siblings, index+1);
          while (next_sibling) {
            // Renumber later siblings by one less
            upd(siblings, index+1, undefined);
            upd(siblings, index, next_sibling);
            const up = map_get(next_sibling, 'top_left', 'up');
            // And move them up one line graphically
            upd(next_sibling, 'top_left', 'up', up+.3);
            index++; next_sibling = map_get(siblings, index+1);
          }
          displace_treeview(siblings.parent, -1);
        }
        // Delete source state entry
        let map, key;
        try {
          key = map_get(key_node, 'text').slice(0, -1); // Remove trailing colon
          map = map_get(siblings.parent, 'source');
        } catch (e) {}
        if (map === undefined) map = ctx; // No source? Assume global
        if (key !== undefined) upd(map, key, undefined); // Do the delete
      }
    }
  } else if (e.key === 'Tab' || e.key === 'Enter') {
    e.preventDefault();
    if (map_get(focus, 'isFresh')) return; // Can't tab out of new mapentry
    upd(focus, 'opacity', undefined);
    if (suffix === ':') { // Committing key node...
      const child = map_get(children, 1);
      upd(key_node, 'editKey', undefined); // Advance to value node
      upd(child, 'opacity', 1);
      return;
    } else if (valueIsPrimitive) { // Commit the value
      let map, key;
      try {
        key = map_get(key_node, 'text').slice(0, -1);
        map = map_get(key_node.parent.parent, 'source');
      } catch (e) {}
      if (map === undefined) map = ctx;
      if (key !== undefined) {
        let value = map_new(); // If Enter, replace value node with new composite
        if (e.key === 'Tab') {
          value = map_get(focus, 'text');
          const numVal = Number.parseFloat(value);
          const boolVal = {true: true, false: false}[value];
          if (!value.startsWith('0x') && !Number.isNaN(numVal)) value = numVal;
          else if (boolVal !== undefined) value = boolVal;
          else if (value === 'null') value = null;
          //else if (value === 'undefined') value = undefined;
        }
        upd(map, key, value);
        // Commit value to underlying source
        if (e.key === 'Enter') upd(key_node, 'source', value);
      }
    }
    // Advance to next key
    if (e.key === 'Tab') {
      const next_index = (key_node.parent_key|0) + 1;
      let new_keyNode = map_get(key_node.parent, next_index);
      let new_focus;
      if (new_keyNode === undefined) { // We're on the last entry
        const vertical_start = map_get(key_node, 'top_left', 'up');
        // Insert next sibling at appropriate height
        const new_up = vertical_start -.3*measure_tree_height(key_node);
        new_keyNode = new_focus = ed_make_new(key_node.parent, next_index, new_up);
      } else new_focus = map_get(new_keyNode, 'children', 1); // Select value node
      upd(ctx, 'currently_editing', /*() => */new_keyNode);
      if (new_focus !== undefined) upd(new_focus, 'opacity', 1); // SMELL demo
    } else { // Enter
      const new_keyNode = ed_make_new(map_get(key_node, 'children'), 1, -.3);
      upd(ctx, 'currently_editing', /*() => */new_keyNode);
      upd(new_keyNode, 'opacity', 1);
    }
  } else return;
  e.preventDefault();
};

last_pointer = undefined; // Last pointer [x,y] to distinguish drag from click
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
      // dragging_in_system implements the following in ASM instead
      if (!map_get(ctx, 'dragging_in_system')) {
        // Move the camera view as if the world was dragged underneath
        camera.position.sub(delta_camera);
        // That updated the 3JS camera, now sync the in-system map to show it
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
  // new_focus is now in camera space.

  // Scroll up = zoom in, scroll down = zoom out.
  const change_factor = e.deltaY > 0 ? 1/zoom_per_pixel : zoom_per_pixel;
  camera.zoom *= change_factor;
  upd(ctx, 'scene', 'camera', 'zoom', camera.zoom);
  // Shrink the camera-space vector to land on the same point after the zoom
  new_focus.divideScalar(change_factor); new_focus.w = 1;
  new_focus.applyMatrix4(camera.matrixWorld);
  // new_focus is now in world space, and is some delta from the original focus

  const delta = focus.clone().sub(new_focus);
  delta.z = 0;
  camera.position.add(delta); // Shift camera by this delta
  upd(ctx, 'scene', 'camera', 'position', bl_vec_from_3js(camera, 'position'));

  e.preventDefault();
};

function r() {
  // Update any text graphics and then render via 3js
  ThreeMeshUI.update().then(() => {
    renderer.render(scene, camera);
    need_rerender = false;
  });
}

r();

/* ### ONTOLOGY OF STATE: MAPS
In-system, data is made of dictionaries called "maps" made of key-value pairs called
entries. It'd be nice to just use the JS object system, but we need to wrap it so we
can include metadata. E.g. if we want maps to have a "parent" property for an intrinsic
tree structure, we could reserve the user-level key "parent" but in general it's not
good to have reserved keys at the user level. No: the user should be able to have a
key called "parent" for their own purposes, while we put the metadata as properties
on the JS obj, where they belong.

Therefore in JS, a map looks like this:
{ parent: ..., metadata1: ..., metadataN: ..., entries: { k1: v1, k2: v2, ...} }

Curlies {} are for JS; we'll notate the in-system visible map structure as:

( k1: v1, k2: v2, ... )

Arrays do not appear in this schema. In-system, a list of items is just a map with
numerical keys: ( 1: ..., 2: ..., 3: ... )
*/

// Maintain a global reversible mapping between maps and their IDs
next_id = 0;
jsobj_from_id = new Map();
id_from_jsobj = new Map();

// deref(12) --> map#12
// deref({ id: 12, key: foo }) --> map#12[ 'foo' ]
function deref(id) {
  if (typeof id === 'number') {
    return jsobj_from_id.get(id);
  } else {
    const key = id.key;
    id = id.id; // lol
    return jsobj_from_id.get(id)[key];
  }
}

// ref({ ... }) => { id: 12 }
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

/*
Given a JS object tree, expand it in-place into a map tree. E.g.
{ foo: {bar: 1, baz: {}}} --> ( foo: (bar: 1, baz: ())) i.e.
{ entries: {
    foo: {
      entries: { bar: 1, baz: {
        entries: {}
      }}
    }
}}

This function is also used by the save/load mechanism. Because arrays don't have a role
in our schema, we re-purpose them to "label" maps to store a graph as a tree. E.g.
{ foo: { bar: 1, baz: [35, {}], quux: ['ref', 35] }}
gets expanded into a map, but also the {} map gets ID 35. On the fixup pass, the quux
entry gets pointed at map#35.
*/
function maps_init(o, refs) { // REWRITES o; Traverse TREE (no cycles!)
  if (typeof o !== 'object' || o === null) return o;
  let map = { entries: o };
  if (o instanceof Array) {
    const [id, obj] = o;
    if (typeof id !== 'number') return o; // preserve refs for subsequent fixup pass
    map.entries = obj; refs.set(id, map); // work on the obj defined within
  }
  map_iter(map, (k,v) => { map_set(map, k, maps_init(v, refs)); });
  return map;
}

// Resolve any ['ref', 35] instances
function maps_fixup(o, refs) {
  if (o instanceof Array && o[0] === 'ref') return refs.get(o[1]);
  else if (typeof o !== 'object' || o === null) return o;
  map_iter(o, (k,v) => { map_set(o, k, maps_fixup(v, refs)); });
  return o;
}

// Wrap a JSobj as a map. Warning: values must be primitives. For trees/graphs, use init
function map_new(o={}) {
  return { entries: o };
}

// m = map_init({one: {two: {three: 'done'}}});
// map_get(m, 'one', 'two', 'three') = 'done'
function map_get(o, ...path) {
  path.forEach(k => o = o.entries[k]); return o;
}

// Set a path to a value ... and update metadata
function map_set(o, ...args) {
  if (args.length === 1) { delete o.entries[args[0]]; return; }
  let k = args.shift(); const v = args.pop();
  args.forEach(a => { o = o.entries[k]; k = a; });
  const old = o.entries[k];
  if (typeof old === 'object' && old !== null && old !== v && old.parent === o) {
    old.parent = old.parent_key = undefined; // if overwriting a tree child, remove parent
  }
  if (v !== undefined) o.entries[k] = v; else delete o.entries[k];
  if (typeof v === 'object' && v !== null && v.parent === undefined) {
    v.parent = o; // first to reference v becomes its parent
    v.parent_key = k;
  }
  return v;
}

// Used to abbreviate a tedious construction e.g.
// my.very.long.path += 1
// map_set(map_get(my, 'very', 'long'), 'path', map_get(my, 'very', 'long', 'path')+1)
// map_set_rel(map_get(my, 'very', 'long'), 'path', x => x+1)
function map_set_rel(o, ...args) {
  const f = args.pop(), v = map_get(o, ...args);
  return map_set(o, ...args, f(v));
}

// Iterate through entries; f takes key, value, and index
map_iter = (o, f) => Object.entries(o.entries).forEach(([k,v],i) => v !== undefined ? f(k,v,i) : 0);
// How many entries in a map
map_num_entries = (o) => Object.keys(o.entries).length;

ctx = {}; // The global "context" forming the root of the in-system state

// HTML tree view of system state. "Temporary" in the long term
treeView = document.getElementById('treeview');
document.body.appendChild(treeView); // Guarantee it comes after whatever's already there

/* ### ONTOLOGY OF CHANGE: ASM INSTRUCTIONS
"registers" are top-level / global entries in `ctx`. Denoted as .reg to abbreviate ctx.reg
"instructions" are maps with an `op` entry (opcode / operation type) and relevant args.
 */

// Fetch next instruction and put it in register `next_instruction.value`.
function fetch_next() {
  const ref = map_get(ctx, 'next_instruction', 'ref'); // ( map: ..., key: ... )
  let next_inst = map_get(ref, 'map', map_get(ref, 'key')); // Resolve the ref
  // If that didn't work, we'll first need to get an alternative ref to resolve
  if (next_inst === undefined) {
    // This happens when, e.g. we've run off the end of a numerical list of instructions.
    // If the list contains a `continue_to` entry, we'll go there to the next basic block.
    let continue_to = map_get(ref, 'map', 'continue_to');
    if (!continue_to) // Otherwise, we'll fall back to the `continue_to` register...
      continue_to = map_get(ctx, 'continue_to'); 
    if (continue_to) {
      if (map_get(continue_to, 'map')) { // next_instruction.map := continue_to.map
        map_set(ref, 'map', map_get(continue_to, 'map'));
        JSONTree.update(map_get(ctx, 'next_instruction', 'ref'), 'map');
      } // next_instruction.key := continue_to.key
      if (map_get(continue_to, 'key')) map_set(ref, 'key', map_get(continue_to, 'key'));
      else map_set(ref, 'key', 1); // beginning of new basic block
    } else {
      // If there's no continue_to, we'll check for a `return_to` (procedure experiment)
      // SMELL just do this with continue_to?
      const return_to = map_get(ctx, 'return_to');
      if (return_to) { // Pop and restore prev execution point
        map_set(ref, 'map', map_get(return_to, 'map'));
        map_set(ref, 'key', map_get(return_to, 'key'));
        map_set(ctx, 'return_to', map_get(return_to, 'next'));
        JSONTree.update(ref, 'map');
        JSONTree.update(ctx, 'return_to');
      }
    }
    // Now we've finally decided on the address of the instruction to fetch, resolve it
    next_inst = map_get(ref, 'map', map_get(ref, 'key'));
  }
  // Do the final update
  map_set(ctx, 'next_instruction', 'value', next_inst);

  // Duped from run_and_render (update the tree view)
  JSONTree.update(map_get(ctx, 'next_instruction', 'ref'), 'key');
  JSONTree.update(map_get(ctx, 'next_instruction'), 'value');
  JSONTree.highlight('jstNextInstruction', map_get(ctx, 'next_instruction', 'value'));
}

// Deep copy object tree, leave other stuff referenced but not copied.
function clone(o) {
  if (typeof o === 'object') { // deep copy, intended for tree literals
    const o2 = {};
    Object.entries(o).forEach(([k, v]) => { o2[k] = clone(v); });
    return o2;
  } // CAUTION: won't work for Functions, DOM nodes etc.
  return o;
}

// Single-step: the basic decode-execute-fetch cycle of the system.
// nofetch: just execute, don't fetch something new afterwards.
// instr: if specified, will use this instead of whatever's in the usual location
//        (`next-instruction.value`)
let old_value = undefined; // In case a scene node with 3js proxy is overwritten!
function single_step(nofetch=false, instr=undefined) {
  let inst;
  if (instr === undefined)
    inst = map_get(ctx, 'next_instruction', 'value'); // i.e. Instruction Pointer
  else inst = instr;
  
  // Cache values, before any modifications, for later
  const op       = map_get(inst, 'op');    // i.e. opcode
  const focus    = map_get(ctx, 'focus');  // i.e. accumulator / bottleneck / map key register
  const map      = map_get(ctx, 'map');    // i.e. "map to read to / write from" register
  const source   = map_get(ctx, 'source'); // i.e. register to copy to write destination
  const basis    = map_get(ctx, 'basis');  // i.e. name of coords to convert to
  const dest_reg = map_get(inst, 'register');
  const do_break = map_get(inst, 'break'); // whether to pause execution after
  let continue_nested = false; // whether current 'instruction' contains instructions

  if (instr === undefined) // If executing in a list, increment within-list counter for later fetch
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
      old_value = map_get(map, focus); map_set(ctx, 'map', focus, source);
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
  } // order: access the order map for a map, i.e. its keys in order
  else if (op === 'order') {
    const o = {}; Object.keys(focus.entries).forEach((k, i) => { o[i+1] = k; });
    map_set(ctx, 'focus', map_new(o));
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
  }
  else if (op === 'typeof') {
    map_set(ctx, 'focus', typeof focus);
  }
  else if (op === 'copy') { // Macro expansion experiment: copy reg|path := reg|path
    // expand copy A.B.C := X.Y.Z -->
    // l X; d; s map; l Y; i; l Z; i; l map; d; s source;
    // l A; d; s map; l B; i; l C; s
    /*
    a.[b.[[[c]].typeof d].e].f
    1: a                       l a; d; s map
    2: deref:                  
       1: b                    s tmp1; l b; d; s map
       2: deref:
          1: deref: deref: c   s tmp2; l c; d; d; s map
          2: typeof: d         l d; typeof; i
                               l map; d; d; s tmp; l tmp2; d; s map; l tmp; d; i
       3: e                    l e; i
                               l map; d; d; s tmp; l tmp1; d; s map; l tmp; d; i
    3: f                       l f; i
    */
    if (map_get(inst, 1) === undefined) { // assume already generated otherwise
      let from = map_get(inst, 'from'), to = map_get(inst, 'to');
      let instrs = [];
      const emit = (...ins) => { instrs.push(...ins); };
      // Step 1: put source in .focus
      if (typeof from === 'string') emit({op: 'load', value: from}, {op: 'deref'});
      else {
        map_iter(from, (k,v,i) => {
          if (i === 0) emit(
            {op: 'load', value: v}, {op: 'deref'}, {op: 'store', register: 'map'}
          );
          else emit({op: 'load', value: v}, {op: 'index'});
        });
        emit({op: 'load', value: 'map'}, {op: 'deref'});
      }
      // Step 2: write to dest
      if (typeof to === 'string') emit({op: 'store', register: to}); // SMELL: ditto
      else {
        emit({op: 'store', register: 'source'});
        let prev = undefined;
        map_iter(to, (k,v,i) => {
          if (i === 0) emit(
            {op: 'load', value: v}, {op: 'deref'}, {op: 'store', register: 'map'}
          );
          else {
            if (prev !== undefined) emit({op: 'load', value: prev}, {op: 'index'});
            prev = v;
          }
        });
        emit({op: 'load', value: prev}, {op: 'store'});
      }
      
      const new_instrs = map_new();
      instrs.forEach((ins,j) => {
        map_set(new_instrs, j+1, map_new(instrs[j]));
      });
      map_set(inst, 1, new_instrs); // Shove them under the 1 key...
    }
    continue_nested = true;
  } // no op field: assume nested instruction list
  else if (op === undefined) {
    continue_nested = true;
  }
  
  if (continue_nested) {
    const ref = map_get(ctx, 'next_instruction', 'ref');
    const prev_return_pt = map_get(ctx, 'return_to');
    map_set(ctx, 'return_to', map_new({ ...ref.entries, next: prev_return_pt })); // Push current execution point
    map_set(ref, 'map', inst); map_set(ref, 'key', 1); // Dive in
  }

  if (!nofetch) fetch_next(); // This goes here in case the instruction changed next_instruction

  let obj = ctx, key = 'focus'; // i.e. what changed?
  if (op === 'store')
    if (dest_reg === undefined) { obj = map; key = focus; }
    else key = dest_reg;
  else if (op === 'index') key = 'map';
  else if (op === 'copy') { obj = inst; key = 1; } // SMELL should be only once?
  else if (continue_nested) key = 'return_to';

  // Check if the map being changed is a proxy for some 3JS thing
  update_relevant_proxy_objs(obj, key);

  // Return changeset
  return [do_break, [
    [obj, key], [map_get(ctx, 'next_instruction', 'ref'), 'key'], [map_get(ctx, 'next_instruction'), 'value']
  ].map(([o, k]) => [ref(o).id, k])];
}

function update_relevant_proxy_objs(obj, key) {
  let f;
  if (obj.isChildrenFor !== undefined) f = sync_3js_children;
  else if (obj.isPositionFor !== undefined) f = sync_3js_pos;
  else if (obj._3js_proxy !== undefined) f = sync_3js_proxy;
  else if (obj._3js_potential_child_in !== undefined) f = sync_3js_proxy;
  else return;
  const val = map_get(obj, key);
  f(obj)(key, val);
  old_value = undefined;
  if (obj._3js_potential_child_in !== undefined && obj._3js_proxy !== undefined) {
    obj._3js_potential_child_in.isChildrenFor._3js_proxy.add(obj._3js_proxy); // SMELL dupe of sync below
    obj._3js_potential_child_in = undefined;
  }
}

square_geom = new e3.PlaneGeometry(1, 1);
need_rerender = false;
bases = {};

sync_3js_children = (children, do_delete) => (ch_name, child) => {
  const parent = children.isChildrenFor;
  if (old_value !== undefined) {
    if (child === undefined) { child = old_value; do_delete = true; }
    else {
      if (old_value._3js_proxy && parent._3js_proxy)
        parent._3js_proxy.remove(old_value._3js_proxy);
      bases[ch_name] = undefined;
    }
  }
  if (!do_delete) {
    const local_old_value = old_value; old_value = undefined; // ew
    map_iter(child, sync_3js_proxy(child, parent));
    old_value = local_old_value; // ew
  }
  if (child._3js_proxy) {
    if (do_delete) {
      if (parent._3js_proxy) parent._3js_proxy.remove(child._3js_proxy);
      bases[ch_name] = undefined;
    } else {
      child._3js_proxy.name = ch_name; // set name in 3js
      parent._3js_proxy.add(child._3js_proxy); // <-- the syncing part
      if (bases[ch_name] === undefined) bases[ch_name] = child; // SMELL unique names
    }
  } else child._3js_potential_child_in = children;
}

sync_3js_proxy = (obj, parent) => (key, val) => {
  if (key === 'children') {
    if (old_value !== undefined) { // AAAAAGH!! WRONG AT HIGHER LVL
      map_iter(old_value, sync_3js_children(old_value, true));
      old_value.isChildrenFor = undefined;
    }
    if (val !== undefined) {
      val.isChildrenFor = obj;
      if (obj._3js_proxy === undefined) obj._3js_proxy = new e3.Group(); // SMELL group not added!?
      map_iter(val, sync_3js_children(val));
    }
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
    // For some reason MSDF default font has cyrillic letters but not <> ...
    const sanVal = (''+val).replaceAll('<', 'Ж').replaceAll('>', 'ж');
    init_3js_text(obj); obj._3js_text.set({ content: sanVal });
  } else if (key === 'opacity') {
    const backgroundOpacity = val === undefined ? 0 : Number.parseFloat(val);
    init_3js_text(obj); obj._3js_text.parent.set({ backgroundOpacity });
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
    const short = (""+map_get(obj, 'text')).slice(0, 5);
    block.name = short + '_blk';
    obj._3js_proxy.add(block);
    obj._3js_text = new ThreeMeshUI.Text({content: ""+map_get(obj, 'text')});
    obj._3js_proxy.userData.sceneNode = obj; // for e.g. mouse identification
    obj._3js_text.name = short + '_txt';
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
    const [do_break, [[id, key], _]] = single_step(nofetch);
    in_order.push([deref(id), key]); // add it to the end
    if (do_break) break;
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
    return_to: null,
    focus: null,
    map: null,
    source: null,
    instructions: {
      example_render: {
        start: assemble_code([
          'l stack; d; s map; l stack_top; d; i; l map; d; s frame;' + // frame := stack[stack_top]
          'l {}; s continue_to;' +
          'l instructions; d; s map; l example_render; i; l does_parent_frame_exist; i;' +
          'l -1; s addend; l stack_top; d; +; s tmp; sign; i;' +
          'l map; d; s source; l continue_to; d; s map; l map; s' // goto branch[sgn(stack_top-1)]
        ]),
        does_parent_frame_exist: {
          0: assemble_code(['l 0; s voffs']),
          1: assemble_code([
            'l -.3; s factor; l stack; d; s map; l tmp; d; i; l nlines; i;' +
            'l map; d; *; s voffs' // voffs := stack[stack_top-1].nlines * -.3
          ]),
        },
        render_key: assemble_code([
          'l $0; s key_r; s map; l top_left; i; l voffs; d; s source; l up; s;' + // ...top_left.up := voffs
          'l :; s addend; l frame; d; s map; l src_key; i; l map; d; +; s source;' +
          'l key_r; d; s map; l text; s;' + // key_r.text := frame.src_key+':'
          'l key_r; d; s source; l frame; d; s map; l key_r; s;' + // frame.key_r := key_r
          'l dst_key; i; l map; d; s tmp; l frame; d; s map; l dst_map; i; l tmp; d; s' // frame.dst_map[frame.dst_key] := key_r
        ], { top_left: {right: .2}, children: {} }),
        render_value: assemble_code([
          'l frame; d; s map; l src_val; i; l map; d; s curr_val;' +
          'l instructions; d; s map; l example_render; i;' +
          'l typeof_curr_val; i; l curr_val; d; typeof; i;' + // goto branch[typeof(curr_val)]
          'l map; d; s source; l {}; s continue_to; s map; l map; s'
        ]),
        typeof_curr_val: {
          object: assemble_code([ // access curr child key
            'l frame; d; s map; l entry_i; i; l map; d; s entry_i;' +
            'l curr_val; d; order; s curr_keys; s map; l entry_i; d; i; l map; d; s src_key; ' +
            'l instructions; d; s map; l example_render; i; l any_keys_left; i; ' +
            'l src_key; d; typeof; i; ' + // goto branch[typeof(src_key)]
            'l map; d; s source; l {}; s continue_to; s map; l map; s'
          ]),
          _: assemble_code([ // render primitive val
            'l $0; s map; l curr_val; d; s source; l text; s;' +
            'l map; d; s source; l key_r; d; s map; l children; i; l 1; s'
          ], { top_left: {right: .75} }),
        },
        any_keys_left: {
          undefined: {1: {op: 'load', value: 'no-op'}}, // No-op necessary :(
          _: assemble_code([
            'l curr_val; d; s map; l src_key; d; i; l map; d; s src_val;' + // src_val := curr_val[src_key]
            's source; l $0; s ch_frame; s map; l src_val; s;' + // ch_frame = { nlines: 1, entry_i: 1, src_val }
            'l src_key; d; s source; l src_key; s;' + // ch_frame.src_key := src_key
            'l entry_i; d; s source; l dst_key; s;' + // ch_frame.dst_key := entry_i
            'l key_r; d; s map; l children; i; l map; d;' + // ch_frame.dst_map := key_r.children
            's source; l ch_frame; d; s map; l dst_map; s; l 1; s addend; l entry_i; d; +;' + 
            's source; l frame; d; s map; l entry_i; s;' + // frame.entry_i++
            'l instructions; d; s map; l example_render; i; l typeof_curr_val; i;' +
            'l object; i; l map; d; s source; l {}; s return; s map; l map; s;' +
            'l return; d; s source; l frame; d; s map; l return; s;' + // frame.return = typeof_cv.object
            'l ch_frame; d; s source; l stack; d; s map;' +
            'l 1; s addend; l stack_top; d; +; s stack_top; s;' + // push ch_frame
            'l instructions; d; s map; l example_render; i; l start; i;' +
            'l map; d; s source; l {}; s continue_to; s map; l map; s', // goto start
          ], { nlines: 1, entry_i: 1 })
        },
        pop_frame: assemble_code([
          'l stack; d; s map; l $0; s source; l stack_top; d; s;' + // pop
          's addend; l -1; +; s stack_top;' +
          'l instructions; d; s map; l example_render; i; l num_frames; i;' +
          'l stack_top; d; sign; i; l map; d; s source;' +
          'l {}; s continue_to; s map; l map; s' // goto num_frames[sign(stack_top)]
        ], undefined),
        num_frames: {
          [-1]: {}, 0: {},
          1: assemble_code([
            'l stack; d; s map; l stack_top; d; i; l map; d; s parent_frame;' +
            'l nlines; i; l map; d; s addend; l frame; d; s map; l nlines; i; l map; d; +; s source;' +
            'l parent_frame; d; s map; l nlines; s;' + // parent_frame.nlines += frame.nlines
            'l key_r; i; l map; d; s key_r;' + // restore key_r local
            'l parent_frame; d; s map; l src_val; i; l map; d; s curr_val;' + // restore curr_val local
            'l parent_frame; d; s frame;' + // restore frame local
            's map; l return; i; l map; d; s continue_to' // jump return address
          ]),
        }
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
      root: { text:'root:', top_left: { right: 0.2, up: 0 }, children: {} },
      lisp_iter: {children: {}},
      shapes: {
        position: { basis: 'world', ...ruf(shapes.position) },
        children: {
          yellow_shape: {
            color: '0x999900', width: 2, height: 2,
            center: { basis: 'shapes', right: 2, up: 1.75, forward: -1 },
          },
          blue_shape: {
            color: '0x009999', width: 2, height: 2,
            center: { basis: 'shapes', right: 1.75, up: -3, forward: -1 },
          },
        }
      },
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
  
  const rnd_instrs = map_get(ctx, 'instructions', 'example_render');
  common_exit = map_new({ map: map_get(rnd_instrs, 'render_key') });
  map_set(rnd_instrs, 'does_parent_frame_exist', 0, 'continue_to', common_exit);
  map_set(rnd_instrs, 'does_parent_frame_exist', 1, 'continue_to', common_exit);
  map_set(rnd_instrs, 'does_parent_frame_exist', -1, map_get(rnd_instrs, 'does_parent_frame_exist', 0));

  common_exit = map_new({ map: map_get(rnd_instrs, 'render_value') });
  map_set(rnd_instrs, 'render_key', 'continue_to', common_exit);
  
  common_exit = map_new({ map: map_get(rnd_instrs, 'pop_frame') });
  map_set(rnd_instrs, 'typeof_curr_val', '_', 'continue_to', common_exit);
  map_set(rnd_instrs, 'any_keys_left', 'undefined', 'continue_to', common_exit);

  JSONTree.create(ctx, id_from_jsobj, treeView);
  //JSONTree.toggle(map_get(ctx, 'next_instruction', 'ref', 'map'));
  map_iter(rnd_instrs, (_,blk) => JSONTree.toggle(blk));
  JSONTree.toggle(map_get(ctx, 'scene', 'shapes'));
  JSONTree.toggle(map_get(ctx, 'pointer'));
  fetch_next();
}

upd_rerender = true;
function upd(o, ...args) {
  let real_v; // Hack for doing cyclic structures w/o breaking JSONTree...
  let v = args.pop();
  if (v instanceof Array) { real_v = v[1]; v = v[0]; }
  const k = args.pop();
  o = map_get(o, ...args);
  old_value = map_get(o, k);
  map_set(o, k, v);
  if (upd_rerender) JSONTree.update(o, k);
  if (real_v !== undefined) map_set(o, k, real_v); // Hidden from JSONTree
  update_relevant_proxy_objs(o, k);
  if (v !== undefined && upd_rerender)
    JSONTree.highlight('jstExternalChange', o, k);
  if (need_rerender) r();
  return v;
}

load_state();

// original line 12345
//upd(ctx, 'scene', 'lisp_3js', 'children', maps_init(tree_to_3js(map_get(ctx, 'src_tree'))[0]));

upd(ctx, 'scene', 'camera', 'position', map_new({basis: 'world', right: 1.01, up: -4.764}));
upd(ctx, 'scene', 'camera', 'zoom', .2147);

// Setup initial stack frame for depth-first tree rendering.
stack = upd(ctx, 'stack', maps_init({
  1: {src_key: 'lisp_iter', nlines: 1, dst_key: 1}
}));
upd(ctx, 'stack', 1, 'entry_i', 1);
upd(ctx, 'stack', 1, 'src_val', map_get(ctx, 'src_tree'));
upd(ctx, 'stack', 1, 'dst_map', map_get(ctx, 'scene', 'lisp_iter', 'children'));
upd(ctx, 'stack_top', 1);
JSONTree.toggle(stack);

function export_state(root, filename='bl-state.json') {
  const visited = new Map(); // node -> id
  const reffed = new Set();
  let next_id = 1;
  const visit = (node) => {
    const this_id = next_id; next_id++;
    visited.set(node, this_id); return this_id;
  };
  const walk_from = val => {
    switch (typeof val) {
    case 'object':
      if (val === null) return null;
    case 'function':
      const id = visited.get(val);
      if (id) { reffed.add(id); return ['ref', id]; }
      break;
    default: return val;
    }
    const this_id = visit(val);
    switch (typeof val) {
    case 'object':
      const tree = {};
      map_iter(val, (k,v) => { tree[k] = walk_from(v); });
      return [this_id, tree];
    case 'function': return [this_id, v.toString()];
    }
  };
  const clean_from = val => {
    if (typeof val !== 'object' || val === null) return val;
    if (val instanceof Array && typeof val[0] === 'number') {
      if (!reffed.has(val[0])) {
        if (typeof(val[1]) === 'string') return ['func', val[1]];
        else return clean_from(val[1]);
      } else return [val[0], clean_from(val[1])];
    } else
      Object.entries(val).forEach(([k,v]) => { val[k] = clean_from(v); });
    return val;
  };
  let tree = walk_from(root);
  tree = clean_from(tree);
  download(JSON.stringify(tree), filename, 'application/json');
}

// python3 -m cors-server
function import_state(tree_or_url) {
  const doIt = tree => {
    const refs = new Map();
    let graph = maps_init(tree, refs);
    graph = maps_fixup(graph, refs);
    return graph;
  }
  if (typeof tree_or_url === 'string')
    return fetch(tree_or_url).then(r => r.json()).then(doIt);
  else return doIt(tree_or_url);
}

function measure_tree_height(scene_node) { // DF traversal
  let total = 1;
  const children = map_get(scene_node, 'children');
  if (children === undefined) return 0;
  map_iter(children, (k,v) => {
    total += measure_tree_height(v);
  });
  return total;
}

local_notation_demo = false;

nodes_to_bump = [];
// JS breadth-first on-demand tree rendering (with layout)
function toggle_expand(scene_node) {
  const children = map_get(scene_node, 'children');
  // children := scene_node.children
  
  // work out what the source state is
  let state_node = map_get(scene_node, 'source');
  // state_node := scene_node.source
  if (state_node === undefined) {
    const source_node = map_get(scene_node.parent.parent, 'source');
    const source_key = map_get(scene_node, 'text').slice(0, -1);
    state_node = map_get(source_node, source_key);
    // state_node := [scene_node^^.source].[scene_node.text[0:-1]]
  }
  
  if (state_node === null || typeof state_node !== 'object') return;
  let lines = map_num_entries(state_node);
  if (lines === 0) return;
  
  if (map_num_entries(children) === 0) { // expand
    upd(scene_node, 'source', state_node);
    // scene_node.source := state_node
    map_iter(state_node, (k,v,i) => {
      if (state_node.parent_key === 'is' && k === 'color') return;
      i++;
      const key_r = maps_init({
        text: k+':', top_left: {right: .2, up: -.3*i}, children: {}
      });
      // key_r := <expr>
      // Try render in Masp
      if (local_notation_demo && k === 'color' && typeof v === 'string') {/*
        map_set(key_r, 'children', 1, maps_init({
          width: .25, height: .25, center: {right: .75, up: -.1, forward: -1},
          color: v
        }));*/
        fast_eval = false; upd_rerender = true;
        //upd(masp, 'break', true);
      }
      upd(masp, 'initial_env', 'entries', 'key_name', k);
      upd(masp, 'initial_env', 'entries', 'value', v);
      upd(masp, 'ctx', 'value', undefined);
      upd(masp, 'ctx', 'arg_i', undefined);
      upd(masp, 'ctx', 'expr', map_get(ctx, 'render_map_entry'));
      masp_eval();
      //if (k === 'color') throw "Color Break Exception";
      let rendered = 'unhandled';
      if (local_notation_demo && k === 'color' && typeof v === 'string')
        rendered = map_get(masp, 'ctx', 'value'); // HACK demo
      if (rendered !== 'unhandled') { // insert rendered val into tree
        const actual_value = map_get(rendered, 'literal');
        if (actual_value) rendered = actual_value; // HACK demo
        if (typeof rendered === 'object') { // HACK demo deep-enough copy
          rendered = map_new({ ...rendered.entries });
          const tl = map_get(rendered, 'top_left');
          if (tl) map_set(rendered, 'top_left', map_new({ ...tl.entries }));
          const ch = map_get(rendered, 'children');
          if (ch) map_set(rendered, 'children', map_new({ 1: map_new({ ...map_get(ch, 1).entries })}));
        }
        map_set(key_r, 'children', 1, rendered);//*/
      } else if (typeof v !== 'object' || v === null) { // render primitive value
        map_set(key_r, 'children', 1, maps_init({ top_left: {right: .75}, text: v }));
        nodes_to_bump.push(key_r); // layout after key width calc'd
        nodes_to_bump.push(map_get(key_r, 'children', 1));
      } // key_r.children.1 := <expr>
      upd(children, i, key_r);
      // children.[i] := key_r
    });
  } else { // collapse
    lines = -1 * (measure_tree_height(scene_node) - 1);
    upd(scene_node, 'children', map_new());
  }

  displace_treeview(scene_node, lines);
}

function displace_treeview(scene_node, lines) {
  // walk up the scene tree pushing stuff vertically down/up
  let siblings = scene_node.parent, i = Number.parseInt(scene_node.parent_key);
  while (siblings !== undefined && Number.isInteger(i)) {
    let j = i+1, sibling = map_get(siblings, j);
    while (sibling !== undefined) {
      const tl = map_get(sibling, 'top_left');
      if (tl === undefined) break;
      const up = map_get(tl, 'up');
      upd(tl, 'up', up - .3*lines);
      j++; sibling = map_get(siblings, j)
    }
    const parent_sc_node = siblings.parent;
    if (parent_sc_node !== undefined) {
      i = Number.parseInt(parent_sc_node.parent_key);
      siblings = parent_sc_node.parent;
    }
  }
}

function bump() {
  nodes_to_bump.forEach(n => {
    const width = n._3js_text.width;
    const height = n._3js_text.height;
    const block = n._3js_text.parent;
    block.set({ width, height });
    upd(n, 'opacity', 0.3);
    block.position.setX(width/2);
    block.position.setY(-height/2);
    if (map_get(n, 'children') !== undefined)
      upd(n, 'children', 1, 'top_left', 'right', width+0.1);
  });
}

upd(ctx, 'scene', 'root', 'source', ctx);

// 2022-05-04: 1-masp eval
const masp =  map_new();
upd(ctx, 'masp', masp);
/*
 * Primitive funcs protocol:
   c is the Masp context
   args is JS obj containing arg vals (or exprs if, dont_eval_args)
   If dont_eval_args, then must eval them manually.
   To eval an expr, modify the context and return non-true.
   To Masp-return the value, set it in the context.
   To exit the current expr and return to its container, return true.
*/
upd(masp, 'initial_env', maps_init({ entries: {
  'quote': { dont_eval_args: true, body: (c, args) => 
    { upd(c, 'value', args.to); return true; }},
  'mul': { body: (c, args) =>
    { upd(c, 'value', args[1]*args[2]); return true; }},
  'decr': { body: (c, args) =>
    { upd(c, 'value', args.to-1); return true; }},
  'fun': { body: (c, args) => {
    const defining_env = masp_curr_env();
    const closure = map_new({
      arg_names: args.arg_names,
      body: args.body, env: () => defining_env
    });
    upd(c, 'value', closure); return true;
  }, dont_eval_args: true },
  'define': { body: (c, args) => {
    if (typeof args.as === 'object') {
      const val = map_get(args.as, 'value');
      if (val !== undefined) {
        upd(masp, 'initial_env', 'entries', args.name, val);
        upd(c, 'value', null); return true;
      }
    }
    masp_enter('as');
  }, dont_eval_args: true },
  'local': { body: (c, args) => {
    if (typeof args.is === 'object') {
      const val = map_get(args.is, 'value');
      if (val !== undefined) {
        upd(masp_curr_env(), 'entries', args.name, val);
        upd(c, 'value', null); return true;
      }
    }
    masp_enter('is');
  }, dont_eval_args: true },
  'block': { body: (c, args) => {
    let i; for (i=1; args[i] !== undefined; i++);
    upd(c, 'value', args[i-1]); return true;
  }},
  'get': { body: (c, args) => {  
    if (!masp_has_value(args.map)) { masp_enter('map'); return; }
    const map = map_get(args.map, 'value');
    const val = map_get(map, args.key);
    upd(c, 'value', val === undefined? null : val); // urgh
    return true;
  }, dont_eval_args: true },
  'set': { body: (c, args) => {
    if (!masp_has_value(args.map)) { masp_enter('map'); return; }
    const map = map_get(args.map, 'value');
    if (!masp_has_value(args.to)) { masp_enter('to'); return; }
    const val = map_get(args.to, 'value');
    if (map_get(map, 'literal')) upd(map, 'literal', args.key, val); // HACK demo
    else upd(map, args.key, val);
    upd(c, 'value', null); return true;
  }, dont_eval_args: true },
  'slice': { body: (c, args) => {
    let slice;
    if (typeof args.of === 'string')
      slice = args.of.slice(args.from, args.toExcl);
    else throw ['slice: not a string', args.of]
    upd(c, 'value', slice); return true;
  }},
  'concat': { body: (c, args) => {  
    const strs = [];
    for (let i=1; args[i] !== undefined; i++) strs.push(args[i] + '');
    upd(c, 'value', strs.join('')); return true;
  }},
  'length': { body: (c, args) => {
    upd(c, 'value', args.of.length); return true;
  }},
  'null': null,
  'undefined': undefined, // ummmm
  'asBool': { body: (c, args) => {
    upd(c, 'value', args.to ? true : false); return true;
  }},
  'neg': { body: (c, args) => {
    upd(c, 'value', -args.to); return true;
  }}
}}));

function masp_step() {
  const c = map_get(masp, 'ctx');
  const expr = map_get(c, 'expr');
  let value = undefined;
  if (typeof expr === 'string' && !masp_has_value(c)) { // lookup the name
    const try_lookup = env => {
      let val = map_get(env, 'entries', expr);
      const par = map_get(env, 'parent');
      if (val === undefined && par !== undefined)
        return try_lookup(par);
      else return val;
    }
    value = try_lookup(masp_curr_env());
  } else if (typeof expr === 'object') {
    if (map_get(expr, 'apply') === undefined) { // lit map
      const defining_env = masp_curr_env();
      value = map_new({ literal: expr, env: () => defining_env });
    } else { // application
      if (!masp_has_value(expr, 'apply')) { // eval func part
        upd(c, 'expr', map_new({...expr.entries}));
        masp_enter('apply'); return;
      }
      const func = map_get(expr, 'apply', 'value');
      const do_eval_args = !map_get(func, 'dont_eval_args');
      if (do_eval_args) { // eval args
        const keys = Object.keys(expr.entries);
        if (map_get(c, 'arg_i') === undefined) upd(c, 'arg_i', 1);
        const arg_i = map_get(c, 'arg_i');
        if (arg_i <= keys.length) {
          const key = keys[arg_i-1]; 
          if (key !== 'apply' || arg_i !== keys.length) {
            upd(c, 'arg_i', arg_i+1);
            if (key !== 'apply') masp_enter(key);
            return;
          }
        }
      }
      const arg_vals = map_new();
      map_iter(expr, (k,v) => {
        if (k === 'apply') return;
        let val = v;
        if (do_eval_args && masp_has_value(v))
          val = map_get(v, 'value');
        map_set(arg_vals, k, val);
      });
      let body = map_get(func, 'body');
      if (typeof body === 'function') { // primitive
        if (!body(c, arg_vals.entries)) return;
      } else { // body is a MASP expression
        let path = ['body'];
        if (body === undefined) {
          const selector = map_get(arg_vals, 'to');
          path = ['literal', selector];
          body = map_get(func, ...path);
          if (body === undefined) {
            path[1] = '_';
            body = map_get(func, ...path);
            if (body === undefined)
              throw ["Pattern match fail: ", func, selector];
          }
        }
        if (masp_has_value(body)) { value = map_get(body, 'value');
        } else { // Not yet eval'd
          let defining_env = map_get(func, 'env');
          // LEGACY holdover from the dark days of cycles breaking the view
          if (typeof defining_env === 'function') defining_env = defining_env();
          // make a local env
          let body_env;
          if (path[0] === 'literal')
            body_env = defining_env;
          else body_env = map_new({
            entries: arg_vals, parent: defining_env
          });
          // Instantiate a fresh copy of the closure for scribbling
          const closure = map_new({ ...func.entries });
          if (path[0] === 'literal')
            map_set_rel(closure, 'literal', l => map_new({ ...l.entries }));
          upd(expr, 'apply', 'value', closure);
          // Enter a context for eval'ing the body
          masp_enter('apply', 'value', ...path);
          // Ensure it sees its local bindings
          upd(masp, 'ctx', 'env', body_env); return;
        }
      }
    }
  } else if (!masp_has_value(c)) value = expr;
  if (value !== undefined) upd(c, 'value', value);
  if (!map_get(c, 'is_root')) {
    if (c.parent.parent_key === 'literal')
      upd(masp, 'ctx', c.parent.parent.parent.parent.parent);
    else
      upd(masp, 'ctx', c.parent.parent);
  }
}

function masp_enter(...path) {
  const old_ctx = map_get(masp, 'ctx');
  const expr = map_get(old_ctx, 'expr', ...path);
  const new_ctx = map_new({ expr });
  upd(old_ctx, 'expr', ...path, new_ctx);
  upd(masp, 'ctx', new_ctx);
}

function masp_has_value(...path) {
  const map = map_get(...path);
  return map !== null && typeof map === 'object' &&
    map_get(map, 'value') !== undefined;
}

function masp_curr_env() {
  let curr_ctx = map_get(masp, 'ctx');
  while (map_get(curr_ctx, 'env') === undefined)
    curr_ctx = curr_ctx.parent.parent;
  return map_get(curr_ctx, 'env');
}

fast_eval = false;
function masp_eval() {
  const initial_ctx = map_get(masp, 'ctx');
  const saved = upd_rerender;
  if (fast_eval) upd_rerender = false;
    while (!masp_has_value(initial_ctx)) {
      masp_step();
      if (map_get(masp, 'break')) break;
    }
  if (fast_eval) upd_rerender = saved;
}

import_state('misc/render.json').then(x => {
  upd(ctx, 'render_map_entry', x);
});
import_state('misc/textbox.json').then(x => {
  upd(ctx, 'textbox', x);
  JSONTree.toggle(map_get(ctx, 'textbox'));
  // From original line 12345
  upd(ctx, 'src_tree', map_get(ctx, 'textbox', 'onBackspace'));
  JSONTree.toggle(map_get(ctx, 'src_tree'));
  
  // Masp textbox editing trial
  upd(ctx, 'scene', 'mytb', maps_init({
    text: 'Hello World', top_left: {right: 1, up: 0.5}, suffix: ''
  }));
  /*
  upd(masp, 'ctx', 'env', 'entries', 'self', map_get(ctx, 'scene', 'mytb'));
  upd(masp, 'ctx', 'expr', map_get(ctx, 'textbox', 'append'));
  upd(masp, 'ctx', 'env', 'entries', 'char', 'X');
  upd(masp, 'ctx', 'env', 'entries', 'checkFresh', map_new({
    body: map_get(ctx, 'textbox', 'checkFresh'),
    env: map_get(masp, 'initial_env')
  }));*/ // Demo
});
import_state('1lisp-fac.json').then(x => {
  upd(masp, 'program', x);
  upd(masp, 'ctx', map_new({
    env: map_get(masp, 'initial_env'),
    expr: map_get(masp, 'program'),
    is_root: true,
  }));
  JSONTree.toggle(map_get(masp, 'ctx', 'env'));
  JSONTree.toggle(map_get(masp, 'initial_env'));
  JSONTree.toggle(map_get(masp, 'program'));
});

camera.position.z = 10;
r();

fast_eval = true;
