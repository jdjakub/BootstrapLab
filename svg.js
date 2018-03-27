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

universe = {};
state(universe, 'receive-message', recv_by_state_dispatch);
state(universe, 'dispatch', msg => {
  switch (msg.selector) {
    case 'dispatch':
      let dispatch = state(msg.to, 'dispatch');
      return m => dispatch(m.context);
    case 'created': return m => {  
        let svg = svgel('svg', body, { width: body.offsetWidth, height: body.offsetHeight });
        state(m.to, 'svg', svg);
        svg.addEventListener('click', e => {
          send(m.to, 'rect', m.to, {center: [e.offsetX, e.offsetY]});
        });
      };
    case 'rect': return m => {
        let svg = state(m.to, 'svg');
        let [x,y] = m.context.center;
        let [x_extent, y_extent] = [150, 100];
        let tl = [x - x_extent, y - y_extent];
        let rect = svgel('rect', svg, { x: tl[0].toString(), y: tl[1].toString() });
        attribs(rect, { width: 2*x_extent, height: 2*y_extent });
        attribs(rect, { fill: '#dddddd', stroke: '#000000' });
        attribs(rect, { stroke_opacity: '1', fill_opacity: '1' });
      };
    default:
      throw ["Does not understand", msg]
  }
});
send(null, 'created', universe);


