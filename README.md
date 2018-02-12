# BootstrapLab
Visually bootstrap a self-sustaining system, and take it from there.

Part of an [effort](https://github.com/d-cook/SomethingNew) to rescue the usage and creation of computer software from its current dismal state.

Initial substrate system is the "Id" object system from the paper [Open, Reusable Object Models](www.vpri.org/pdf/tr2006003a_objmod.pdf).

More info at my [blog](https://programmingmadecomplicated.wordpress.com/category/programming/bootstraplab/).

## How to use
Open `orom.html` in the browser (I use Chrome). Open the JS console (try Ctrl+Shift+J or F12) and play around.

(This is a simple skeleton referring to the script `orom.js`, so to be honest, run however you like.)

## Playing around

Create an Entity (concptually, an Object, but this could be confused with plain JavaScript objects) and give it some state:

```javascript
e = new Entity();
e.state('name', 'A bunch of state');
e.state('name'); // returns the above string
```

This is the JavaScript, *implementation*-level way to create an Entity. However, a plain JS Entity only becomes an Entity proper once it has a *vtable* -- then it becomes a true part of the *interface*-level system, and messages can be sent to it.

Create an Entity in the *implementation*-level system by sending the message `allocate` to the object-vtable:
```javascript
e = send(object_vt, 'allocate');
```

We can't do much with this. However, if we add a method to the object-vtable, then all objects (Entities) in the system will automatically accept that message.

To do this, we first need an interface-level proxy for a JavaScript function:

```javascript
func_entity = send(function_vt, 'allocate'); // Function entities behave according to function_vt
func_entity.state('name', 'hello world'); // Give it a name for your eyes
func_entity.state('code', '', true); // Create an empty textarea for the JS source code.
```

Find the "hello world" object in the page and type the following into its `code` property:
```javascript
function(self, first_name) {
  first_name = first_name || 'whoever you are';
  let cont = confirm('Hello, '+first_name+'! Continue?');
  if (cont)
    self.state('first-name', first_name);
  return cont
}
```

Now add `func_entity` as a method to `object_vt`, using the `addMethod` message. Call the method whatever you want, keeping in mind that it's a CSS class under the hood -- so no non-alphanumeric characters except `-` and `_`, I think.

```javascript
send(object_vt, 'addMethod', 'hello-world', func_entity);
```

If you expand `object_vt`, you should see it has a `-hello-world` property. The initial hyphen marks a method name, as opposed to the name of some 'private' property.

Since all objects have a vtable, and all vtables pass unhandled messages to their parent, and `object_vt` is at the end of this delegation chain -- all objects in the sytem now respond to the message `hello-world`.

Including `e` from earlier:
```javascript
send(e, 'hello-world');
send(e, 'hello-world', 'Object McObjFace');
```

If you want to keep the changes you've made to the system, I'm afraid you'll have to add the steps so far to `orom.js`. Also, resize everything as you like, and then call `saveDims()`. Copy the resulting code into the body of `En-tity.prototype.restoreDims()` in said source file, and the Entity divs will be correctly sized next time it's loaded.

(erk -- don't call one of your objects `'; delete_system32(); /*` or `saveDims()` might not be the only thing that breaks.

(NB: the `saveDims()` and `restoreDims()` functions access `state('name')` of all active Entities in the system. This will create the property as 0 if it doesn't exist, any un-named objects will gain it.)

(TODO: preserve sizes of textarea's as well.)
