body = document.body;
body.style.border = '2px dashed red';
body.style.margin = '0px';

body.addEventListener('mousedown', e => onMouseDown(e));
onMouseDown = e => {
  console.log(e);
  if (e.button === 0) {
    let lmb = nav('ui', 'mouse', 'left');
    send('pressed', lmb);
  }
  else if (e.button === 1) {
    let rmb = nav('ui', 'mouse', 'right');
    send('pressed', rmb);
  }
}

body.addEventListener('mouseup', e => onMouseUp(e));
onMouseUp = e => {
  console.log(e);
  if (e.button === 0) {
    let lmb = nav('ui', 'mouse', 'left');
    send('released', lmb);
  }
  else if (e.button === 1) {
    let rmb = nav('ui', 'mouse', 'right');
    send('pressed', rmb);
  }
}

body.addEventListener('mousemove', e => onMouseMove(e));
onMouseMove = e => {
  console.log(e);
  let cursor = nav('ui', 'mouse', 'cursor');
  send('changed', cursor, {to: [e.offsetX, e.offsetY]});
};

nav = function(...names) {
  return send('look-up', universe, { keys: names });
}

state = function(o, k, v) {
  let old = o[k];
  if (v !== undefined) {
    o[k] = v;
  }
  return old;
}

send = function(selector, receiver, context) {
  // Decompose named-args form
  if (receiver === undefined) {
    let message = selector;
    receiver = message.to;
    selector = message.selector;
    context = message.context;
  }
  // Obtain method implementation.
  let method_impl = null;
  if (selector === 'method-impl'
   && state(receiver, 'vtable') === receiver) {
   // Special case -- cannot use message send.
   // Use whatever the object decides
   method_impl = state(receiver, 'method-impl');
  } else {
    // Obtain method impl from vtable
    method_impl = send('method-impl',
                       state(receiver, 'vtable'),
                       { key: selector });
  }
  if (method_impl === undefined) throw "Does not understand: "+selector;

  // Invoke method impl.
  return method_impl(receiver, context);
};

universe = {};
state(universe, 'vtable', universe);
state(universe, 'methods', {});
state(universe, 'directory', {});
state(universe, 'method-impl', function(obj, ctx) {
  return obj.methods[ctx.key];
});

state(universe, 'methods')['look-up'] = function(obj, ctx) {
  if (ctx.keys.length === 0) return obj;

  let key = ctx.keys.shift();
  let next = state(obj, 'directory')[key];
  if (next === undefined) throw "No such key "+key;

  return send('look-up', next, ctx);
};

universe.ui = {}
state(universe.ui, 'vtable', universe);
state(universe.ui, 'directory', {});

state(universe, 'directory')['ui'] = universe.ui;

universe.ui.mouse = {}
state(universe.ui.mouse, 'vtable', universe);
state(universe.ui.mouse, 'directory', {});

state(universe.ui, 'directory')['mouse'] = universe.ui.mouse;

universe.ui.mouse.left = {}
state(universe.ui.mouse.left, 'vtable', universe);
state(universe.ui.mouse.left, 'directory', {});

state(universe.ui.mouse, 'directory')['left'] = universe.ui.mouse.left;

universe.ui.mouse.cursor = {};
state(universe.ui.mouse.cursor, 'vtable', universe);
state(universe.ui.mouse.cursor, 'directory', {});
state(universe.ui.mouse, 'directory')['cursor'] = universe.ui.mouse.cursor;
