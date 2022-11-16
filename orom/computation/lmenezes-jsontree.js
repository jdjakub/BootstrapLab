//https://github.com/lmenezes/json-tree, heavily modified
/*
The MIT License (MIT)

Copyright (c) 2013 Leonardo Menezes

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
JSONTree = { // eslint-disable-line no-unused-vars
  escapeMap: {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '', /* &quot; */
    '\'': '&#x27;',
    '/': '&#x2F;',
  },

  internalId: 0,
  instances: 0,

  id_of_obj: new Map(),
  last_highlighted: new Map(),

  create: function(data, id_of_obj_map, treeView) {
    JSONTree.instances += 1;
    JSONTree.id_of_obj = id_of_obj_map;
    treeView.innerHTML =
`<div class="jstTree">
  <span class="jstProperty" style="display: none;">[root]</span>
  <div></div>
</div>`;
    JSONTree.renderFrom(data, treeView.firstElementChild.children[1]);
  },

  locate: function(obj, key) {
    const id = JSONTree.id_of_obj.get(obj);
    const jstLists = Array.from(document.querySelectorAll('.object_'+id)); // property lists
    if (key === undefined) return jstLists.map(l => [l, null]);

    return jstLists.map(jstList => {
      let jstItem = jstList.firstElementChild; // property entries
      // Search for the key ... (not like there's a better way to do this >.>)
      while (jstItem !== null) // '': make sure number keys e.g. 2 go to strings...
        if (jstItem.querySelector('.jstProperty').textContent === ''+key) break;
        else jstItem = jstItem.nextElementSibling;
      return [jstList, jstItem];
    });
  },

  update: (obj, key) => {
    const value = map_get(obj, key);
    return JSONTree.locate(obj, key).forEach(([jstList, jstItem]) => {
    if (value === undefined) { // "set to undefined" means "remove it"
      if (jstItem !== null) jstItem.remove();
      return;
    } else if (jstItem === null) { // New entry - insert it at the top
      jstList.insertAdjacentHTML('afterbegin',
        '<li class="jstItem">' + JSONTree._property(key, null) + '</li>');
      jstItem = jstList.firstElementChild;
    }

    // Splice in the value
    const jstColon = jstItem.querySelector('.jstColon');
    let jstValue = jstColon.nextElementSibling;
    //if (jstValue.classList.contains('jstBracket')) jstValue = jstValue.nextElementSibling;
    JSONTree.renderFrom(value, jstValue);
  });},

  highlight: function(cssClass, obj, key) {
    if (obj === undefined) return;
    let jstPropsOrLists = JSONTree.locate(obj, key);
    let obj_deleted = false;
    if (key === undefined) // Highlight the entire jstItem containing the jstList
      jstPropsOrLists = jstPropsOrLists.map(([jstList,_]) => jstList.parentElement);
    else // Highlight the key name in the jstItem
      jstPropsOrLists = jstPropsOrLists.map(([_,jstItem]) => {
        if (jstItem !== null) return jstItem.querySelector('.jstProperty');
        obj_deleted = true; return null;
      });
    if (obj_deleted) return;

    // Turn the old one off
    let lastChanged = JSONTree.last_highlighted.get(cssClass);
    if (lastChanged !== undefined)
      lastChanged.forEach(e => e.classList.toggle(cssClass));

    // Turn the new one on
    jstPropsOrLists.forEach(e => e.classList.toggle(cssClass));
    JSONTree.last_highlighted.set(cssClass, jstPropsOrLists);
  },

  toggle: (obj) => JSONTree.locate(obj).forEach(([jstList, jstItem]) => {
    JSONTree.click(jstList.parentElement.firstElementChild);
  }),

  click: function(jstCollapse) {
    const jstList = jstCollapse.parentElement.querySelector('.jstList');
    if (!jstList) { // must be jstRef; delete the collapse control
      jstCollapse.remove();
      return;
    }
    if (jstCollapse.className === 'jstCollapse')
      jstCollapse.className = 'jstExpand'
    else
      jstCollapse.className = 'jstCollapse'
    jstList.classList.toggle('jstHiddenBlock');
  },

  _id: function() {
    return JSONTree.instances + '_' + JSONTree.internalId++;
  },

  _escape: function(text) {
    return text.replace(/[&<>'"]/g, function(c) {
      return JSONTree.escapeMap[c];
    });
  },

  _jsPrimitive: function(value) {
    const type = typeof value;
    switch (type) {
      case 'boolean': return JSONTree._jsBool(value);
      case 'number': return JSONTree._jsNum(value);
      case 'string': return JSONTree._jsStr(value);
      case 'function': return JSONTree._jsFunc(value);
      default:
        if (value === null) {
          return JSONTree._jsNull();
        } else return JSONTree._element('(not primitive!)', {class: 'jstErr'});
    }
  },

  renderFrom: function(value, outputElem) {
    if (value === null || typeof value !== 'object') {
      outputElem.outerHTML = JSONTree._jsPrimitive(value); return;
    }
    
    let { id } = ref(value); // Phase 1: detect cycles. linear in tree path
    for (let curr=outputElem.parentElement, i=0, str=''; curr;
         curr = curr.parentElement, i++) {
      if (i % 2 === 1) str += '^';
      if (curr.classList.contains('object_'+id)) { // avoid cycles
        if (curr.parentElement) str += curr.parentElement.querySelector('.jstProperty').innerText;
        outputElem.outerHTML = JSONTree._element(str+' (obj '+id+')', {class: 'jstRef'});
        return;
      }
    }
    const elements = [];
    let entries = [];
    map_iter(value, (k, v) => { entries.push([k,v]); });
    // Do numerical indices *after* string keys usually
    const nums = entries.filter(([k,v]) =>  Number.isInteger(+k));
    const strs = entries.filter(([k,v]) => !Number.isInteger(+k));
    if (strs.length === 1 && strs[0][0] === '_') entries = nums.concat(strs);
    else entries = strs.concat(nums);
    entries.forEach(([key, value]) => {
      if (value === undefined) return;
      const html = [];
      html.push('<li class="jstItem">');
      html.push(JSONTree._property(key, value));
      //if (index !== keys.length - 1) {
      html.push(JSONTree._comma());
      //}
      html.push('</li>');
      elements.push(html.join(''));
    });
    const body = elements.join('');
    let classes = '';
    if (id !== 0) {
      const firstEl = outputElem.parentElement.firstElementChild;
      if (firstEl && firstEl.classList.contains('jstExpand')) classes = ' jstHiddenBlock';
      if (!firstEl || !firstEl.classList.contains('jstCollapse')
                   && !firstEl.classList.contains('jstExpand'))
        outputElem.parentElement.insertAdjacentHTML(
          'afterbegin', JSONTree._collapseElem()
        );
    }
    outputElem = replaceDOM(outputElem, [JSONTree._open('{', id),
      '<ul class="jstList object_'+id+classes+'">', body, '</ul>',
    JSONTree._close('}', id)].join(''));
    outputElem.querySelectorAll('.valuePlaceholder').forEach(child =>
      JSONTree.renderFrom(deref(+child.innerText), child)
    );
  },

  _jsFunc: function(func) {
    const jsonString = JSONTree._escape(func.toString());
    return JSONTree._element(jsonString, {class: 'jstFunc'});
  },

  _collapseElem: function() {
    const onClick = 'onclick="JSONTree.click(this); return false;"';
    return '<span class="jstCollapse" ' + onClick + '></span>';
  },

  _expandElem: function() {
    const onClick = 'onclick="JSONTree.click(this); return false;"';
    return '<span class="jstExpand" ' + onClick + '></span>';
  },

  _canCollapse: function(value, jstValue) {
    const type = typeof value;
    switch (type) {
      case 'boolean':
      case 'number':
      case 'string':
      case 'function':
        return false;
      default:
        if (value === null) {
          return false;
        //} else if (data instanceof Array) {
        //  return data.length > 0;
      } else return !jstValue.classList.contains('jstRef'); //map_num_entries(data) > 0;
    }
  },

  _collection: function(opening, data, closing, id) {
    //if (data.length > 0) {
      return [
        opening,
        '<ul class="jstList object_'+id+'">',
        data,
        '</ul>',
        closing,
      ].join('');
    /*} else {
      return opening + closing;
    }*/
  },

  _jsStr: function(value) {
    const jsonString = JSONTree._escape(
      value.length === 0 ? '<empty string>' : JSON.stringify(value)
    );
    return JSONTree._element(jsonString, {class: 'jstStr'});
  },

  _jsNum:  value => JSONTree._element(
    Number.isInteger(value) ? value : value.toPrecision(4), {class: 'jstNum'}
  ),
  _jsBool: value => JSONTree._element(value, {class: 'jstBool'}),
  _jsNull:    () => JSONTree._element('null', {class: 'jstNull'}),

  _property: function(name, value) {
    const escapedName = JSONTree._escape(JSON.stringify(name));
    const property = JSONTree._element(escapedName, {class: 'jstProperty'});
    let propertyValue;
    if (value !== null && typeof value === 'object')
      propertyValue = '<div class="valuePlaceholder">'+ref(value).id+'</div>';
    else propertyValue = JSONTree._jsPrimitive(value);
    return [property + JSONTree._colon(), propertyValue].join('');
  },

  _colon: () => JSONTree._element(': ', {class: 'jstColon'}),
  _comma: () => JSONTree._element(',', {class: 'jstComma'}),

  _element: function(content, attrs) {
    const attrsStr = Object.keys(attrs).map(attr =>
      ' ' + attr + '="' + attrs[attr] + '"').join('');
    return '<span' + attrsStr + '>' + content + '</span>';
  },

  _open:  (sym, id) => '',//JSONTree._element(sym, {id: 'opening_' + id, class: 'jstBracket'}),
  _close: (sym, id) => '',//JSONTree._element(sym, {id: 'opening_' + id + '_end', class: 'jstBracket'}),
};

// modified https://stackoverflow.com/a/35997272
function replaceDOM(ele, outerHTML) {
  let parent = false, refEle;
  // if element that's going to be changed has previousElementSibling, take it as reference. If not, the parentElement will be the reference.
  if (ele.previousElementSibling !== null) refEle = ele.previousElementSibling;
  else {
    refEle = ele.parentElement;
    // indicate that parentElement has been taken as reference
    parent = true;
  }
  // change the outerHTML
  ele.outerHTML = outerHTML;
  // return the correct reference
  if (parent) return refEle.firstElementChild;
  else return refEle.nextElementSibling;
}
