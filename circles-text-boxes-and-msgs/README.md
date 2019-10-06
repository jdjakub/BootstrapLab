# BootstrapLab
Visually bootstrap a self-sustaining system, and take it from there.

Part of an [effort](https://github.com/d-cook/SomethingNew) to rescue the usage and creation of computer software from its current dismal state.

More info at my [blog](https://programmingmadecomplicated.wordpress.com/category/programming/bootstraplab/).

# SketchpadLab

![Introduction](../img/intro.png?raw=true)

Current specific research direction, as of late April 2018. [Blog post](https://programmingmadecomplicated.wordpress.com/2018/04/09/back-to-bootstrapping/)

Goal: build a visual and "pliable" model of arbitrary computation that is capable of modifying its own presentation and pliability.

**Note: since the last post on my blog, I have been prioritising practical progress and experimentation over theory and documentation. For now, see the commit messages and code comments.**

# Gallery
(Disclaimer: may or may not reflect the system in its current state)
![Topological drawing of the complete graph K-8.](../img/k-8.png?raw=true "Topological drawing of the complete graph K-8.")
![Simple fun with introspection.](../img/text.png?raw=true "Simple fun with introspection.")
![Boxed lines of text with "self" i.e. receiver access](../img/boxed-text.png?raw=true "Boxed lines of text with 'self' i.e. receiver access")

# Previous thoughts
Inspiration drawn from Ivan Sutherland's [1963 Sketchpad thesis](https://programmingmadecomplicated.wordpress.com/2018/04/15/reading-the-sketchpad-thesis/).

* Topology, i.e. "connectedness", rather than specific shape or size or position or arrangement, is *key*.
* First step: build a "graph" Turing machine where memory is simply the vertices of a graph.
* Arithmetical operations -- both vector and scalar -- can be done graphically (the ancient Greeks knew this.) However, *spatial* "quantity" requires some unit *ruler* to measure against, and may or may not end up violating the "topological principle".
* Zeroth step: code a system in JS that lets one *draw* topologically connected SVG elements, and let each SVG element be as smart or dumb as required. Then we can treat SVG elements and their attributes as both "data" and "instructions" for modifying data (other SVG elements)
* Camera controls: panning, zooming.
* At some mature point, provide *spatial abstraction*: collapse groups of objects down to a single object, making infinite use of finite space.
