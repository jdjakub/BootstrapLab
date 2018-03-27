document.documentElement.style.height = '99%';

body = document.body;
body.style.border = '2px dashed red';
body.style.margin = '0px';
body.style.minHeight = '100%';

attribs = (elem, attrs) => {
  for (let [k,v] of Object.entries(attrs)) {
    elem.setAttribute(k.replace('_','-'), v);
  }
};

svgel = (tag, parent, attrs) => {
  let elem = document.createElementNS("http://www.w3.org/2000/svg", tag);
  if (attrs !== undefined) attribs(elem, attrs);
  if (parent !== undefined)
    parent.appendChild(elem);
  return elem;
};

state = function(o, k, v) {
  let old = o[k];
  if (v !== undefined) {
    o[k] = v;
  }
  return old;
}

send = function(sender, selector, receiver, context) {
  // Short-form to long-form
  let message;
  if (selector === undefined) message = sender;
  else {
    message = { from: sender,
                to: receiver,
                selector: selector,
                context: context };
  }

  // Let the receiver itself handle the message *however* it wants
  let receive_message = state(message.to, 'receive-message');
  return receive_message(message);
};

recv_by_state_dispatch = msg => {
  let dispatch = state(msg.to, 'dispatch');
  let method_impl = dispatch(msg);
  return method_impl(msg);
};

dispatch_via_table = msg => {
  let t = state(msg.to, 'dispatch-table');
  let method_impl = t[msg.selector];
  if (method_impl === undefined) throw ["Does not understand", msg];
  return method_impl;
};

universe = {};

state(universe, 'receive-message', recv_by_state_dispatch);

state(universe, 'dispatch', dispatch_via_table);
state(universe, 'dispatch-table', {
  ['dispatch']: msg => {
    let d = state(msg.to, 'dispatch');
    return dispatch(m.context)
  },
  ['created']: msg => {  
    let svg = svgel('svg', body, { width: body.offsetWidth, height: body.offsetHeight });
    state(msg.to, 'svg', svg);
    svg.addEventListener('mouseup', e => {
      send(msg.to, 'rect', msg.to, {center: [e.offsetX, e.offsetY]});
    });
  },
  ['rect']: msg => {
    let svg = state(msg.to, 'svg');
    let [x,y] = msg.context.center;
    let [x_extent, y_extent] = [150, 100];
    let tl = [x - x_extent, y - y_extent];
    let rect = svgel('rect', svg, { x: tl[0].toString(), y: tl[1].toString() });
    attribs(rect, { width: 2*x_extent, height: 2*y_extent });
    attribs(rect, { fill: '#dddddd', stroke: '#000000', stroke_width: '2' });
    attribs(rect, { stroke_opacity: '1', fill_opacity: '1' });
    rect.addEventListener('mouseup', e => {
      if (!rect.isActive) {
        rect.setAttribute('stroke', '#0000ff');
        rect.setAttribute('stroke-width', '4');
        rect.isActive = true;
      } else {
        rect.setAttribute('stroke', '#000000');
        rect.setAttribute('stroke-width', '2');
        rect.isActive = false;
      }
      e.stopPropagation();
    });
  }
});

send(null, 'created', universe);


