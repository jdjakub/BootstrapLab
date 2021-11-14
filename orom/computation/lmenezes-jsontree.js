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

  create: function(data, id_of_obj_map) {
    JSONTree.instances += 1;
    JSONTree.id_of_obj = id_of_obj_map;
    return '<div class="jstTree">' + JSONTree._jsVal(data) + '</div>';
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
    // If collapsible, ensure control is there; otherwise, ensure it isn't
    let c = jstItem.firstElementChild.className;
    const control_present = c === 'jstCollapse' || c === 'jstExpand';
    const collapsible = JSONTree._canCollapse(value);
    if (collapsible && !control_present) {
      jstItem.insertAdjacentHTML('afterbegin', JSONTree._expandElem()); // new items start collapsed
      c = 'jstExpand';
    } else if (!collapsible && control_present) {
      jstItem.firstElementChild.remove();
      c = undefined;
    }

    // Finally, splice in the value
    const jstColon = jstItem.querySelector('.jstColon');
    let jstValue = jstColon.nextElementSibling;
    //if (jstValue.classList.contains('jstBracket')) jstValue = jstValue.nextElementSibling;
    jstValue.outerHTML = JSONTree._jsVal(value);
    jstValue = jstColon.nextElementSibling;
    if (c === 'jstExpand') // obj should be collapsed
      jstValue.classList.add('jstHiddenBlock');
  });},

  highlight: function(cssClass, obj, key) {
    let jstPropsOrLists = JSONTree.locate(obj, key);
    if (key === undefined) // Highlight the entire jstItem containing the jstList
      jstPropsOrLists = jstPropsOrLists.map(([jstList,_]) => jstList.parentElement);
    else // Highlight the key name in the jstItem
      jstPropsOrLists = jstPropsOrLists.map(([_,jstItem]) => jstItem.querySelector('.jstProperty'));

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

  _jsVal: function(value) {
    const type = typeof value;
    switch (type) {
      case 'boolean':
        return JSONTree._jsBool(value);
      case 'number':
        return JSONTree._jsNum(value);
      case 'string':
        return JSONTree._jsStr(value);
      case 'function':
        return JSONTree._jsFunc(value);
      default:
        if (value === null) {
          return JSONTree._jsNull();
        } else if (value instanceof Array) {
          return JSONTree._jsArr(value); // ARRAYS ARE JUST MAPS IN MAP-LAND!!
        } else {
          return JSONTree._jsObj(value);
        }
    }
  },

  _jsObj: function(object) {
    let { id } = ref(object);
    const elements = [];
    map_iter(object, (key, value) => {
      if (value === undefined) return;
      const html = [];
      html.push('<li class="jstItem">');
      if (JSONTree._canCollapse(value)) {
        html.push(JSONTree._collapseElem());
      }
      html.push(JSONTree._property(key, value));
      //if (index !== keys.length - 1) {
      html.push(JSONTree._comma());
      //}
      html.push('</li>');
      elements.push(html.join(''));
    });
    const body = elements.join('');
    return JSONTree._collection(JSONTree._open('{', id), body, JSONTree._close('}', id), id);
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

  _canCollapse: function(data) {
    const type = typeof data;
    switch (type) {
      case 'boolean':
        return false;
      case 'number':
        return false;
      case 'string':
        return false;
      case 'function':
        return false;
      default:
        if (data === null) {
          return false;
        //} else if (data instanceof Array) {
        //  return data.length > 0;
        } else {
          return map_num_entries(data) > 0;
        }
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
    const jsonString = JSONTree._escape(JSON.stringify(value));
    return JSONTree._element(jsonString, {class: 'jstStr'});
  },

  _jsNum:  value => JSONTree._element(
    Number.isInteger(value) ? value : value.toPrecision(4), {class: 'jstNum'}
  ),
  _jsBool: value => JSONTree._element(value, {class: 'jstBool'}),
  _jsNull:    () => JSONTree._element('null', {class: 'jstNull'}),

  _property: function(name, value) {
    const escapedValue = JSONTree._escape(JSON.stringify(name));
    const property = JSONTree._element(escapedValue, {class: 'jstProperty'});
    const propertyValue = JSONTree._jsVal(value);
    return [property +JSONTree._colon(), propertyValue].join('');
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

  /*_jsArr: function(array) {
    const id = JSONTree._id();
    const elements = [];
    array.forEach((element, index) => {
      var html = ['<li class="jstItem">'];
      if (JSONTree._canCollapse(element)) {
        html.push(JSONTree._collapseElem());
      }
      html.push(JSONTree._jsVal(element));
      if (index !== array.length - 1) {
        html.push(JSONTree._comma());
      }
      html.push('</li>');
      elements.push(html.join(''));
    });
    const body = elements.join('');
    return JSONTree._collection(JSONTree._open('[', id), body, JSONTree._close(']', id));
  },*/

  /*_nextUntil: function(elem, id) {
    const siblings = [];
    elem = elem.nextElementSibling;
    while (elem) {
      if (elem.id == id) {
        break;
      }
      siblings.push(elem);
      elem = elem.nextElementSibling;
    }
    return siblings;
  },*/

  /*findNextWithClass: function(element, clazz) {
    let next = element.nextElementSibling;
    while (true) {
      if (next.className === clazz) {
        return next;
      }
      next = next.nextElementSibling;
    }
  },*/
};
