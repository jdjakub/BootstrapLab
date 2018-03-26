document.documentElement.style.height = '99%';

body = document.body;
body.style.border = '2px dashed red';
body.style.margin = '0px';
body.style.minHeight = '100%';

body.addEventListener('mousedown', e => onMouseDown(e));
onMouseDown = e => {
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
  let cursor = nav('ui', 'mouse', 'cursor');
  send('changed', cursor, {absolute: [e.offsetX, e.offsetY]});
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
  // Short-form to long-form
  let message;
  if (receiver === undefined) message = selector;
  else {
    message = { from: null,
                to: receiver,
                selector: selector,
                context: context };
  }

  // Let the receiver itself handle the message *however* it wants
  let receive_message = state(message.to, 'receive-message');
  return receive_message(message);
};

// Receive message using receiver's 'method-impl' function.
// This function can return a method impl (function),
// an object (which will receive a 'method-impl' message), or undefined
function receive_via_obtain_impl_msg(msg) {
  // Obtain method implementation
  let method_impl;

  // Expect receiver state to contain 'method-impl' function
  let obtain_method_impl = state(msg.to, 'method-impl');
  impl_or_delegate = obtain_method_impl(msg.to, msg.selector);
  if (impl_or_delegate === undefined) throw ["Does not understand", msg];
  else if (typeof(impl_or_delegate) === 'function') {
    method_impl = impl_or_delegate;
  } else { // Forward to delegate
    method_impl = send('method-impl', impl_or_delegate, msg);
    if (method_impl === undefined) throw ["Does not understand", msg];
  }
  
  return method_impl(msg);
}

function method_impl_via_methods_dict_then_delegate(obj, selector) {
  let method_dict = state(obj, 'methods');
  if (method_dict === undefined) return state(obj, 'parent');
  let impl = method_dict[selector];
  if (impl === undefined) return state(obj, 'parent');
  return impl;
}

universe = {};
state(universe, 'receive-message', receive_via_obtain_impl_msg);
state(universe, 'method-impl', method_impl_via_methods_dict_then_delegate);
state(universe, 'methods', {});
state(universe, 'methods')['method-impl'] = function(msg) {
  let obtain_method_impl = state(universe, 'method-impl');
  return obtain_method_impl(msg.to, msg.context.selector);
};
state(universe, 'methods')['look-up'] = function(msg) {
  if (msg.context.keys.length === 0) return msg.to;

  let key = msg.context.keys.shift();
  let next = state(msg.to, 'directory')[key];
  if (next === undefined) throw "No such key "+key;

  return send('look-up', next, msg.context);
};
state(universe, 'directory', {});

universe.ui = {}
state(universe.ui, 'receive-message', receive_via_obtain_impl_msg);
state(universe.ui, 'method-impl', method_impl_via_methods_dict_then_delegate);
state(universe.ui, 'parent', universe);
state(universe.ui, 'directory', {});
state(universe, 'directory')['ui'] = universe.ui;

universe.ui.mouse = {}
state(universe.ui.mouse, 'receive-message', receive_via_obtain_impl_msg);
state(universe.ui.mouse, 'method-impl', method_impl_via_methods_dict_then_delegate);
state(universe.ui.mouse, 'parent', universe);
state(universe.ui.mouse, 'directory', {});
state(universe.ui, 'directory')['mouse'] = universe.ui.mouse;

universe.ui.mouse.left = {}
state(universe.ui.mouse.left, 'receive-message', receive_via_obtain_impl_msg);
state(universe.ui.mouse.left, 'method-impl', method_impl_via_methods_dict_then_delegate);
state(universe.ui.mouse.left, 'parent', universe);
state(universe.ui.mouse.left, 'methods', {});
state(universe.ui.mouse.left, 'methods')['pressed'] = function(msg) {};
state(universe.ui.mouse.left, 'methods')['released'] = function(msg) {
  console.log(msg);
};
state(universe.ui.mouse.left, 'directory', {});
state(universe.ui.mouse, 'directory')['left'] = universe.ui.mouse.left;

universe.ui.mouse.cursor = {};
state(universe.ui.mouse.cursor, 'receive-message', receive_via_obtain_impl_msg);
state(universe.ui.mouse.cursor, 'method-impl', method_impl_via_methods_dict_then_delegate);
state(universe.ui.mouse.cursor, 'parent', universe);
state(universe.ui.mouse.cursor, 'methods', {});
state(universe.ui.mouse.cursor, 'methods')['changed'] = function(msg) {
  state(msg.to, 'value', msg.context.absolute);
};
state(universe.ui.mouse.cursor, 'directory', {});
state(universe.ui.mouse, 'directory')['cursor'] = universe.ui.mouse.cursor;
