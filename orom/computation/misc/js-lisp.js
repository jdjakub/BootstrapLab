/*
[defun fac [fun [n]
  [if [= n 0] 1 [* n [fac [- n 1]]]]
]]
[fac 5]
*/

log = (...args) => { console.log(...args); return args[args.length-1]; };

let program = [
['define', 'fac', ['fun', ['n'],
  ['if', ['=', 'n', 0], 1, ['*', 'n', ['fac', ['-', 'n', 1]]]]
]],
['fac', 5]
];

let initial_env = {
  '=': (env, a, b) => a === b,
  '-': (env, a, b) => a-b,
  'define': (env, name, func_e) => {
    initial_env.entries[name] = eval(func_e, env);
  },
  '*': (env, a, b) => a*b,
  'fun': (env, pat_e, body_e) => [env, pat_e, body_e],
  'if': (env, cond_e, then_e, else_e) =>
    eval(eval(cond_e, env) ? then_e : else_e, env),
}
initial_env['define'].dont_eval_args = true;
initial_env   ['fun'].dont_eval_args = true;
initial_env    ['if'].dont_eval_args = true;

initial_env = { entries: initial_env };

function eval(expr, env) {
  if (typeof expr === 'string') {
    return lookup(env, expr);
  } else if (expr instanceof Array) { // it's a list; apply
    const func_e = expr[0], func = eval(func_e, env);
    let arg_vals = expr.slice(1); // rest of expr
    if (!func.dont_eval_args) arg_vals = arg_vals.map(arg => eval(arg, env));
    if (typeof func === 'function') return func(env, ...arg_vals);
    // func is closure
    const [inner_env, arg_names, body_e] = func;
    let new_env = bind(inner_env, arg_names, arg_vals);
    return eval(body_e, new_env);
  } else return expr;
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

let results = program.map(expr => eval(expr, initial_env));
log(results[1]);
