/*
[define fac [fun [n]
  [if [= n 0] 1 [* n [fac [- n 1]]]]
]]
[fac 5]
*/

log = (...args) => { console.log(...args); return args[args.length-1]; };
DBG = () => { debugger; };

let program = [
['define', 'fac', ['fun', ['n'],
  ['if', ['=', 'n', 0], 1, ['*', 'n', ['fac', ['-', 'n', 1]]]]
]],
['fac', 1]
];

let initial_env = {
  '=': (env, a, b) => { ctx.value = a === b; return true; },
  '-': (env, a, b) => { ctx.value = a-b; return true; },
  'define': (env, name, func_e) => {
    if (func_e.value !== undefined) {
      initial_env.entries[name] = func_e.value; ctx.value = null; return true;
    } else
      ctx = ctx.expr[2] = { return_to: ctx, expr: func_e };
  },
  '*': (env, a, b) => { ctx.value = a*b; return true; },
  'fun': (env, pat_e, body_e) => {
    ctx.value = [env, pat_e, body_e]; return true;
  },
  'if': (env, cond_e, then_e, else_e) => {
    if (cond_e.value === undefined)
      ctx = ctx.expr[1] = { return_to: ctx, expr: cond_e };
    else {
      const [expr,i] = cond_e.value ? [then_e,2] : [else_e,3];
      if (expr.value === undefined)
        ctx = ctx.expr[i] = { return_to: ctx, expr: expr };
      else { ctx.value = expr.value; return true; }
    }
  },
}
initial_env['define'].dont_eval_args = true;
initial_env   ['fun'].dont_eval_args = true;
initial_env    ['if'].dont_eval_args = true;

initial_env = { entries: initial_env };

program = program.map(stmt => ({ expr: stmt, env: initial_env }));

ctx = program[0];

// We don't eval an expr, we eval a ctx = expr with env.
function eval() {
  let expr = ctx.expr;
  if (expr.value !== undefined) console.warn('Already eval\'d: ', expr, expr.value);
  if (expr instanceof Array) { // it's a list; apply
    if (expr[0].value === undefined) { // eval the func expr
      // make a shallow copy of expr and wrap the func expr within it
      ctx.expr = [...ctx.expr];
      ctx = ctx.expr[0] = { expr: expr[0], return_to: ctx }; return;
    }
    const func = expr[0].value;
    let arg_vals = expr.slice(1);
    if (!func.dont_eval_args) {
      // eval the args exprs
      if (ctx.arg_i === undefined) ctx.arg_i = 1;
      if (ctx.arg_i < expr.length) {
        const arg = expr[ctx.arg_i], this_ctx = ctx;
        ctx = expr[ctx.arg_i] = { expr: arg, return_to: this_ctx };
        this_ctx.arg_i++; return;
      } else arg_vals = arg_vals.map(a => a.value);
    }
    if (typeof func === 'function') {
      if (!func(current_env(), ...arg_vals)) return;
    } else { // func is closure
      let [inner_env, arg_names, body_ctx] = func;
      if (body_ctx.value !== undefined) ctx.value = body_ctx.value;
      else {
        const body_e = body_ctx; // it's actually an expr, not yet a ctx
        let body_env = bind(inner_env, arg_names, arg_vals);
        // instantiate a fresh body ctx in a copy of the closure
        body_ctx = { expr: body_e, env: body_env, return_to: ctx };
        expr[0].value = [inner_env, arg_names, body_ctx];
        ctx = body_ctx; return; // evaluate the body
      }
    }
  } else if (typeof expr === 'string') ctx.value = lookup();
  else ctx.value = expr;
  const ret = ctx.return_to; delete ctx.return_to;
  ctx = ret;
}

function current_env() {
  let curr_ctx = ctx;
  while (curr_ctx.env === undefined) curr_ctx = curr_ctx.return_to;
  return curr_ctx.env;
}

function lookup() {
  const name = ctx.expr;
  const try_lookup = env => {
    let val = env.entries[name];
    const par = env.parent;
    if (val === undefined && par !== undefined)
      return try_lookup(par);
    else return val;
  }
  return try_lookup(current_env());
}

function bind(parent_env, names, vals) {
  const env = {};
  for (let i=0; i<names.length; i++) {
    const name = names[i], val = vals[i];
    env[name] = val;
  }
  return { entries: env, parent: parent_env };
}

while (ctx) eval(); // run first statement to completion
ctx = program[1];
// Repeat:
// eval(); ctx.expr
// to watch the evaluation of the call to fac
