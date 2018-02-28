// REINVENTING THE LISP CODE-AS-DATA S-EXPRS FTW...
object(1);
state('id', dom('INPUT', '1'));
state('vtable', dom('INPUT', '1'));
state('parent', dom('INPUT', '2'));
state('name', dom('INPUT', 'vtable vtable'));
state('-addMethod', dom('INPUT', '4'));
state('-lookup', dom('INPUT', '5'));
state('-allocate', dom('INPUT', '6'));
state('-delegated', dom('INPUT', '8'));
object(2);
state('id', dom('INPUT', '2'));
state('vtable', dom('INPUT', '1'));
state('parent', dom('INPUT', '0'));
state('name', dom('INPUT', 'object vtable'));
state('-to-javascript', dom('INPUT', '15'));
object(3);
state('id', dom('INPUT', '3'));
state('vtable', dom('INPUT', '1'));
state('parent', dom('INPUT', '1'));
state('name', dom('INPUT', 'JS function vtable'));
state('-init', dom('INPUT', '7'));
object(4);
state('id', dom('INPUT', '4'));
state('vtable', dom('INPUT', '3'));
state('name', dom('INPUT', 'vtable.addMethod'));
// OH NOES -- STUFF NEEDS ESCAPING; FFS
state('code', dom('TEXTAREA', 'function(rcv, name, impl) {
  const symbol = '-'+name;
  return state(rcv, symbol, state(impl, 'id'));
}'));
object(5);
state('id', dom('INPUT', '5'));
state('vtable', dom('INPUT', '3'));
state('name', dom('INPUT', 'vtable.lookup'));
state('code', dom('TEXTAREA', 'function(rcv, name) {
  const symbol = '-'+name;
  const impl = state(rcv, symbol);
  const parent = state(rcv, 'parent');
  if (impl === '0' && parent !== '0')
    return send(deref(parent), 'lookup', name);
  else
    return impl;
}'));
object(6);
state('id', dom('INPUT', '6'));
state('vtable', dom('INPUT', '3'));
state('name', dom('INPUT', 'vtable.allocate'));
state('code', dom('TEXTAREA', 'function(rcv) {
  let ent = new Entity();

  state(ent, 'vtable', state(rcv, 'id'));
  return ent;
}'));
object(7);
state('id', dom('INPUT', '7'));
state('vtable', dom('INPUT', '3'));
state('name', dom('INPUT', 'function.init'));
state('code', dom('TEXTAREA', 'function(rcv, name, code) {
  state(rcv, 'name', name || '<function>');
  state(rcv, 'code', multiline(code || '() => "unimplemented"'));
}'));
object(8);
state('id', dom('INPUT', '8'));
state('vtable', dom('INPUT', '3'));
state('name', dom('INPUT', 'vtable.delegated'));
state('code', dom('TEXTAREA', 'function(rcv) {
  let newVT = new Entity();
  
  if (rcv === '0') {
    state(newVT, 'vtable', '0');
    state(newVT, 'parent', '0');
  } else {
    state(newVT, 'vtable', state(rcv, 'vtable'));
    state(newVT, 'parent', state(rcv, 'id'));
  }
  
  return newVT;
}'));
object(9);
state('id', dom('INPUT', '9'));
state('vtable', dom('INPUT', '3'));
state('name', dom('INPUT', 'bind'));
state('code', dom('TEXTAREA', 'function(rcv, selector) {
  let impl;
  if (rcv === vtable_vt && selector === 'lookup')
    impl = vtable_lookup(rcv, selector);
  else
    impl = send(deref(state(rcv, 'vtable')), 'lookup', selector);
  if (impl === '0')
    throw `Entity ${state(rcv, 'id')} does not understand ${selector}`;
  else
    return deref(impl);
}'));
object(10);
state('id', dom('INPUT', '10'));
state('vtable', dom('INPUT', '3'));
state('name', dom('INPUT', 'send'));
state('code', dom('TEXTAREA', 'function(rcv, selector, ...args) {
  const impl = bind(rcv, selector);
  return call_func(impl, rcv, ...args);
}'));
object(11);
state('id', dom('INPUT', '11'));
state('vtable', dom('INPUT', '3'));
state('name', dom('INPUT', 'entity.init'));
state('code', dom('TEXTAREA', 'function(rcv) {
  let div = document.createElement("div"); // Create context-free div
  div.style = 'entity'; // Simple default
  document.body.appendChild(div); // Give the div a context
  this.stateTab = document.createElement("table");
  this.stateTab.setAttribute('class', 'state');
  div.appendChild(this.stateTab);
  div.entity = rcv;
  rcv.div = div;

  state(rcv, 'id', nextId.toString());
  id_to_entity[nextId] = rcv;
  nextId++;
}'));
object(12);
state('id', dom('INPUT', '12'));
state('vtable', dom('INPUT', '3'));
state('name', dom('INPUT', 'new-vtable.allocate'));
state('code', dom('TEXTAREA', 'function(rcv) {
  let o = new_object();
  state(o, 'vtable', rcv);
  return o;
}'));
object(13);
state('id', dom('INPUT', '13'));
state('vtable', dom('INPUT', '1'));
state('parent', dom('INPUT', '1'));
state('name', dom('INPUT', 'new vtable-vtable'));
state('-allocate', dom('INPUT', '12'));
object(14);
state('id', dom('INPUT', '14'));
state('vtable', dom('INPUT', '13'));
state('name', dom('INPUT', 'entity vtable'));
state('-init', dom('INPUT', '11'));
object(15);
state('id', dom('INPUT', '15'));
state('vtable', dom('INPUT', '3'));
state('name', dom('INPUT', 'object.to-javascript'));
state('code', dom('TEXTAREA', 'function(rcv) {
  let trs = rcv.stateTab.querySelectorAll('tr');
  let pairs = Array.from(trs).map(tr => {
    let key = tr.className;
    let value_elem = tr.querySelector('.value').children[0];
    return [key, value_elem];
  });
  let state_setters = pairs.map(([k, velem]) => {
    let value_js_expr = dom_to_js(velem);
    return `state('${k}', ${value_js_expr});`;
  });
  let preamble = `object(${state(rcv, 'id')});`;
  let code = preamble + '\n' + state_setters.join('\n');
  return code;
}'));
