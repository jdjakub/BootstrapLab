/* BETTER NOTES: http://programmingmadecomplicated.wordpress.com/2025/02/18/ode-to-id-notes-on-colas-object-model-part-1/
 * 
 * Piumarta's Id can be seen as an object model *relative* to a chosen starting platform.
 * All of the base language features are available, but they are augmented by the Id model.
 *
 * In the terminology of my PhD thesis: Id is a *substrate* over a platform. In this file, the platform is "The vanilla JS programming language".
 * 
 * Id begins by extending every platform data structure (or, piece of state). Anything can be used as an ordinary JS object ("plafobj"), or it can be used *as an Id object* or Idobj.
 * 
 * All that is needed to do this, is a mapping called vtable: Plafobj -> Idobj. Since every Idobj is also a plafobj, every Idobj will also have a vtable.
 * 
 * In the example C implementation [OROM], vtable is implemented as a pointer *before* the first byte of the plafobj. This has pros and cons. A more sophisticated later development [BareBlocks] stores the vtable mapping in a separate global table.
 *
 * But in JS, we are empowered to *annotate* any non-primitive object with properties of our own. So we'll use that. The caveat is that primitives (numbers, booleans etc) don't let us do this (the sin of Java contra Smalltalk) so we are forced to do a little wrapping.
 * 
 * [OROM]: https://tinlizzie.org/VPRIPapers/tr2006003a_objmod.pdf
 * [BareBlocks]: https://tinlizzie.org/VPRIPapers/m2007005a_barebloc.pdf
*/

// For entering the debugger in a JS console statement. Add it as a dummy param
// or use it to wrap a param in a function call so it evaluates first.
// E.g: I want to step through the execution of `foo(1, 2, 3)`.
// So I put: `foo(1, 2, DEBUG(3))` or `foo(1, 2, 3, DEBUG())`.
DEBUG = (x) => { debugger; return x; };
// `last([1,2,3])` = 3, `last([1,2,3], 2)` = 2
last = (arr, n) => arr[arr.length-(n || 1)];
// Interpose anywhere in an expression to transparently probe its value.
// E.g. `foo(1, bar(x)*baz(y))` - I wonder what the 2nd argument is.
// So I put: `foo(1, log(bar(x)*baz(y)))`
log = (...args) => { console.log(...args); return last(args); };

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

/* A vtable is like a class. It represents the "behaviour" of an object, allowing multiple instances to share the same behaviour. In a more general system I would rename "vtable" to "binder object", since that is functionally what it is.
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

// Here is where we will cache the results of sending 'lookup'
bind_cache = new Array(31); // apparently prime numbers are good idk

// We'll install its initialisation in Object
function object_flushCache(self) {
    log('Clearing bind cache...');
    for (let i=0; i<bind_cache.length; i++) {
        bind_cache[i] = {vtable: null, selector: null, method_desc: null};
    }
}

function peek_cache() {
    for (let i=0; i<bind_cache.length; i++) {
        const {vtable, selector} = bind_cache[i];
        if (vtable !== null) log(`${vtable.name} >> ${selector}`);
    }
}

// Creates or updates the method descriptor in the vtable `self`.
function vtable_addMethod(self, symbol, method) {
    let method_desc = self.entries[symbol];
    if (method_desc === undefined)
        method_desc = self.entries[symbol] = {};
    method_desc.method = method; // Also updates all cache lines holding onto this method descriptor
    // If the method lookup algorithm is being changed, all bets are off!
    if (vt(self) === vtables.Vtable && symbol === 'lookup')
        object_flushCache();
}

// We want to send addMethod,
// which depends on `send`,
// which depends on `bind`,
// which depends on both `lookup` and `addMethod` existing in Vtable.
// So: make Vtable aware of addMethod...
vtable_addMethod(vtables.Vtable, 'addMethod', vtable_addMethod);

function vtable_lookup(self, symbol) {
    let method_desc = self.entries[symbol];
    if (method_desc !== undefined) return method_desc;
    if (self.parent !== undefined)
        return send(self.parent, 'lookup', symbol);
}

// Make Vtable aware of lookup...
vtable_addMethod(vtables.Vtable, 'lookup', vtable_lookup);
// (This will call object_flushCache thereby initialising the cache)

function cachehash(vtable, selector) {
    const str = vtable.name + selector;
    // thanks https://stackoverflow.com/a/8831937
    let hash = 0;
    for (let i=0, len=str.length; i<len; i++) {
        let chr = str.charCodeAt(i);
        hash = (hash << 5) - hash + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash);
}

/* Now we may define bind, which resolves the appropriate method for a selector
 * in the context of the receiver object.
*/
function bind(recv, selector) {
    const vtable = vt(recv);
    // Catch the fixed-point case
    if (recv === vtables.Vtable && selector === 'lookup')
        return vtable_lookup;
    // Consult the cache
    const offset = cachehash(vtable, selector) % bind_cache.length;
    const cache_line = bind_cache[offset];
    const is_collision = !(cache_line.vtable === vtable && cache_line.selector === selector);
    let method_desc;
    if (is_collision) {
        log(`Miss: ${vtable.name} >> ${selector}`);
        method_desc = send(vtable, 'lookup', selector);
    } else {
        log(`Hit: ${vtable.name} >> ${selector}`);
        return cache_line.method_desc.method;
    }
    // Update the cache
    cache_line.vtable      = vtable;
    cache_line.selector    = selector;
    cache_line.method_desc = method_desc;
    return method_desc.method;
}

function send(recv, selector, ...args) {
    let method = bind(recv, selector);
    if (method === undefined) throw [recv, 'Does Not Understand', selector, ...args];
    return method(recv, ...args);
}

// Now we can do:
// Object addMethod invalidateCache object_invalidateCache
send(vtables.Object, 'addMethod', 'flushCache', object_flushCache);
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
vtables.primitive.object    = send(vtables.Primitive, 'newDelegatingToMe', 'Null'); // since typeof null = 'object'
vtables.primitive.undefined = send(vtables.Primitive, 'newDelegatingToMe', 'Undefined');

log('Finished initialising Id/JS.');

// I want all objects to respond to 'log': okay, add it to Object
send(vtables.Object,    'addMethod', 'log', self => {log(self.name);});
// Wait, JS primitives don't have a name. I'll just override it for them
send(vtables.Primitive, 'addMethod', 'log', self => {log(self);});

// Now send 'log' to some JS primitives and objects (all Id Objects!)
log("Testing 'log'...");
[3, vtables.Object, null, vtables.Vtable, undefined].forEach(o => send(o, 'log'));

// Let's edit the definition of 'log' for primitives
log("Editing 'log'...");
send(vtables.Primitive, 'addMethod', 'log', self => {console.log(self, '(primitives have no name)');});

// Hopefully the cache will see the new method.
log("Testing new 'log'...");
[3, vtables.Object, null, vtables.Vtable, undefined].forEach(o => send(o, 'log'));

// Let's edit the definition of 'lookup' ... carefully!
function vtable_lookup2(self, symbol) {
    // We'll make binding case-insensitive
    // This may cause pairs of cache entries, but I think that's appropriate
    // considering what the cache should and shouldn't know. It's supposed to be simple.
    symbol = symbol.toLowerCase();
    let method_desc = self.entries[symbol];
    if (method_desc !== undefined) return method_desc;
    if (self.parent !== undefined)
        return send(self.parent, 'lookup', symbol);
}

log("Editing 'lookup'...");
send(vtables.Vtable, 'addMethod', 'lookup', vtable_lookup2);

// Hopefully the cache got cleared out and this will work...
log("Testing new 'lookup'...");
[3, vtables.Object, null, vtables.Vtable, undefined].forEach(o => send(o, 'LOG'));