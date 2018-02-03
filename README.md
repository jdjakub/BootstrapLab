# BootstrapLab
Visually bootstrap a self-sustaining system, and take it from there.

Initial substrate system is the "Id" object system from the paper [Open, Reusable Object Models](www.vpri.org/pdf/tr2006003a_objmod.pdf).

More info: https://programmingmadecomplicated.wordpress.com/2018/01/18/3-hacking-together-orom-domctrlshiftj/

## How to use
Open `orom.html` in the browser (I use Chrome). Open the JS console (try Ctrl+Shift+J or F12) and play around.

Create an Entity (a.k.a. Object -- conceptually) and give it some state:

```javascript
e = new Entity();
e.state('name', 'A bunch of state');
e.state('name'); // returns the above string
```

This is a simple skeleton referring to the script `orom.js`, so to be honest, run however you like.
