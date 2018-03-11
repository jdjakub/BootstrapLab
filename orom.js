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

state = function(o,k,v) {
  if (o.state !== undefined)
    return o.state(k,v);
  else if (o[0] !== undefined && o[1] !== undefined)
    return state(o[1],k,v);
  else {
    let retn = o[k];
    if (v !== undefined) o[k] = v;
    return retn;
  }
};

multiline = function(str) {
  let elem = document.createElement('textarea');
  elem.value = str;
  return elem;
}

Entity = function() { // Because "Object" is taken, as usual...
  let div = document.createElement("div"); // Create context-free div
  for (let [k,v] of Entity.defaultStyle.entries()) {
    div.style[k] = v; // See definition of defaultStyle below
  }
  document.body.appendChild(div); // Give the div a context
  this.stateTab = document.createElement("table");
  this.stateTab.setAttribute('class', 'state');
  div.appendChild(this.stateTab);
  div.entity = this;
  this.div = div;

  state(this, 'id', Entity.nextId.toString());
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
  if (typeof(id) === 'object') return id;
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
    } else {
      node.replaceWith(value);
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

Entity.prototype.state = function(key, value) {
  const tr = this.stateTab.querySelector('.' + key); // Get row
  if (tr === null) {
    if (value === undefined) return '0';
    else this.addState(key);
  }
  return this.existingState(key, value);
}

src = {}

src['vtable.allocate'] = `function(rcv) {
  let ent = new Entity();

  state(ent, 'vtable', state(rcv, 'id'));
  return ent;
}`;

src['vtable.delegated'] = `function(rcv) {
  let newVT = new Entity();
  
  if (rcv === '0') {
    state(newVT, 'vtable', '0');
    state(newVT, 'parent', '0');
  } else {
    state(newVT, 'vtable', state(rcv, 'vtable'));
    state(newVT, 'parent', state(rcv, 'id'));
  }
  
  return newVT;
}`;

compile = src => new Function('return '+src)();

call_func = function(f, ...args) {
  f = compile(state(f, 'code'));
  return f(...args);
}

vtable_allocate  = compile(src['vtable.allocate']);
vtable_delegated = compile(src['vtable.delegated']);
vtable_lookup    = compile(src['vtable.lookup']);

vtable_vt = vtable_delegated('0');
state(vtable_vt, 'name', 'vtable vtable');
state(vtable_vt, 'vtable', state(vtable_vt, 'id'));

object_vt = vtable_delegated(vtable_vt);
state(object_vt, 'name', 'object vtable');

state(vtable_vt, 'parent', state(object_vt, 'id'));
state(object_vt, 'parent', '0');

function_vt = vtable_delegated(vtable_vt);
state(function_vt, 'name', 'JS function vtable');

src['function.init'] = `function(rcv, name, code) {
  state(rcv, 'name', name || '<function>');
  state(rcv, 'code', multiline(code || '() => "unimplemented"'));
}`;
function_init = compile(src['function.init']);

src['vtable.addMethod'] = `function(rcv, name, impl) {
  const symbol = '-'+name;
  return state(rcv, symbol, state(impl, 'id'));
}`;
vtable_addMethod = compile(src['vtable.addMethod']);
tmp = vtable_allocate(function_vt);
function_init(tmp, 'vtable.addMethod', src['vtable.addMethod']);
vtable_addMethod(vtable_vt, 'addMethod', tmp);

src['vtable.lookup'] = `function(rcv, name) {
  const symbol = '-'+name;
  const impl = state(rcv, symbol);
  const parent = state(rcv, 'parent');
  if (impl === '0' && parent !== '0')
    return send(deref(parent), 'lookup', name);
  else
    return impl;
}`;
vtable_lookup = compile(src['vtable.lookup']);
tmp = vtable_allocate(function_vt);
function_init(tmp, 'vtable.lookup', src['vtable.lookup']);
vtable_addMethod(vtable_vt, 'lookup', tmp);

src['send'] = `function(rcv, selector, ...args) {
  const impl = bind(rcv, selector);
  return call_func(impl, rcv, ...args);
}`;
send = compile(src['send']);

src['bind'] = `function(rcv, selector) {
  let impl;
  if (rcv === vtable_vt && selector === 'lookup')
    impl = vtable_lookup(rcv, selector);
  else
    impl = send(deref(state(rcv, 'vtable')), 'lookup', selector);
  if (impl === '0')
    throw \`Entity \${state(rcv, 'id')} does not understand \${selector}\`;
  else
    return deref(impl);
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

src['entity.dom-node'] = `function(rcv) {
  let div = document.createElement('div');
  div.className = 'entity'; // Simple default
  let name = document.createElement('h3');
  name.textContent = state(rcv, 'name') || '<object>';
  div.appendChild(name);
  div.entity = rcv;
  rcv.div = div;
  return div;
}`;

entity_domNode = send(function_vt, 'allocate')
send(entity_domNode, 'init', 'entity.dom-node', src['entity.dom-node']);

newsys = document.createElement('div');
document.body.appendChild(newsys);
newsys.style = 'border: 2px dashed blue';

transfer = x => {
  if (typeof(x) === 'number') x = deref(x);
  document.body.removeChild(x.div);
  newsys.appendChild(x.div);
}

transfer(entity_domNode);

src['new-vtable.allocate'] = `function(rcv) {
  let o = new_object();
  state(o, 'vtable', rcv);
  return o;
}`
tmp = send(function_vt, 'allocate');
send(tmp, 'init', 'new-vtable.allocate', src['new-vtable.allocate']);
transfer(tmp);

new_vtable_vt = send(vtable_vt, 'delegated');
state(new_vtable_vt, 'name', 'new vtable-vtable');
send(new_vtable_vt, 'addMethod', 'allocate', tmp);
transfer(new_vtable_vt);

entity_vt = send(new_vtable_vt, 'allocate');
state(entity_vt, 'name', 'entity vtable');
send(entity_vt, 'addMethod', 'dom-node', entity_domNode);
transfer(entity_vt);

tmp = send(function_vt, 'allocate');
src['object.to-javascript'] = `function(rcv) {
  let trs = rcv.stateTab.querySelectorAll('tr');
  let pairs = Array.from(trs).map(tr => {
    let key = tr.className;
    let value_elem = tr.querySelector('.value').children[0];
    return [key, value_elem];
  });
  let state_setters = pairs.map(([k, velem]) => {
    let value_js_expr = dom_to_js(velem);
    return \`state('\${k}', \${value_js_expr});\`;
  });
  let preamble = \`object(\${state(rcv, 'id')});\`;
  let code = preamble + '\\n' + state_setters.join('\\n');
  return code;
}`
send(tmp, 'init', 'object.to-javascript', src['object.to-javascript']);

send(object_vt, 'addMethod', 'to-javascript', tmp);

src['view.attach'] = `function(view, obj) {
  let dom = send(obj, 'dom-node', view);
  view.div.appendChild(dom);
}`;

tmp = send(function_vt, 'allocate');
send(tmp, 'init', 'view.attach', src['view.attach'])

transfer(tmp);

Entity.prototype.restoreDims = function() {
  if (state(this, 'name') === 'vtable vtable') {
    this.div.style.width = '371px';
    this.div.style.height = '218px';
  }
  if (state(this, 'name') === 'object vtable') {
    this.div.style.width = '335px';
    this.div.style.height = '186px';
  }
  if (state(this, 'name') === 'JS function vtable') {
    this.div.style.width = '266px';
    this.div.style.height = '166px';
  }
  if (state(this, 'name') === 'vtable.addMethod') {
    this.div.style.width = '363px';
    this.div.style.height = '168px';
    let code = this.getStateDOMNode('code');
    code.style.width = '283px';
    code.style.height = '57px';
  }
  if (state(this, 'name') === 'vtable.lookup') {
    this.div.style.width = '377px';
    this.div.style.height = '226px';
    let code = this.getStateDOMNode('code');
    code.style.width = '296px';
    code.style.height = '110px';
  }
  if (state(this, 'name') === 'vtable.allocate') {
    this.div.style.width = '354px';
    this.div.style.height = '210px';
    let code = this.getStateDOMNode('code');
    code.style.width = '265px';
    code.style.height = '82px';
  }
  if (state(this, 'name') === 'function.init') {
    this.div.style.width = '481px';
    this.div.style.height = '194px';
    let code = this.getStateDOMNode('code');
    code.style.width = '398px';
    code.style.height = '72px';
  }
  if (state(this, 'name') === 'vtable.delegated') {
    this.div.style.width = '395px';
    this.div.style.height = '278px';
    let code = this.getStateDOMNode('code');
    code.style.width = '317px';
    code.style.height = '155px';
  }
  if (state(this, 'name') === 'bind') {
    this.div.style.width = '523px';
    this.div.style.height = '251px';
    let code = this.getStateDOMNode('code');
    code.style.width = '445px';
    code.style.height = '132px';
  }
  if (state(this, 'name') === 'send') {
    this.div.style.width = '369px';
    this.div.style.height = '190px';
    let code = this.getStateDOMNode('code');
    code.style.width = '283px';
    code.style.height = '77px';
  }
  if (state(this, 'name') === 'entity.dom-node') {
    this.div.style.width = '440px';
    this.div.style.height = '250px';
    let code = this.getStateDOMNode('code');
    code.style.width = '354px';
    code.style.height = '137px';
  }
  if (state(this, 'name') === 'new-vtable.allocate') {
    this.div.style.width = '294px';
    this.div.style.height = '188px';
    let code = this.getStateDOMNode('code');
    code.style.width = '189px';
    code.style.height = '78px';
  }
  if (state(this, 'name') === 'new vtable-vtable') {
    this.div.style.width = '360px';
    this.div.style.height = '210px';
  }
  if (state(this, 'name') === 'entity vtable') {
    this.div.style.width = '396px';
    this.div.style.height = '146px';
  }
  if (state(this, 'name') === 'object.to-javascript') {
    this.div.style.width = '488px';
    this.div.style.height = '295px';
    let code = this.getStateDOMNode('code');
    code.style.width = '390px';
    code.style.height = '178px';
  }
  if (state(this, 'name') === 'view.attach') {
    this.div.style.width = '351px';
    this.div.style.height = '167px';
    let code = this.getStateDOMNode('code');
    code.style.width = '268px';
    code.style.height = '59px';
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
    dims.set(state(e, 'name'), entry);
  }

  dimsSetters = Array.from(dims).map(([k,[w,h,cw,ch]]) =>
`  if (state(this, 'name') === '${k}') {
    this.div.style.width = '${w}';
    this.div.style.height = '${h}';` +
  ((cw !== undefined && ch !== undefined) ? `
    let code = this.getStateDOMNode('code');
    code.style.width = '${cw}';
    code.style.height = '${ch}';` : '') + `
  }`);

  return dimsSetters.join('\n');
}

function dom_to_js(elem) {
  // NB: currently only supports <input> and <textarea>
  let val = elem.tagName === 'TEXTAREA' ? btoa(elem.value) : elem.value;
  return `dom('${elem.tagName}', '${val}')`;
}

function describeInJavaScript() {
  if (typeof(window.dom_to_js) !== 'function') throw "Must have dom_to_js";
  return id_to_entity.map(e => send(e, 'to-javascript')).join('\n');
}
