e3 = THREE;

FontJSON = 'Roboto-msdf.json';
FontImage = 'Roboto-msdf.png';

const WIDTH = window.innerWidth;
const HEIGHT = window.innerHeight;

let scene, camera, renderer, controls ;

window.addEventListener('load', init );
window.addEventListener('resize', onWindowResize );

aspect = WIDTH/HEIGHT;

function init() {
	scene = new THREE.Scene();
	scene.background = new THREE.Color( 0x505050 );

	camera = new THREE.OrthographicCamera( -aspect, +aspect, +1, -1, 0, 1000);

	renderer = new THREE.WebGLRenderer({
		antialias: true
	});
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( WIDTH, HEIGHT );
	document.body.appendChild( renderer.domElement );

	//camera.position.set( 0, 1.6, 0 );
	//camera.lookAt( 0, 1, -1.8 );
  
	makeTextPanel();

	renderer.setAnimationLoop( loop );
};

function makeTextPanel() {
	container = new ThreeMeshUI.Block({
		width: 1.2,
		height: 0.5,
		fontFamily: FontJSON,
		fontTexture: FontImage
	});

	container.position.set( 0, 0, -2.51 );
	scene.add( container );

	container.add(
		new ThreeMeshUI.Text({
			content: "Lorem ipsum dolor sit amet, blah blah. Finally works lol",
		}),
	);
};

// handles resizing the renderer when the viewport is resized

function onWindowResize() {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize( window.innerWidth, window.innerHeight );
};

//

function loop() {
	// Don't forget, ThreeMeshUI must be updated manually.
	// This has been introduced in version 3.0.0 in order
	// to improve performance
	ThreeMeshUI.update();

	renderer.render( scene, camera );
};
