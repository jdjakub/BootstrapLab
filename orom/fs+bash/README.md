# OROM/fs+bash

Rationale: the FS could be considered the de-facto standard state dict we have, widely supported by a range of already-existing tools including file browsers. Associated with "large" objects; some e.g. game devs consider it an *anti-pattern* to use the FS as a data store for "small" key/values; however, that is exactly what we do here.

As for Bash, that just seems a natural choice to evolve the system. (TODO: representation of state-evolution and control flow instructions as dirs and files :D)

Pros:
  * Standard lingua franca
  * Everything works with it (incl. web browser!)
  * Persistence *for free*
  * Basic C/R/U/D *for free*
  * Basic GUI browsing & preview *for free*
  * Every object has a canonical name (path) instead of e.g. ID

Cons:
  * Hierarchical, though symlinks permit cycles
  * Not "on" the Web (esp. Bash, though this is somewhat orthogonal)
  * Limited visualisation (i.e. no visual nesting)
  * No easy GUI view of small file contents (value) alongside filenames (keys)?

### Running
Use the `init` script from its directory to bootstrap the system into an existing directory tree:
```bash
$ mkdir myOROM
$ ./init myOROM
```

This will copy the `code/` dir to `myOROM/` and work its magic:
```bash
$ tree myOROM/
myOROM/
├── code
│   ├── bind
│   ├── send
│   ├── vtable.addMethod
│   ├── vtable.allocate
│   ├── vtable.delegated
│   └── vtable.lookup
├── object-vt
│   ├── name
│   ├── parent -> /dev/null
│   └── vtable -> ../vtable-vt
└── vtable-vt
    ├── methods
    │   ├── addMethod -> ./vtable.addMethod
    │   ├── allocate -> ./vtable.allocate
    │   ├── delegated -> ./vtable.delegated
    │   └── lookup -> ./vtable.lookup
    ├── name
    ├── parent -> ../object-vt
    └── vtable -> ../vtable-vt
```

(said magic consisting merely of the bootstrapping steps in `init`)

Send messages to objects from within `myOROM/code/` like so:
```bash
myOROM/code $ ./send ../object-vt allocate ../my-object
```

TODO: import tutorial from OROM/HTML+Ctrl+Shift+J
TODO: use abs paths instead of `code/`-relative paths?
TODO: describe the bootstrapping steps

### Dev notes
* `mkdir -p` exists OK
* Using **symlinks** for object pointers.
* `ln -nsf OLD NEW`:
    + **n** If we're overwriting an existing link NEW, replace this link NOT its destination!
    + **s** Create soft link NEW pointing to OLD
    + **f** Overwrite existing link instead of error
* Using `/dev/null` for null pointer
* Returning stuff: currently just using stdout. `result=$(./blah ...)`
* Naming and assignment: passing "destination" as last parameter to `allocate` and `delegated`:
    + `vtable_vt := vtable_delegated(0)` becomes
    + `./vtable.delegated /dev/null ../vtable-vt`
