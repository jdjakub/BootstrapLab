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

// The bind() operation can be very costly, and will not change too often.
// So here is where we will cache its results.
// Just as long as we invalidate it appropriately...!
bind_cache = new Array(29); // apparently prime numbers are good idk
// NB: EXCEPT for 31... it's used in cachehash() and will lead to many collisions

// We'll install its initialisation in Object
function object_flushCache(self) {
    log('Clearing bind cache...');
    for (let i=0; i<bind_cache.length; i++) {
        bind_cache[i] = {vtable: null, selector: null, method_desc: null};
    }
}

function invalidate_cache_lines(predicate) {
    for (let i=0; i<bind_cache.length; i++) {
        const cache_line = bind_cache[i];
        if (predicate(cache_line)) {
            cache_line.vtable      = null;
            cache_line.selector    = null;
            cache_line.method_desc = null;
        }
    }
}

function peek_cache() {
    log('Cache:')
    let is_empty = true;
    for (let i=0; i<bind_cache.length; i++) {
        const {vtable, selector} = bind_cache[i];
        if (vtable !== null) {
            is_empty = false;
            log(`${vtable.name} >> ${selector}`);
        }
    }
    if (is_empty) log('(cache is empty)');
}

// Creates or updates the method descriptor in the vtable `self`.
// Most of the complexity is for invalidating the cache.
function vtable_addMethod(self, symbol, new_method) {
    let method_desc = self.entries[symbol];
    let old_method;
    if (method_desc === undefined)
        method_desc = self.entries[symbol] = {};
    else old_method = method_desc.method;
    method_desc.method = new_method; // Also updates all cache lines holding onto this method descriptor

    const new_exists = new_method !== undefined;
    if (!new_exists) delete self.entries[symbol]; // remove descriptor

    // If the method lookup algorithm is being changed, all bets are off!
    if (vt(self) === vtables.Vtable && symbol === 'lookup') {
        object_flushCache(); return;
    }

    // If it's a genuine addition, cache lines for descendant vtables may be invalid
    // since the search now stops at this vtable.
    // Same if it's a deletion, since the search will continue past this vtable
    const old_exists = old_method !== undefined;
    if (old_exists !== new_exists) // Broad, fast approach: just kill all for this selector
        invalidate_cache_lines(l => l.selector === symbol);
}

function vtable_lookup(self, symbol) {
    let method_desc = self.entries[symbol];
    if (method_desc !== undefined) return method_desc;
    if (self.parent !== undefined)
        return send(self.parent, 'lookup', symbol);
}

// Make Vtable aware of lookup...
vtable_addMethod(vtables.Vtable, 'lookup', vtable_lookup);
// (This will call object_flushCache thereby initialising the cache)

// We want to send addMethod,
// which depends on `send`,
// which depends on `bind`,
// which depends on both `lookup` and `addMethod` existing in Vtable.
// So: make Vtable aware of addMethod...
vtable_addMethod(vtables.Vtable, 'addMethod', vtable_addMethod);

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
 * Most of the complexity is for the cache.
*/
function bind(recv, selector) {
    const vtable = vt(recv);
    // Catch the fixed-point case
    if (recv === vtables.Vtable && selector === 'lookup')
        return vtable_lookup;
    // Consult the cache
    const offset = cachehash(vtable, selector) % bind_cache.length;
    const cache_line = bind_cache[offset];
    const is_miss = !(cache_line.vtable === vtable && cache_line.selector === selector);
    let method_desc;
    if (is_miss) {
        log(`Miss: ${vtable.name} >> ${selector}`);
        const is_collision = cache_line.vtable !== null;
        if (is_collision) log(`(Evicting ${cache_line.vtable.name} >> ${cache_line.selector})`);
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



// ===================== THIS IS WHERE THE FUN BEGINS =====================
log('Finished initialising Id/JS.');
// ===================== THIS IS WHERE THE FUN BEGINS =====================



// I want all objects to respond to 'log': okay, add it to Object
send(vtables.Object,    'addMethod', 'log', self => {log(self.name);});
// Wait, JS primitives don't have a name. I'll just override it for them
send(vtables.Primitive, 'addMethod', 'log', self => {log(self);});

my_obj = send(vtables.Object, 'newInstance', 'myObj');

// Now send 'log' to some JS primitives and objects (all Id Objects!)
log("Testing 'log'...");
some_objs =  [3, vtables.Object, null, vtables.Vtable, undefined, my_obj];
some_objs.forEach(o => send(o, 'log'));

peek_cache();

// Now insert a *new* 'log' earlier in the search from 3.
log("Overriding 'log' in Number...")
send(vtables.primitive.number, 'addMethod', 'log', self => {log(self*100);}) 

peek_cache();

some_objs.forEach(o => send(o, 'log')); // logs 300 instead of 3

peek_cache();

// Now edit Object >> log to work on primitives too...
log('Editing Object >> log ...');
send(vtables.Object, 'addMethod', 'log', self => {log('[REDACTED]');}) 

log('Removing Primitive >> log...');
send(vtables.Primitive, 'addMethod', 'log', undefined);
peek_cache();

// It should still use Number >> log...
send(3, 'log'); // 3
peek_cache();

log('Removing Number >> log...');
send(vtables.primitive.number, 'addMethod', 'log', undefined);
peek_cache();

some_objs.forEach(o => send(o, 'log')); // logs [REDACTED] for each

// Let's edit the definition of 'lookup' ... carefully!
function vtable_lookup2(self, symbol) {
    // We'll add logging to it.
    let method_desc = self.entries[symbol];
    if (method_desc !== undefined) {
        log(`Found ${symbol} in ${self.name}!`);
        return method_desc;
    }
    if (self.parent !== undefined) {
        log(`Consulting ${self.name}.parent = ${self.parent.name}...`);
        return send(self.parent, 'lookup', symbol);
    }
}

log("Editing 'lookup'...");
send(vtables.Vtable, 'addMethod', 'lookup', vtable_lookup2);
peek_cache();

// Hopefully the cache got cleared out and this will work...
log("Testing new 'lookup'...");
send(3, 'log');
send(vtables.Primitive, 'addMethod', 'log', self => {log(self);});
send(my_obj, 'log');
send(3, 'log');

// Now a more ambitious change - case-insensitive lookup!
// Sadly we must now linear-search for a matching entry...
function find_caseless_match(dict, symbol) {
    let entry;
    for (let [name, m] of Object.entries(dict)) {
        if (name.toLowerCase() === symbol.toLowerCase()) {
            entry = {key: name, value: m}; break;
        }
    }
    return entry;
}

function vtable_lookup3(self, symbol) {
    const match = find_caseless_match(self.entries, symbol);
    if (match !== undefined) {
        log(`Found ${symbol} as ${match.key} in ${self.name}!`);
        return match.value;
    }
    if (self.parent !== undefined) {
        log(`Consulting ${self.name}.parent = ${self.parent.name}...`);
        return send(self.parent, 'lookup', symbol);
    }
}

// We must also provide a new addMethod too, in all its complexity.
// However, we would need to do this in the text editor anyway - it's
// just that now, we can do it in the running system too.
function vtable_addMethod3(self, symbol, new_method) {
    const new_exists = new_method !== undefined;
    let match = find_caseless_match(self.entries, symbol);
    let method_desc;
    let old_method;
    if (match === undefined && new_exists) {
        self.entries[symbol] = method_desc = {};
        match = {key: symbol, value: method_desc};
    }
    else {
        method_desc = match.value;
        old_method = method_desc.method;
    }
    method_desc.method = new_method; // Also updates all cache lines holding onto this method descriptor
    
    if (!new_exists) delete self.entries[match.key]; // remove descriptor

    // If the method lookup algorithm is being changed, all bets are off!
    if (vt(self) === vtables.Vtable && symbol.toLowerCase() === 'lookup') {
        object_flushCache(); return;
    }

    // If it's a genuine addition, cache lines for descendant vtables may be invalid
    // since the search now stops at this vtable.
    // Same if it's a deletion, since the search will continue past this vtable
    const old_exists = old_method !== undefined;
    if (old_exists !== new_exists) // Broad, fast approach: just kill all for this selector
        invalidate_cache_lines(l => l.selector.toLowerCase() === symbol.toLowerCase());
}

log("Installing case-insensitive lookup...");
// We can't send 'ADDMETHOD' until  addMethod3 is installed...
send(vtables.Vtable, 'addMethod', 'addMethod', vtable_addMethod3);
// I want the cache completely flushed after that
send(vtables.Vtable, 'addMethod', 'lookup', vtable_lookup3);
peek_cache();

log("Testing case-insensitive lookup...");
some_objs.forEach(o => send(o, 'log'));
some_objs.forEach(o => send(o, 'LOG'));
some_objs.forEach(o => send(o, 'lOg'));
some_objs.forEach(o => send(o, 'lOG'));

peek_cache();

/*
Cache will look something like:
   Vtable >> lOg
Undefined >> LOG
   Number >> log
   Vtable >> lOG
   Vtable >> lookup
     Null >> LOG
   Number >> lOg
   Number >> lOG
Undefined >> lOG
   Object >> lOG
Undefined >> lOg
   Object >> lOg
     Null >> lOg
Undefined >> log
   Number >> LOG
     Null >> lOG
*/