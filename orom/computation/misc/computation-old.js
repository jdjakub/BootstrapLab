body = document.body;
svg = document.getElementById('svg');

log = (x, str) => {
  if (str === undefined) console.log(x);
  else console.log(str, x);
  return x;
};

/*
An `address` is a literal `path`, a `predicate` or a `property`.
e.g. pointer.left, pointer.right, pointer.position,
     log_pointer's value-func, log_pointer depends-on: pointer.position,
     log_whether_dependent depends-on: (log_pointer depends-on: pointer.position)
*/

namespace = {};

function pred(...args) {
  args.is_predicate = true;
  return args;
}

function at(...path) {
  path = path.flatMap(x => typeof(x) === 'string'? str.split('.') : [x]);
  let start = namespace;
  let iKey = 0;
  if (typeof(path[0]) !== 'string') { // permit e.g. at(obj, ...path)
    start = path[0]; iKey = 1;
  }
  return {
    poll: () => { // Follow the path components to destination
      for (let i=iKey, dict=start; i < path.length; i++) {
        const key = path[i]; dict = dict[key];
        if (dict === undefined) return undefined; // abort
      }
      return dict.value;
    },
    change: (new_input) => { // Follow the path components to destination
      for (let i=iKey, dict=start; i < path.length; i++) {
        const key = path[i];
        if (dict[key] === undefined) dict[key] = {}; // lazy init
        dict = dict[key];
      }
      // Whenever we change a piece of state, we read its compute_func
      const compute_func = at(dict, 'compute_func').poll();
      if (compute_func === undefined) dict.value = new_input; // default to ident func
      else dict.value = compute_func(new_input);
      return propagate_effect(path, dict, dict.value);
    },
  };
}

// Propagate the changed output through the causal graph
function propagate_effect(path, origin, new_output) {
  // Discover the causal graph to update, default by DF traversal
  const frontier = query('*', 'depends-on:', path); // TODO: Polling semantics problem here!?
  // Feed this new output through the input of each dependent
  frontier.forEach(dependent => dependent.change(new_output));
}

// ### POINTER DEVICE DRIVERS

// Forget about coords; they are not part of the left button, or the keyboard, or the power button...
const onmouse = state => e => {
  const button = {0: 'left', 2: 'right'}[e.button];
  if (button !== undefined) at('pointer', button).change(state);
}
svg.onmousedown = onmouse('down');
svg.onmouseup   = onmouse('up');

// mousemove => pointer position changed
// https://stackoverflow.com/a/42711775
const pt = svg.createSVGPoint();
svg.onmousemove = e => {
  pt.x = e.clientX; pt.y = e.clientY;
  const pos = pt.matrixTransform(svg.getScreenCTM().inverse());
  at('pointer.position').change([pos.x, pos.y]); // TODO: vecs carry coord system
};

// ### EXAMPLE CODE

at('log_pointer.compute_func')).change(([x,y]) => log(`At [${x},${y}]`));
at('log_whether_dependent.compute_func').change((is_dependent) =>
  log(is_dependent? 'Dependent on pointer...' : 'No longer dependent on pointer'));

const whether_deps_on_ptr = pred('log_pointer', 'depends-on:', 'pointer.position');
pred('log_whether_dependent', 'depends-on:', whether_deps_on_ptr).change(true);

whether_deps_on_ptr.change(true);
// log_pointer now depends on ptr pos; log_whether_dependent notified
// > Dependent on pointer...
// Later on when ptr moved...
// > At [13,203]
