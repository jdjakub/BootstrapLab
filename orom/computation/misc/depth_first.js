// Recursive JS version
function tree_to_3js(node) { // TODO: layout
  if (typeof node === 'object') {
    const children = {};
    let tot_nlines = 0;
    map_iter(node, (key, val, i) => {
      const [val_3js, nlines] = tree_to_3js(val);
      tot_nlines++;
      children[i+1] = {
        top_left: {right: .2, up: -.3*tot_nlines}, text: key+':',
        children: val_3js
      };
      tot_nlines += nlines;
    });
    return [children, tot_nlines];
  } else
    return [{1: { top_left: {right: .75}, text: node }}, 0];
}

// Iterative JS version

curr_i = upd(ctx, 'stack_top', 1);
function conv_iter1() { //debugger;
  frame = map_get(stack, curr_i);
  key_r = map_get(frame, 'key_r');
  if (key_r === undefined) { // Render key part if not already done so.
    const voffs = curr_i > 1? map_get(stack, curr_i-1, 'nlines') * -.3 : 0;
    key_r = upd(frame, 'key_r', maps_init({
      text: map_get(frame, 'src_key')+':', top_left: {right: .2, up: voffs},
      children: {}
    }));
     // emit keypart render
    upd(map_get(frame, 'dst_map'), map_get(frame, 'dst_key'), key_r);
  }
  return conv_iter2;
}
/*
frame := stack[stack_top]  ;  l stack; d; s map; l stack_top; d; i; l map; d; s frame
key_r := frame.key_r      ;  l key_r; i; l map; d; s key_r
l conds; d; s map; l -1; s addend; l stack_top; d; +; s tmp; sign; i;
s source; l {}; store continue_to; l continue_to; d; s map; l map; s;
conds[-1] = conds[0] = l 0; s voffs
conds[1] = l -.3; s factor; l stack; d; s map; l tmp; d; i; l nlines; i;
           l map; d; *; s voffs
l { top_left: {right: .2}, children: {} }; s tmp; s map;
l top_left; i; l voffs; d; s source; l up; s;
l ':'; s addend; l frame; d; s map; l src_key; i; l map; d; +; s source;
l tmp; d; s map; l text; s
frame.key_r := key_r
frame.dst_map[frame.dst_key] := key_r
*/

function conv_iter2() { //debugger;
  curr_val = map_get(frame, 'src_val');
  if (typeof curr_val === 'object') {
    const entries = Object.entries(curr_val.entries);
    const entry_i = map_get(frame, 'entry_i'); // 1-based
    if (entry_i <= entries.length) {
      const [src_key, src_val] = entries[entry_i-1];
      const ch_frame = maps_init({ src_key, dst_key: entry_i, nlines: 1, entry_i: 1 });
      map_set(ch_frame, 'src_val', src_val);
      map_set(ch_frame, 'dst_map', map_get(key_r, 'children'));
      upd(frame, 'entry_i', entry_i+1);
      curr_i++; JSONTree.toggle(upd(stack, curr_i, ch_frame)); // push
      return conv_iter1;
    }
  } else {
    upd(key_r, 'children', 1, maps_init({ top_left: {right: .75}, text: curr_val }));
  }
  return conv_iter3;
}
/*
l frame; d; s map; l src_val; i; l map; d; s curr_val;
l instructions; d; s map; l example_rnd; i; l typeof_curr_val; i; l curr_val; d; typeof; i;
l map; d; s source; l {}; s continue_to; l continue_to; d; s map; l map; s
typeof_curr_val._ =
  l { top_left: {right: .75} }; s map; l curr_val; d; s source; l text; s;
  l map; d; s source; l key_r; d; s map; l children; i; l 1; s
typeof_curr_val.object =
  check for entry_i undefined - undefined can be JS key but JSONTree no like.
  l frame; d; s map; l entry_i; i; l map; d; s entry_i; 
  somehow obtain key in focus
  l curr_val; d; order; s curr_keys; s map; l entry_i; d; i; l map; d; s src_key;
  // if focus defined
  l curr_val; d; s map; l key; d; i; l map; d; s src_val;
  s source; l { nlines: 1, entry_i: 1 }; s ch_frame; s map; l src_val; s;
  l src_key; d; s source; l src_key; s;
  l entry_i; d; s source; l dst_key; s;
  l key_r; d; s map; l children; i; l map; d; s source; l ch_frame; d; s map; l dst_map; s
  l 1; s addend; l entry_i; d; +; s source; l frame; d; s map; l entry_i; s;
  l ch_frame; d; s source; l stack; d; s map;
  l 1; s addend; l stack_top; d; +; s stack_top; s
*/

function conv_iter3() { //debugger;
  upd(stack, curr_i, undefined); curr_i--; // pop
  if (curr_i > 0) {
    const parent_frame = map_get(stack, curr_i);
    upd(parent_frame, 'nlines', map_get(parent_frame, 'nlines')+map_get(frame, 'nlines'));
    return conv_iter1;
  }
}
/*
l stack; d; s map; l undefined; s source; l stack_top; d; s;
s addend; l -1; +; s stack_top;
l instructions; d; s map; ... l num_frames; i; l stack_top; d; sign; i;
l map; d; s source; goto
num_frames[-1] = [0] = goto start
num_frames[+1] =
l stack; d; s map; l stack_top; d; i; l map; d; s parent_frame;
l nlines; i; l map; d; s addend; l frame; d; s map; l nlines; i; l map; d; +; s source;
l parent_frame; d; s map; l nlines; s;
l key_r; i; l map; d; s key_r;
l parent_frame; d; s map; l src_val; i; l map; d; s curr_val;
l parent_frame; d; s frame; s map; l return; i; l map; d; s continue_to;
*/

f = conv_iter1;
//while (f) f=f();
