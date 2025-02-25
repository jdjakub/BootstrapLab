/* Piumarta's Id can be seen as an object model *relative* to a chosen starting platform.
 * All of the base language features are available, but they are augmented by the Id model.
 *
 * In the terminology of my PhD thesis: Id is a *substrate* over a platform. In this file, the platform is "The vanilla JS programming language".
 * 
 * Id begins by extending every platform data structure (or, piece of state). Anything can be used as an ordinary JS object ("plafobj"), or it can be used *as an Id object* or Idobj.
 * 
 * All that is needed to do this, is a mapping called vtable: Plafobj -> Idobj. Since every Idobj is also a plafobj, every Idobj will also have a vtable.
 * 
 * In the example C implementation [OROM], vtable is implemented as a pointer *before* the first byte of the plafobj. This has pros and cons. A more sophisticated later development [ObjMem] stores the vtable mapping in a separate global table.
 *
 * But in JS, we are empowered to *annotate* any non-primitive object with properties of our own. So we'll use that. The caveat is that primitives (numbers, booleans etc) don't let us do this (the sin of Java contra Smalltalk) so we are forced to do a little wrapping.
*/

// vt(o) returns o's vtable, vt(o,v) sets it to v
function vt(obj, new_vt) {
    let curr_vtable;
    // Store the "vtable" mapping on the object as a property... if it can have properties.
    if (typeof obj === 'object' && obj !== null || typeof obj === 'function') curr_vtable = obj.vtable;
    // Otherwise, we'll use vtables for primitives, which we'll set up later via message sends.
    else curr_vtable = vtables.primitive[typeof obj];
    if (new_vt === undefined) return curr_vtable;
    if (typeof obj === 'object') obj.vtable = new_vt;
}

/* A vtable is like a class. It represents the "behaviour" of an object, allowing multiple instances to share the same behaviour. In a more general system I would rename "vtable" to "method lookup object" or MLO, since that is functionally what it is.
 * In order to send a message to an object, a 'lookup' message is sent to its vtable. This recurses until hitting a base case.
 * 
 * Because Id is relative, it wraps a given platform, in our case JS. Therefore, the default language in which to express code is JS. All activity in the system will be split into JS functions; the Id object model is simply a way to specify which JS code will get executed in response to which messages on which objects.
*/

// 'newInstance' creates a new instance of me, with the specified name.
// The name is there so that you can actually tell what you're looking at in the JS inspector.
// NB: message renamed from 'allocate' in [OROM].
// NB: Not meant to be called on Vtable. Only on all other vtables.
// To create a new vtable, use Object newDelegatingToMe
function vtable_newInstance(self, name) {
    let new_obj = { name };
    vt(new_obj, self); // "The new object is an instance of me."
    return new_obj;
}

// 'newDelegatingToMe' creates a new *child* vtable of the same type as me, delegating unhandled lookups to me.
// Returns this "subclass" of me.
// NB: message renamed from 'delegated' in [OROM].
function vtable_newDelegatingToMe(self, name) {
    let myCreator = self === undefined? undefined : vt(self);
    let child_vtable = vtable_newInstance(myCreator, name);
    child_vtable.parent = self;
    child_vtable.entries = {};
    return child_vtable;
}

vtables = {};

vtables.Vtable = vtable_newDelegatingToMe(undefined, 'Vtable');
vt(vtables.Vtable, vtables.Vtable);

vtables.Object = vtable_newDelegatingToMe(undefined, 'Object');
vt(vtables.Object, vtables.Vtable);

vtables.Vtable.parent = vtables.Object;

function vtable_addMethod(self, symbol, method) {
    self.entries[symbol] = method;
}

// We want to send addMethod,
// which depends on `send`,
// which depends on `bind`,
// which depends on both `lookup` and `addMethod` existing in Vtable.
// So: make Vtable aware of addMethod...
vtable_addMethod(vtables.Vtable, 'addMethod', vtable_addMethod);

function vtable_lookup(self, symbol) {
    let method = self.entries[symbol];
    if (method !== undefined) return method;
    if (self.parent !== undefined)
        return send(self.parent, 'lookup', symbol);
}

// Make Vtable aware of lookup...
vtable_addMethod(vtables.Vtable, 'lookup', vtable_lookup);

/* Now we may define bind, which resolves the appropriate method for a selector
 * in the context of the receiver object.
*/
function bind(recv, selector) {
    let vtable = vt(recv);
    if (recv === vtables.Vtable && selector === 'lookup')
        return vtable_lookup(vtable, 'lookup');
    return send(vtable, 'lookup', selector);
}

function send(recv, selector, ...args) {
    let method = bind(recv, selector);
    if (method === undefined) throw [recv, 'Does Not Understand', selector, ...args];
    return method(recv, ...args);
}

// Now we can do:
// Vtable addMethod newInstance vtable_newInstance
send(vtables.Vtable, 'addMethod', 'newInstance', vtable_newInstance);
// Vtable addMethod newDelegatingToMe vtable_newDelegatingToMe
send(vtables.Vtable, 'addMethod', 'newDelegatingToMe', vtable_newDelegatingToMe);

// Now we absorb JS primitives into the object model, fixing JS' Java-like mistake of separating them in the first place...
vtables.primitive = {};
vtables.Primitive           = send(vtables.Object,    'newDelegatingToMe', 'Primitive');
vtables.primitive.boolean   = send(vtables.Primitive, 'newDelegatingToMe', 'Boolean');
vtables.primitive.number    = send(vtables.Primitive, 'newDelegatingToMe', 'Number');
vtables.primitive.string    = send(vtables.Primitive, 'newDelegatingToMe', 'String');
vtables.primitive.object    = send(vtables.Primitive, 'newDelegatingToMe', 'Null'); // for Null
vtables.primitive.undefined = send(vtables.Primitive, 'newDelegatingToMe', 'Undefined');

send(vtables.Primitive, 'addMethod', 'log', self => {console.log(self);});
send(vtables.Object,    'addMethod', 'log', self => {console.log(self.name);});