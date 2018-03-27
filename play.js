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

sends = [];
messages = [];

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
  sends.push(message)

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
    method_impl = send({ from: msg.to, to: impl_or_delegate,
                         selector: 'method-impl', context: msg });
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
state(universe, 'name', 'universe');
state(universe, 'receive-message', receive_via_obtain_impl_msg);
state(universe, 'method-impl', method_impl_via_methods_dict_then_delegate);
state(universe, 'methods', {});
state(universe, 'methods')['method-impl'] = function(msg) {
  let snd = msg.from ? msg.from.name : ''; let rcv = msg.to.name;
  let sel = msg.selector; let selsel = msg.context.selector;
  messages.push(`${snd} -> ${rcv} ${sel}: '${selsel}'`);
  let obtain_method_impl = state(universe, 'method-impl');
  return obtain_method_impl(msg.to, msg.context.selector);
};
state(universe, 'directory', {});
state(universe, 'methods')['look-up'] = function(msg) {
  let snd = msg.from ? msg.from.name : ''; let rcv = msg.to.name;
  let sel = msg.selector; let keys = msg.context.keys;
  messages.push(`${snd} -> ${rcv} ${sel}: ${keys}`);
  if (msg.context.keys.length === 0) return msg.to;

  let key = msg.context.keys.shift();
  let next = state(msg.to, 'directory')[key];
  if (next === undefined) throw "No such key "+key;

  return send({ from: msg.to, to: next,
                selector: 'look-up', context: msg.context });
};
state(universe, 'methods')['my-name-is'] = function(msg) {
  let snd = msg.from ? msg.from.name : ''; let rcv = msg.to.name;
  let sel = msg.selector; let name = msg.context.name;
  messages.push(`${snd} -> ${rcv} ${sel}: ${name}`);
  state(msg.to, 'directory')[msg.context.name] = msg.from;
};

ui = {}
state(ui, 'name', 'ui');
state(ui, 'receive-message', receive_via_obtain_impl_msg);
state(ui, 'method-impl', method_impl_via_methods_dict_then_delegate);
state(ui, 'parent', universe);
state(ui, 'directory', {});
send({ from: ui, to: universe,
       selector: 'my-name-is', context: {name: 'ui'} });

mouse = {}
state(mouse, 'name', 'mouse');
state(mouse, 'receive-message', receive_via_obtain_impl_msg);
state(mouse, 'method-impl', method_impl_via_methods_dict_then_delegate);
state(mouse, 'parent', universe);
state(mouse, 'directory', {});
send({ from: mouse, to: ui,
       selector: 'my-name-is', context: {name: 'mouse'} });

button_proto = {}
state(button_proto, 'name', 'button-proto');
state(button_proto, 'receive-message', receive_via_obtain_impl_msg);
state(button_proto, 'method-impl', method_impl_via_methods_dict_then_delegate);
state(button_proto, 'parent', universe);
state(button_proto, 'methods', {});
state(button_proto, 'methods')['pressed'] = function(msg) {
  let snd = msg.from ? msg.from.name : ''; let rcv = msg.to.name;
  let sel = msg.selector;
  messages.push(`${snd} -> ${rcv} ${sel}`);
  //send(???, 'changed', {absolute: 'down'});
};
state(button_proto, 'methods')['released'] = function(msg) {
  let snd = msg.from ? msg.from.name : ''; let rcv = msg.to.name;
  let sel = msg.selector;
  messages.push(`${snd} -> ${rcv} ${sel}`);
  //send(??/, 'changed', {absolute: 'up'});
};

lmb = {}
state(lmb, 'name', 'lmb');
state(lmb, 'receive-message', receive_via_obtain_impl_msg);
state(lmb, 'method-impl', method_impl_via_methods_dict_then_delegate);
state(lmb, 'parent', button_proto);
state(lmb, 'directory', {});
send({ from: lmb, to: mouse,
       selector: 'my-name-is', context: {name: 'left'} });

cursor = {};
state(cursor, 'name', 'cursor');
state(cursor, 'receive-message', receive_via_obtain_impl_msg);
state(cursor, 'method-impl', method_impl_via_methods_dict_then_delegate);
state(cursor, 'parent', universe);
state(cursor, 'methods', {});
state(cursor, 'methods')['changed'] = function(msg) {
  state(msg.to, 'value', msg.context.absolute);
};
state(cursor, 'directory', {});
send({ from: cursor, to: mouse,
       selector: 'my-name-is', context: {name: 'cursor'} });
