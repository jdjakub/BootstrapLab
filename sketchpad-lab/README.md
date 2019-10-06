![Current](../img/lines-circles-glomps.png?raw=true)

# Example input sequences

* Click (place / select point to be line start)
* Click (place / select point to be line end)
* L (place line)

* Click (place / select point to be circle center)
* Click (place / select point to be circle sizer)
* C (place circle)

* Click (select center point of circle)
* Click (place new point elsewhere)
* M (move circle center point to new location)

* Click (select line start point)
* Click (select circle sizer point)
* M (merge line start onto circle sizer)

Yes, very much influenced by Sketchpad.

What is nice is that later on I could *connect* the "mouse move" event to the discrete `move()` command (between "mouse down" and "mouse up", of course) and get **point dragging** as a "live" version of `move()`.
