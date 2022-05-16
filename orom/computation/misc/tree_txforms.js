/*
[scene_node] =>
children := scene_node.children
state_node := scene_node.source
state_node is undefined ->
  source_node := scene_node^^.source
  source_key := scene_node.text[0:-1]
  state_node := [source_node].[source_key]
state_node is not an object -> return
lines := map_num_entries state_node
lines is 0 -> return

map_num_entries children is 0 ->
  scene_node.source :!= state_node
  for i, k: v in state_node:
    key_r := text: k + ':'
      top_left: { right: .2  up: -.3*i }
      children: {}
    v is an object or v is null ->
      key_r.children.1 :=
        top_left: { right: .75 }  text: v
    children.[i] := key_r
| _ ->
  lines := -1 * (measure_tree_height scene-node - 1)
  scene_node.children := {}
  
  siblings := scene_node^
  i := scene_node^k as int
  while siblings exists and i is an int:
    j := i+1
    sibling := siblings.[j]
    while sibling exists:
      sibling.top_left is undefined -> break
      sibling.top_left.up -:= .3*lines
      j++
      sibling := siblings.[j]
    siblings^ exists ->
      i := siblings^^k
      siblings := siblings^^
*/

/*
normalize struc =
  struc is normal -> struc
         |   name -> lookup struc in ENV
         |    map -> normalize-map struc
         |  apply -> reduce struc's head with its args
*/
function normalize(struc) {
  if (struc.deref) {
    const envs = map_get(ctx, 'env_s');
    return lookup(map_get(envs, map_get(envs, 'top')), struc.deref);
  } else if (typeof struc === 'object') {
    if (struc.is_normal) return struc;
    else if (struc.entries) return normalize_map(struc);
    else if (struc.apply) return reduce(struc.apply, struc.to);
  }
}

function lookup(maplet, name) {
  const v = map_get(maplet, 'entries', name);
  if (v !== undefined) return v;
  const parent = map_get(maplet, 'parent');
  if (parent === undefined) return;
  return lookup(parent, name);
}

/*
reduce proc_e with args_e =
  proc! = normalize proc_e
  proc! is reflective -> !(de-reflect proc!) args_e, env, cont
         | _ -> args! = normalize args_e
                proc is primitive -> cont ^(!proc! . !args!)
                      | _ -> normalize proc!'s body
                               in (bind its pattern to args! in its environment)
                               
*/
function reduce(proc_e, args_e) {
  const proc = normalize(proc_e);
  if (proc.is_reflective) throw "Can't do reflective stuff in JS";
  const args = normalize(args_e);
  if (typeof proc === 'function') // is primitive
    return proc(args);
  const pat = map_get(proc, 'pattern');
  const env = map_get(proc, 'environ');
  const new_env = map_new({ parent: env });
  const pos_i = 1;
  map_iter(pat, (i, arg_k) => {
    let arg_v = lookup(args, arg_k);
    if (arg_v === undefined) arg_v = lookup(args, pos_i);
    if (arg_v === undefined( throw ['Can\'t find', a];
  });
}

/*
key_r :=
  entries: 
    text: { apply: +  to: { entries: { 1: {deref: k}  2: : } } }
    top_left:
      entries:
        right: .2  up:
          apply: *  to: { entries: { 1: -.3  2: {deref: i} } }
    children: { entries: {} }


a.[b.[[[c]].typeof d].e].f
1: a                       l a; d; s map
2: deref:                  
   1: b                    s tmp1; l b; d; s map
   2: deref:
      1: deref: deref: c   s tmp2; l c; d; d; s map
      2: typeof: d         l d; typeof; i
                           l map; d; d; s tmp; l tmp2; d; s map; l tmp; d; i
   3: e                    l e; i
                           l map; d; d; s tmp; l tmp1; d; s map; l tmp; d; i
3: f                       l f; i

map := a                        l a; d; s map
push map := b                   s tmp1; l b; d; s map
push map := [[c]]               s tmp2; l c; d; d; s map
focus := d; typeof              l d; typeof
index; focus := map; deref      i; l map; d; d
tmp := focus                    s tmp
pop map := b                    l tmp2; d; s map
focus := tmp; index             l tmp; d; i
focus := 'e'                    l e
index; focus := map; deref      i; l map; d; d
tmp := focus                    s tmp
pop map := a                    l tmp1; d; s map
focus := tmp; index             l tmp; d; i
focus := 'f'                    l f
index                           i



type: index  key: f  map:
  type: index  map: a  key:
    type: deref  what:
      type: index  key:  e map:
        type: index  map: b  key:
          type: index  key: { type: typeof  what: d }  map:
            type: deref  what:
              type: deref  what: c
*/
          
    
