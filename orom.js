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
  deref[Entity.nextId] = this;
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
deref = [];

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

function_vt = vtable_delegated(vtable_vt);
function_vt.state('name', 'JS function vtable');

src['vtable.addMethod'] = `function(rcv, name, impl) {
  const symbol = '-'+name;
  return rcv.state(symbol, impl.state('id'));
}`;
vtable_addMethod = compile(src['vtable.addMethod']);
tmp = vtable_allocate(function_vt);
tmp.state('name', 'vtable.addMethod');
tmp.state('code', src['vtable.addMethod'], true);
vtable_addMethod(vtable_vt, 'addMethod', tmp);

src['vtable.lookup'] = `function(rcv, name) {
  const symbol = '-'+name;
  const impl = rcv.state(symbol);
  const parent = rcv.state('parent');
  if (impl === '0' && parent !== '0')
    return send(parent, 'lookup', name);
  else
    return deref[impl];
}`;
vtable_lookup = compile(src['vtable.lookup']);
tmp = vtable_allocate(function_vt);
tmp.state('name', 'vtable.lookup');
tmp.state('code', src['vtable.lookup'], true);
vtable_addMethod(vtable_vt, 'lookup', tmp);

src['send'] = `function send(rcv, selector, ...args) {
  const impl = bind(rcv, selector);
  const func = compile(impl.state('code'));
  return func(rcv, ...args);
}`;
send = compile(src['send']);

src['bind'] = `function bind(rcv, selector) {
  if (rcv === vtable_vt && selector === 'lookup') {
    return vtable_lookup(rcv, selector);
  } else {
    return send(deref[rcv.state('vtable')], 'lookup', selector);
  }
}`;
bind = compile(src['bind']);

tmp = vtable_allocate(function_vt);
tmp.state('name', 'vtable.allocate');
tmp.state('code', src['vtable.allocate'], true);
send(vtable_vt, 'addMethod', 'allocate', tmp);

tmp = send(function_vt, 'allocate');
tmp.state('name', 'bind');
tmp.state('code', src['bind'], true);

tmp = send(function_vt, 'allocate');
tmp.state('name', 'send');
tmp.state('code', src['send'], true);

Entity.prototype.restoreDims = function() {
  if (this.state('name') === 'vtable vtable') {
    this.div.style.width = '371px';
    this.div.style.height = '218px';
  }
  if (this.state('name') === 'object vtable') {
    this.div.style.width = '188px';
    this.div.style.height = '129px';
  }
  if (this.state('name') === 'JS function vtable') {
    this.div.style.width = '187px';
    this.div.style.height = '136px';
  }
  if (this.state('name') === 'vtable.addMethod') {
    this.div.style.width = '363px';
    this.div.style.height = '168px';
  }
  if (this.state('name') === 'vtable.lookup') {
    this.div.style.width = '334px';
    this.div.style.height = '224px';
  }
  if (this.state('name') === 'vtable.allocate') {
    this.div.style.width = '325px';
    this.div.style.height = '182px';
  }
  if (this.state('name') === 'bind') {
    this.div.style.width = '469px';
    this.div.style.height = '203px';
  }
  if (this.state('name') === 'send') {
    this.div.style.width = '369px';
    this.div.style.height = '190px';
  }
}

for (let e of deref)
  if (e !== undefined) e.restoreDims();

function saveDims() {
  let dims = new Map();

  for (let e of deref) {
    if (e === undefined) continue;
    const width = e.div.style.width;
    const height = e.div.style.height;
    dims.set(e.state('name'), [width,height]);
  }

  dimsSetters = Array.from(dims).map(([k,[w,h]]) =>
`if (this.state('name') === '${k}') {
  this.div.style.width = '${w}';
  this.div.style.height = '${h}';
}`
  );

  return dimsSetters.join('\n');
}
