/*
[defun fac [fun [n]
  [if [= n 0] 1 [* n [fac [- n 1]]]]
]]
[fac 5]
*/

log = (...args) => { console.log(...args); return args[args.length-1]; };

let program = [
{apply: 'define', to: ['fac', {apply: 'fun', to: ['expr', ['n'],
  {apply: 'if', to: [ {apply: '=', to: ['n', 0]},
    1, {apply: '*', to: ['n', {apply: 'fac', to: ['-', 'n', 1]}]}]}
]}]},
{apply: 'fac', to: [5]}
];

function normalize(expr, env) {
  if (typeof expr === 'string') return lookup(env, expr);
  else if (expr instanceof Array) // it's a rail
    return expr.map(item => normalize(item, env));
  else if (expr instanceof Object) // it's a pair
    return reduce(expr.apply, expr.to, env);
  else return expr;
}

function reduce(proc_e, args_e, env) {
  const closure = eval(proc_e, env);
  const proc_type = closure.apply; // e.g. expr, impr, macro
  if (proc_type === lookup(initial_env, 'impr')) {
    if (!is_primitive(closure)) expand_closure(closure, args_e);
    else if (closure === lookup(initial_env, 'set')) {
      const binding = normalize(args_e[1], env);
      if (typeof args_e[0] !== 'string') throw ['set: key not string', args_e[0]];
      env.entries[args_e[0]] = binding;
    } else if (closure === lookup(initial_env, 'fun')) {
      const closure_type = normalize(args_e[0], env);
      return reduce(closure_type, [env, args[1], args[2]]);
    } else if (closure === lookup(initial_env, 'if')) {
      
    }
  } else if (proc_type === lookup(initial_env, 'expr')) {
    
  } else if (proc_type === lookup(initial_env, 'macro')) {
    
  }
  if (typeof func === 'function') {
    if (!func.dont_eval_args) arg_vals = arg_vals.map(arg => eval(arg, env));
    return func(env, ...arg_vals);
  }
  // func is closure represented as a normal-form pair
  const type = func.apply; // e.g. expr, impr, macro
  const [inner_env, arg_names, body_e] = func.to;
  let new_env = bind(inner_env, arg_names, arg_vals);
  return eval(body_e, new_env);  
}

function lookup(env, name) {
  let val = env.entries[name];
  const par = env.parent;
  if (val === undefined && par !== undefined)
    return lookup(par, name);
  else return val;
}

function bind(parent_env, names, vals) {
  const env = {};
  for (let i=0; i<names.length; i++) {
    const name = names[i], val = vals[i];
    env[name] = val;
  }
  return { entries: env, parent: parent_env };
}

let initial_env = {
  '=': (env, a, b) => a === b,
  '-': (env, a, b) => a-b,
  'define': (env, name, func_e) => {
    initial_env.entries[name] = eval(func_e, env);
  },
  '*': (env, a, b) => a*b,
  'fun': (env, type_e, pat_e, body_e) =>
    ({apply: eval(type_e, env), to: [env, pat_e, body_e]}),
  'if': (env, cond_e, then_e, else_e) =>
    eval(eval(cond_e, env) ? then_e : else_e, env),
}
initial_env['define'].dont_eval_args = true;
initial_env   ['fun'].dont_eval_args = true;
initial_env    ['if'].dont_eval_args = true;

initial_env = { entries: initial_env };

let results = program.map(expr => eval(expr, initial_env));
log(results[1]);
