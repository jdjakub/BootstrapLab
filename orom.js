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

vtable_allocate = compile(src['vtable.allocate']);
vtable_delegated = compile(src['vtable.delegated']);

vtable_vt = vtable_delegated('0');
vtable_vt.state('name', 'vtable vtable');
vtable_vt.state('vtable', vtable_vt.state('id'));

object_vt = vtable_delegated(vtable_vt);
object_vt.state('name', 'object vtable');

vtable_vt.state('parent', object_vt.state('id'));

function_vt = vtable_delegated(vtable_vt);
function_vt.state('name', 'JS function vtable');

tmp = vtable_allocate(function_vt);
tmp.state('name', 'vtable.allocate');
tmp.state('code', src['vtable.allocate'], true);

tmp = vtable_allocate(function_vt);
tmp.state('name', 'vtable.delegated');
tmp.state('code', src['vtable.delegated'], true);

Entity.prototype.restoreDims = function() {
  if (this.state('name') === 'vtable vtable') {
    this.div.style.width = '5cm';
    this.div.style.height = '5cm';
  }
  if (this.state('name') === 'object vtable') {
    this.div.style.width = '267px';
    this.div.style.height = '199px';
  }
  if (this.state('name') === 'JS function vtable') {
    this.div.style.width = '260px';
    this.div.style.height = '211px';
  }
  if (this.state('name') === 'vtable.allocate') {
    this.div.style.width = '439px';
    this.div.style.height = '300px';
  }
  if (this.state('name') === 'vtable.delegated') {
    this.div.style.width = '476px';
    this.div.style.height = '350px';
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
