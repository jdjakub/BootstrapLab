"Timeless definition:"

send(recv, selector, ...args) {
    let method = bind(recv, selector);
    return method(recv, ...args);
}

bind(recv, selector) {
    return [[ `vt(recv)` lookup `selector` ]]
}

Vtable := Object newDelegatingToMe. [send, bind, lookup, newDelegatingToMe, Object]
Object := Vtable newInstance. [send, bind, lookup, newInstance, Vtable]

Vtable addMethod: 'lookup', vtable_lookup. [send, bind, lookup, addMethod, Vtable]
Vtable addMethod: 'addMethod', vtable_addMethod. [send, bind, lookup, addMethod, Vtable]
Vtable addMethod: 'newInstance', vtable_newInstance. [send, bind, lookup, addMethod, Vtable]
Vtable addMethod: 'newDelegatingToMe', vtable_newDelegatingToMe. [send, bind, lookup, addMethod, Vtable]

vtable_lookup(self, symbol) {
    let method = self.entries[symbol];
    if (method !== undefined) return method;
    if (self.parent !== undefined)
        return [[`self.parent` lookup `symbol`]]
}

vtable_addMethod(self, symbol, method) {
    self.entries[symbol] = method;
}

vtable_newInstance(self, name) {
    let new_obj = {};
    vt(new_obj, self); // "The new object is an instance of me."
    return new_obj;
}

vtable_newDelegatingToMe(self) {
    let myCreator = self === undefined? undefined : vt(self);
    let child_vtable = [[`myCreator` newInstance]];
    child_vtable.parent = self;
    child_vtable.entries = {};
    return child_vtable;
}


"Substituting:"
Vtable := Object newDelegatingToMe.
> vt(Object) lookup 'newDelegatingToMe'.
>> vt(vt(Object)) lookup 'lookup'.
>>n> vt(n)(Object) lookup 'lookup'.


> vt(Object) newInstance
>> let new_obj = {}
>> vt(new_obj) = vt(Object)
> new_obj.parent = Object
> new_obj.entries = {}

Vtable = {vtable: vt(Object), parent: Object, entries: {}}

Object := Vtable newInstance.
>> let new_obj = {}
>> vt(new_obj) = Vtable

Object = {vtable: Vtable}
==> Vtable.vtable = vt(Object) = Vtable

Vtable addMethod: 'lookup', vtable_lookup.
> Vtable.entries['lookup'] = vtable_lookup

Vtable addMethod: 'addMethod', {vtable_addMethod, vtable_newInstance, vtable_newDelegatingToMe}.

Vtable.entries = {
    lookup: vtable_lookup,
    addMethod: vtable_addMethod,
    newInstance: vtable_newInstance,
    newDelegatingToMe: vtable_newDelegatingToMe
}

"Final state:"

Vtable = {vtable: Vtable, parent: Object, entries: {
    lookup: vtable_lookup,
    addMethod: vtable_addMethod,
    newInstance: vtable_newInstance,
    newDelegatingToMe: vtable_newDelegatingToMe
}}

Object = {vtable: Vtable}