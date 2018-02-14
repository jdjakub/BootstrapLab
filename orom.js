setup = () => {
  cmds = [];
  log = str => cmds.push(str);
  e = func => {
    let v = func();
    log(func.toString().slice(6));
    return v;
  }
};
setup();
cmds.export = function() { return this.join(";\n"); };

Entity = function() { // Because "Object" is taken, as usual...
  let div = document.createElement("div"); // Create context-free div
  for (let [k,v] of Entity.defaultStyle.entries()) {
    div.style[k] = v; // See definition of defaultStyle below
  }
  document.body.appendChild(div); // Give the div a context
  let state = document.createElement("table");
  state.setAttribute('class', 'state');
  div.appendChild(state);
  div.entity = this;
  this.stateTab = state;
  this.div = div;

  this.state('id', Entity.nextId.toString());
  id_to_entity[Entity.nextId] = this;
  Entity.nextId++;
};

Entity.defaultStyle = new Map([
  ['width', '5cm'],              // Small-ish
  ['height', '5cm'],             // Small-ish
  ['border', '2px solid black'], // Clearly defined
  ['display', 'inline-block'],   // Make div useful
  ['overflow', 'scroll'],        // If too small, still usable
  ['resize', 'both'],            // More control = $$$
]);

Entity.nextId = 1;
id_to_entity = [];
function deref(id) {
  const e = id_to_entity[id];
  if (e === undefined) throw "There is no such entity "+id;
  else return e;
}

Entity.prototype = {};

Entity.prototype.getStateDOMNode = function(key) {
  const tr = this.stateTab.querySelector('.' + key); // Get row
  const td = tr.querySelector('.value'); // Get value cell
  return td.childNodes[0]; // Get value's td element
};

Entity.prototype.existingState = function(key, value) {
  let node = this.getStateDOMNode(key);

  // Return old value (unchanged if "get")
  let oldValue = node.value;
  let retValue = oldValue;
  if (typeof(oldValue) !== 'string') retValue = node;

  if (value !== undefined) { // If "set" rather than "get"...
    if (typeof(value) === 'string') {
      let newNode = node;
      if (typeof(oldValue) !== 'string') {
        newNode = document.createElement('input');
        newNode.type = 'text';
        node.replaceWith(newNode);
      }
      newNode.value = value;
    }
  }

  return retValue;
};

Entity.prototype.addState = function(key) {
  let tr = document.createElement('tr');
  tr.setAttribute('class', key);

  let td = document.createElement('td');
  td.setAttribute('class', 'key');
  td.textContent = key;
  tr.appendChild(td);

  td = document.createElement('td');
  td.setAttribute('class', 'value');

  let input = document.createElement('input');
  input.type = 'text';
  input.value = '0';
  td.appendChild(input);

  tr.appendChild(td);

  this.stateTab.appendChild(tr);
};

Entity.prototype.state = function(key, value, isTextarea) {
  const tr = this.stateTab.querySelector('.' + key); // Get row
  if (tr === null) {
    this.addState(key);
    if (isTextarea) {
      const ta = document.createElement('textarea');
      this.getStateDOMNode(key).replaceWith(ta);
    }
  }
  return this.existingState(key, value);
}

src = {}

src['vtable.allocate'] = `function(rcv) {
  let ent = new Entity();

  ent.state('vtable', rcv.state('id'));
  return ent;
}`;

src['vtable.delegated'] = `function(rcv) {
  let newVT = new Entity();
  
  if (rcv === '0') {
    newVT.state('vtable', '0');
    newVT.state('parent', '0');
  } else {
    newVT.state('vtable', rcv.state('vtable'));
    newVT.state('parent', rcv.state('id'));
  }
  
  return newVT;
}`;

function compile(src) {
  return new Function('return '+src)();
}

vtable_allocate  = compile(src['vtable.allocate']);
vtable_delegated = compile(src['vtable.delegated']);
vtable_lookup    = compile(src['vtable.lookup']);

vtable_vt = vtable_delegated('0');
vtable_vt.state('name', 'vtable vtable');
vtable_vt.state('vtable', vtable_vt.state('id'));

object_vt = vtable_delegated(vtable_vt);
object_vt.state('name', 'object vtable');

vtable_vt.state('parent', object_vt.state('id'));
object_vt.state('parent', '0');

function_vt = vtable_delegated(vtable_vt);
function_vt.state('name', 'JS function vtable');

src['function.init'] = `function(rcv, name, code) {
  rcv.state('name', name || '<function>');
  rcv.state('code', code || '() => "unimplemented"', true);
}`;
function_init = compile(src['function.init']);

src['vtable.addMethod'] = `function(rcv, name, impl) {
  const symbol = '-'+name;
  return rcv.state(symbol, impl.state('id'));
}`;
vtable_addMethod = compile(src['vtable.addMethod']);
tmp = vtable_allocate(function_vt);
function_init(tmp, 'vtable.addMethod', src['vtable.addMethod']);
vtable_addMethod(vtable_vt, 'addMethod', tmp);

src['vtable.lookup'] = `function(rcv, name) {
  const symbol = '-'+name;
  const impl = rcv.state(symbol);
  const parent = rcv.state('parent');
  if (impl === '0' && parent !== '0')
    return send(deref(parent), 'lookup', name);
  else
    return deref(impl);
}`;
vtable_lookup = compile(src['vtable.lookup']);
tmp = vtable_allocate(function_vt);
function_init(tmp, 'vtable.lookup', src['vtable.lookup']);
vtable_addMethod(vtable_vt, 'lookup', tmp);

src['send'] = `function(rcv, selector, ...args) {
  const impl = bind(rcv, selector);
  const func = compile(impl.state('code'));
  return func(rcv, ...args);
}`;
send = compile(src['send']);

src['bind'] = `function(rcv, selector) {
  if (rcv === vtable_vt && selector === 'lookup') {
    return vtable_lookup(rcv, selector);
  } else {
    return send(deref(rcv.state('vtable')), 'lookup', selector);
  }
}`;
bind = compile(src['bind']);

tmp = vtable_allocate(function_vt);
function_init(tmp, 'vtable.allocate', src['vtable.allocate']);
send(vtable_vt, 'addMethod', 'allocate', tmp);

tmp = send(function_vt, 'allocate');
function_init(tmp, 'function.init', src['function.init']);
send(function_vt, 'addMethod', 'init', tmp)

tmp = send(function_vt, 'allocate');
send(tmp, 'init', 'vtable.delegated', src['vtable.delegated']);
send(vtable_vt, 'addMethod', 'delegated', tmp)

tmp = send(function_vt, 'allocate');
send(tmp, 'init', 'bind', src['bind']);

tmp = send(function_vt, 'allocate');
send(tmp, 'init', 'send', src['send']);

src['entity.init'] = `function(rcv) {
  let div = document.createElement("div"); // Create context-free div
  div.style = 'entity'; // Simple default
  document.body.appendChild(div); // Give the div a context
  let state = document.createElement("table");
  state.setAttribute('class', 'state');
  div.appendChild(state);
  div.entity = rcv;
  rcv.stateTab = state;
  rcv.div = div;

  state(rcv, 'id', nextId.toString());
  id_to_entity[nextId] = rcv;
  nextId++;
}`;

entity_init = send(function_vt, 'allocate')
send(entity_init, 'init', 'entity.init', src['entity.init']);

newsys = document.createElement('div');
document.body.appendChild(newsys);
newsys.style = 'border: 2px dashed blue';

transfer = x => {
  if (typeof(x) === 'number') x = deref(x);
  document.body.removeChild(x.div);
  newsys.appendChild(x.div);
}

transfer(entity_init);

src['new-vtable.allocate'] = `function(rcv) {
  let o = new_object();
  state(o, 'vtable', rcv);
  return o;
}`
tmp = send(function_vt, 'allocate');
send(tmp, 'init', 'new-vtable.allocate', src['new-vtable.allocate']);
transfer(tmp);

new_vtable_vt = send(vtable_vt, 'delegated');
new_vtable_vt.state('name', 'new vtable-vtable');
send(new_vtable_vt, 'addMethod', 'allocate', tmp);
transfer(new_vtable_vt);

entity_vt = send(new_vtable_vt, 'allocate');
entity_vt.state('name', 'entity vtable');
send(entity_vt, 'addMethod', 'init', entity_init);
transfer(entity_vt);

Entity.prototype.restoreDims = function() {
  if (this.state('name') === 'vtable vtable') {
    this.div.style.width = '371px';
    this.div.style.height = '218px';
  }
  if (this.state('name') === 'object vtable') {
    this.div.style.width = '254px';
    this.div.style.height = '132px';
  }
  if (this.state('name') === 'JS function vtable') {
    this.div.style.width = '266px';
    this.div.style.height = '166px';
  }
  if (this.state('name') === 'vtable.addMethod') {
    this.div.style.width = '363px';
    this.div.style.height = '168px';
    let code = this.getStateDOMNode('code');
    code.style.width = '283px';
    code.style.height = '57px';
  }
  if (this.state('name') === 'vtable.lookup') {
    this.div.style.width = '377px';
    this.div.style.height = '226px';
    let code = this.getStateDOMNode('code');
    code.style.width = '296px';
    code.style.height = '110px';
  }
  if (this.state('name') === 'vtable.allocate') {
    this.div.style.width = '325px';
    this.div.style.height = '182px';
    let code = this.getStateDOMNode('code');
    code.style.width = '243px';
    code.style.height = '74px';
  }
  if (this.state('name') === 'function.init') {
    this.div.style.width = '481px';
    this.div.style.height = '194px';
    let code = this.getStateDOMNode('code');
    code.style.width = '364px';
    code.style.height = '65px';
  }
  if (this.state('name') === 'vtable.delegated') {
    this.div.style.width = '395px';
    this.div.style.height = '278px';
    let code = this.getStateDOMNode('code');
    code.style.width = '299px';
    code.style.height = '148px';
  }
  if (this.state('name') === 'bind') {
    this.div.style.width = '469px';
    this.div.style.height = '203px';
    let code = this.getStateDOMNode('code');
    code.style.width = '396px';
    code.style.height = '93px';
  }
  if (this.state('name') === 'send') {
    this.div.style.width = '369px';
    this.div.style.height = '190px';
    let code = this.getStateDOMNode('code');
    code.style.width = '283px';
    code.style.height = '77px';
  }
  if (this.state('name') === 'entity.init') {
    this.div.style.width = '550px';
    this.div.style.height = '293px';
    let code = this.getStateDOMNode('code');
    code.style.width = '468px';
    code.style.height = '180px';
  }
  if (this.state('name') === 'new-vtable.allocate') {
    this.div.style.width = '325px';
    this.div.style.height = '182px';
    let code = this.getStateDOMNode('code');
    code.style.width = '243px';
    code.style.height = '74px';
  }
  if (this.state('name') === 'new vtable-vtable') {
    this.div.style.width = '360px';
    this.div.style.height = '210px';
  }
  if (this.state('name') === 'entity vtable') {
    this.div.style.width = '285px';
    this.div.style.height = '126px';
  }
}

for (let e of id_to_entity)
  if (e !== undefined) e.restoreDims();

function saveDims() {
  let dims = new Map();

  for (let e of id_to_entity) {
    if (e === undefined) continue;
    const width = e.div.style.width;
    const height = e.div.style.height;
    const entry = [width, height];
    try {
      let code = e.getStateDOMNode('code');
      entry.push(code.style.width);
      entry.push(code.style.height);
    } catch (TypeError) {}
    dims.set(e.state('name'), entry);
  }

  dimsSetters = Array.from(dims).map(([k,[w,h,cw,ch]]) => `
  if (this.state('name') === '${k}') {
    this.div.style.width = '${w}';
    this.div.style.height = '${h}';` +
  ((cw !== undefined && ch !== undefined) ? `
    let code = this.getStateDOMNode('code');
    code.style.width = '${cw}';
    code.style.height = '${ch}';` : '') + `
  }`
  );

  return dimsSetters.join();
}
