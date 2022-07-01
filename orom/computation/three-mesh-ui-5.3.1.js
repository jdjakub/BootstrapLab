/*
MIT License

Copyright (c) 2020 felixmariotto

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

/*
NB: I need to use Text, so this file includes only those dependencies necessary
for Text.
*/

// TEXT

/**
Job: nothing yet, but adding a isInline parameter to an inline component
Knows: parent dimensions
*/
function InlineComponent( Base = class {} ) {
    return class InlineComponent extends Base {
        constructor( options ) {
            super( options );
            this.isInline = true;
        }
    }
}

/*

Job:
Keeping record of all the loaded fonts, which component use which font,
and load new fonts if necessary

Knows: Which component use which font, loaded fonts

This is one of the only modules in the 'component' folder that is not used
for composition (Object.assign). MeshUIComponent is the only module with
a reference to it, it uses FontLibrary for recording fonts accross components.
This way, if a component uses the same font as another, FontLibrary will skip
loading it twice, even if the two component are not in the same parent/child hierarchy

*/

const fileLoader = new THREE.FileLoader();
const requiredFontFamilies = [];
const fontFamilies = {};

const textureLoader = new THREE.TextureLoader();
const requiredFontTextures = [];
const fontTextures = {};

const records = {};

/**

Called by MeshUIComponent after fontFamily was set
When done, it calls MeshUIComponent.update, to actually display
the text with the loaded font.

*/
function setFontFamily( component, fontFamily ) {
	if ( typeof fontFamily === 'string' ) {
		loadFontJSON( component, fontFamily );
	} else {
		// keep record of the font that this component use
		if ( !records[ component.id ] ) records[ component.id ] = {component};
		records[ component.id ].json = fontFamily;
		component._updateFontFamily( fontFamily );
	}
}

/**

Called by MeshUIComponent after fontTexture was set
When done, it calls MeshUIComponent.update, to actually display
the text with the loaded font.

*/
function setFontTexture( component, url ) {
	// if this font was never asked for, we load it
	if ( requiredFontTextures.indexOf( url ) === -1 ) {
		requiredFontTextures.push( url );

		textureLoader.load( url, ( texture )=> {
			fontTextures[ url ] = texture;

			for ( const recordID of Object.keys(records) ) {
				if ( url === records[ recordID ].textureURL ) {
					// update all the components that were waiting for this font for an update
					records[ recordID ].component._updateFontTexture( texture );
				}
			}
		});
	}

	// keep record of the font that this component use
	if ( !records[ component.id ] ) records[ component.id ] = {component};
	records[ component.id ].textureURL = url;

	// update the component, only if the font is already requested and loaded
	if ( fontTextures[ url ] ) {
		component._updateFontTexture( fontTextures[ url ] );
	}
}

/** used by Text to know if a warning must be thrown */
function getFontOf( component ) {
	const record = records[ component.id ];

	if ( !record && component.getUIParent() ) {
		return getFontOf( component.getUIParent() );
	}
	return record;
}

/** Load JSON file at the url provided by the user at the component attribute 'fontFamily' */
function loadFontJSON( component, url ) {
	// if this font was never asked for, we load it
	if ( requiredFontFamilies.indexOf( url ) === -1 ) {
		requiredFontFamilies.push( url );

		fileLoader.load( url, ( text )=> {
			// FileLoader import as  a JSON string
			const font = JSON.parse( text );
			fontFamilies[ url ] = font;

			for ( const recordID of Object.keys(records) ) {
				if ( url === records[ recordID ].jsonURL ) {
					// update all the components that were waiting for this font for an update
					records[ recordID ].component._updateFontFamily( font );
				}
			}
		});
	}

	// keep record of the font that this component use
	if ( !records[ component.id ] ) records[ component.id ] = {component};
	records[ component.id ].jsonURL = url;

	// update the component, only if the font is already requested and loaded
	if ( fontFamilies[ url ] ) {
		component._updateFontFamily( fontFamilies[ url ] );
	}
}

/*

This method is intended for adding manually loaded fonts. Method assumes font hasn't been loaded or requested yet. If it was,
font with specified name will be overwritten, but components using it won't be updated.

*/
function addFont(name, json, texture) {
	requiredFontFamilies.push( name );
	fontFamilies[ name ] = json;

	if ( texture ) {
		requiredFontTextures.push(name);
		fontTextures[ name ] = texture;
	}
}

const FontLibrary = {
	setFontFamily,
	setFontTexture,
	getFontOf,
	addFont
};

/**
 * Job:
 * - recording components required updates
 * - trigger those updates when 'update' is called
 *
 * This module is a bit special. It is, with FontLibrary, one of the only modules in the 'component'
 * directory not to be used in component composition (Object.assign).
 *
 * When MeshUIComponent is instanciated, it calls UpdateManager.register().
 *
 * Then when MeshUIComponent receives new attributes, it doesn't update the component right away.
 * Instead, it calls UpdateManager.requestUpdate(), so that the component is updated when the user
 * decides it (usually in the render loop).
 *
 * This is best for performance, because when a UI is created, thousands of componants can
 * potentially be instantiated. If they called updates function on their ancestors right away,
 * a given component could be updated thousands of times in one frame, which is very ineficient.
 *
 * Instead, redundant update request are moot, the component will update once when the use calls
 * update() in their render loop.
 */
class UpdateManager {
    /*
     * get called by MeshUIComponent when component.set has been used.
     * It registers this component and all its descendants for the different types of updates that were required.
     */
    static requestUpdate( component, updateParsing, updateLayout, updateInner ) {
        component.traverse( (child)=> {
            if ( !child.isUI ) return
            // request updates for all descendants of the passed components
            if ( !this.requestedUpdates[ child.id ] ) {
                this.requestedUpdates[ child.id ] = {
                    updateParsing,
                    updateLayout,
                    updateInner
                };
            } else {
                if (updateParsing) this.requestedUpdates[ child.id ].updateParsing = true;
                if (updateLayout) this.requestedUpdates[ child.id ].updateLayout = true;
                if (updateInner) this.requestedUpdates[ child.id ].updateInner = true;
            }
        });
    }

    /** Register a passed component for later updates */
    static register( component ) {
        if ( !this.components.includes(component) ) {
            this.components.push( component );
        }
    }

    /** Unregister a component (when it's deleted for instance) */
    static disposeOf( component ) {
        const idx = this.components.indexOf( component );
        if ( idx > -1 ) {
            this.components.splice( idx, 1 );
        }
    }

    /** Trigger all requested updates of registered components */
    static update() {
        if ( Object.keys(this.requestedUpdates).length > 0 ) {
            const roots = this.components.filter( (component)=> {
                return !component.getUIParent()
            });

            return Promise.all( roots.map( (component)=> {
                return this.callParsingUpdateOf( component );
            }))
                .then( ()=> {
                    roots.forEach( (component)=> {
                        this.callUpdatesOf( component );
                    });
                })
                .catch( (err)=> { console.error(err) } );
        }
        return new Promise((resolve) => resolve());
    }

    /**
     * Synchronously calls parseParams update of all components from parent to children
     * @private
     */
    static callParsingUpdateOf( component ) {
        return new Promise( (resolve)=> {
            new Promise( (resolveThisComponent, reject)=> {
                const request = this.requestedUpdates[ component.id ];
                if ( request && request.updateParsing ) {
                    request.updateParsing = false;
                    component.parseParams( resolveThisComponent, reject );
                } else {
                    resolveThisComponent();
                }
            })
            .then( ()=> {
                Promise.all( component.getUIChildren().map( (childUI)=> {
                    return this.callParsingUpdateOf( childUI );
                }))
                .then( ()=> { resolve(); } )
                .catch( (err)=> { console.error( err ); } );
            })
            .catch( (err)=> { console.error( err ); } );
        });
    }

    /**
     * Calls updateLayout and updateInner functions of components that need an update
     * @private
     */
    static callUpdatesOf( component ) {
        const request = this.requestedUpdates[ component.id ]

        if ( request && request.updateLayout ) {
            request.updateLayout = false;
            component.updateLayout();
        }
        if ( request && request.updateInner ) {
            request.updateInner = false;
            component.updateInner();
        }

        delete this.requestedUpdates[ component.id ];

        component.getUIChildren().forEach( (childUI)=> {
            this.callUpdatesOf( childUI );
        });
    }
}

// TODO move these into the class (Webpack unfortunately doesn't understand
// `static` property syntax, despite browsers already supporting this)
UpdateManager.components = []
UpdateManager.requestedUpdates = {}

/** List the default values of the lib components */
const Defaults = {
	container: null,
	fontFamily: null,
	fontSize: 0.05,
	offset: 0.01,
	interLine: 0.01,
	breakOn: '- ,.:?!',
	contentDirection: "column",
	alignContent: "center",
	justifyContent: "start",
	fontTexture: null,
	textType: "MSDF",
	fontColor: new THREE.Color( 0xffffff ),
	fontOpacity: 1,
	borderRadius: 0.015,
	backgroundSize: "cover",
	backgroundColor: new THREE.Color( 0x222222 ),
	backgroundWhiteColor: new THREE.Color( 0xffffff ),
	backgroundOpacity: 0.8,
	backgroundOpaqueOpacity: 1.0,
	backgroundTexture: DefaultBackgroundTexture(),
	hiddenOverflow: false,
};
const DEFAULTS = Defaults;

function DefaultBackgroundTexture() {
	const ctx = document.createElement('canvas').getContext('2d');
	ctx.canvas.width = 1;
	ctx.canvas.height = 1;
	ctx.fillStyle = '#ffffff';
	ctx.fillRect(0, 0, 1, 1);
	const texture = new THREE.CanvasTexture(ctx.canvas);
	texture.isDefault = true;
	return texture;
}

/**

Job:
- Set this component attributes and call updates accordingly
- Getting this component attribute, from itself or from its parents
- Managing this component's states

This is the core module of three-mesh-ui. Every component is composed with it.
It owns the principal public methods of a component : set, setupState and setState.

*/
function MeshUIComponent( Base = class {} ) {
	return class MeshUIComponent extends Base {
        constructor( options ) {
            super( options );
            this.states = {}
            this.currentState = undefined
            this.isUI = true
        }

        /////////////
        /// GETTERS
        /////////////

        getClippingPlanes() {
            const planes = [];
            if ( this.parent && this.parent.isUI ) {
                if ( this.isBlock && this.parent.getHiddenOverflow() ) {
                    const yLimit = (this.parent.getHeight() / 2) - (this.parent.padding || 0);
                    const xLimit = (this.parent.getWidth() / 2) - (this.parent.padding || 0);
                    const newPlanes = [
                        new THREE.Plane( new THREE.Vector3( 0, 1, 0 ), yLimit ),
                        new THREE.Plane( new THREE.Vector3( 0, -1, 0 ), yLimit ),
                        new THREE.Plane( new THREE.Vector3( 1, 0, 0 ), xLimit ),
                        new THREE.Plane( new THREE.Vector3( -1, 0, 0 ), xLimit )
                    ];
                    newPlanes.forEach( (plane)=> {
                        plane.applyMatrix4( this.parent.matrixWorld );
                    });
                    planes.push( ...newPlanes );
                }

                if ( this.parent.parent && this.parent.parent.isUI ) {
                    planes.push( ...this.parent.getClippingPlanes() );
                }
            }

            return planes;
        }

        getUIChildren() {
            return this.children.filter( (child)=> {
                return child.isUI
            });
        }

        getUIParent() {
            if ( this.parent && this.parent.isUI ) {
                return this.parent
            }
            return null
        }

        /** Get the highest parent of this component (the parent that has no parent on top of it) */
        getHighestParent() {
            if ( !this.getUIParent() ) {
                return this
            }
            return this.parent.getHighestParent();
        }

        /**
         * look for a property in this object, and if does not find it, find in parents or return default value
         * @private
         */
        _getProperty( propName ) {
            if ( this[ propName ] === undefined && this.getUIParent() ) {
                return this.parent._getProperty( propName )
            } else if ( this[ propName ] ) {
                return this[ propName ]
            }
            return DEFAULTS[ propName ];
        }

        getFontSize() {
            return this._getProperty( 'fontSize' );
        }

        getFontTexture() {
            return this._getProperty( 'fontTexture' );
        }

        getFontFamily() {
            return this._getProperty( 'fontFamily' );
        }

        getBreakOn() {
            return this._getProperty( 'breakOn' );
        }

        getTextType() {
            return this._getProperty( 'textType' );
        }

        getFontColor() {
            return this._getProperty( 'fontColor' );
        }

        getFontOpacity() {
            return this._getProperty( 'fontOpacity' );
        }

        getBorderRadius() {
            return this._getProperty( 'borderRadius' );
        }

        /// SPECIALS

        /** return the first parent with a 'threeOBJ' property */
        getContainer() {
            if ( !this.threeOBJ && this.parent ) {
                return this.parent.getContainer();
            } else if ( this.threeOBJ ) {
                return this
            }
            return DEFAULTS.container
        }

        /** Get the number of UI parents above this elements (0 if no parent) */
        getParentsNumber( i ) {
            i = i || 0;
            if ( this.getUIParent() ) {
                return this.parent.getParentsNumber( i + 1 )
            }
            return i;
        }

        ////////////////////////////////////
        /// GETTERS WITH NO PARENTS LOOKUP
        ////////////////////////////////////

        getBackgroundOpacity() {
            return ( !this.backgroundOpacity && this.backgroundOpacity !== 0 ) ?
                DEFAULTS.backgroundOpacity : this.backgroundOpacity;
        }

        getBackgroundColor() {
            return this.backgroundColor || DEFAULTS.backgroundColor;
        }

        getBackgroundTexture() {
            return this.backgroundTexture || DEFAULTS.backgroundTexture;
        }

        getAlignContent() {
            return this.alignContent || DEFAULTS.alignContent;
        }

        getContentDirection() {
            return this.contentDirection || DEFAULTS.contentDirection;
        }

        getJustifyContent() {
            return this.justifyContent || DEFAULTS.justifyContent;
        }

        getInterLine() {
            return (this.interLine === undefined) ? DEFAULTS.interLine : this.interLine;
        }

        getOffset() {
            return (this.offset === undefined) ? DEFAULTS.offset : this.offset;
        }

        getBackgroundSize() {
            return (this.backgroundSize === undefined) ? DEFAULTS.backgroundSize : this.backgroundSize;
        }

        getHiddenOverflow() {
            return (this.hiddenOverflow === undefined) ? DEFAULTS.hiddenOverflow : this.hiddenOverflow;
        }

        ///////////////
        ///  UPDATE
        ///////////////

        /**
         * When the user calls component.add, it registers for updates,
         * then call THREE.Object3D.add.
         */
        add() {
            for ( const id of Object.keys(arguments) ) {
                // An inline component relies on its parent for positioning
                if ( arguments[id].isInline ) this.update( null, true );
            }

            return super.add( ...arguments );
        }

        /**
         * When the user calls component.remove, it registers for updates,
         * then call THREE.Object3D.remove.
         */
        remove() {
            for ( const id of Object.keys(arguments) ) {
                // An inline component relies on its parent for positioning
                if ( arguments[id].isInline ) this.update( null, true );
            }
            return super.remove( ...arguments );
        }

        update( updateParsing, updateLayout, updateInner ) {
            UpdateManager.requestUpdate( this, updateParsing, updateLayout, updateInner );
        }

        /**
         * Called by FontLibrary when the font requested for the current component is ready.
         * Trigger an update for the component whose font is now available.
         * @private - "package protected"
         */
        _updateFontFamily( font ) {
            this.fontFamily = font;
            this.traverse( (child)=> {
                if ( child.isUI ) child.update( true, true, false );
            });
            this.getHighestParent().update( false, true, false );
        }

        /** @private - "package protected" */
        _updateFontTexture( texture ) {
            this.fontTexture = texture;
            this.getHighestParent().update( false, true, false );
        }

        /**
         * Set this component's passed parameters.
         * If necessary, take special actions.
         * Update this component unless otherwise specified.
         */
        set( options ) {
            let parsingNeedsUpdate, layoutNeedsUpdate, innerNeedsUpdate;

            // Register to the update manager, so that it knows when to update
            UpdateManager.register( this );

            // Abort if no option passed
            if ( !options || JSON.stringify(options) === JSON.stringify({}) ) return

            // Set this component parameters according to options, and trigger updates accordingly
            // The benefit of having two types of updates, is to put everthing that takes time
            // in one batch, and the rest in the other. This way, efficient animation is possible with
            // attribute from the light batch.
            for ( const prop of Object.keys(options) ) {
                switch ( prop ) {
                case "content" :
                    if ( this.isText ) parsingNeedsUpdate = true;
                    layoutNeedsUpdate = true;
                    this[ prop ] = options[ prop ];
                    break;
                case "width" :
                case "height" :
                case "padding" :
                    if ( this.isInlineBlock ) parsingNeedsUpdate = true;
                    layoutNeedsUpdate = true;
                    this[ prop ] = options[ prop ];
                    break;
                case "fontSize" :
                case "interLine" :
                case "margin" :
                case "contentDirection" :
                case "justifyContent" :
                case "alignContent" :
                case "textType" :
                case "borderRadius" :
                case "backgroundSize" :
                case "src" :
                    layoutNeedsUpdate = true;
                    this[ prop ] = options[ prop ];
                    break;
                case "fontColor" :
                case "fontOpacity" :
                case "offset" :
                case "backgroundColor" :
                case "backgroundOpacity" :
                case "backgroundTexture" :
                    innerNeedsUpdate = true;
                    this[ prop ] = options[ prop ];
                    break;
                case "hiddenOverflow" :
                    this[ prop ] = options[ prop ];
                    break
                }
            }

            // special cases, this.update() must be called only when some files finished loading
            if ( options.fontFamily ) {
                FontLibrary.setFontFamily( this, options.fontFamily );
                layoutNeedsUpdate = false;
            }
            if ( options.fontTexture ) {
                FontLibrary.setFontTexture( this, options.fontTexture );
                layoutNeedsUpdate = false;
            }

            // Call component update
            this.update( parsingNeedsUpdate, layoutNeedsUpdate, innerNeedsUpdate );
            if ( layoutNeedsUpdate ) this.getHighestParent().update( false, true, false );
        }

        /////////////////////
        // STATES MANAGEMENT
        /////////////////////

        /** Store a new state in this component, with linked attributes */
        setupState( options ) {
            this.states[ options.state ] = {
                attributes: options.attributes,
                onSet: options.onSet
            };
        }

        /** Set the attributes of a stored state of this component */
        setState( state ) {
            const savedState = this.states[ state ];
            if ( !savedState ) {
                console.warn(`state "${ state }" does not exist within this component`);
                return
            }
            if ( state === this.currentState ) return
            this.currentState = state;
            if ( savedState.onSet ) savedState.onSet();
            if ( savedState.attributes ) this.set( savedState.attributes );
        }

        /** Get completely rid of this component and its children, also unregister it for updates */
        clear() {
            this.traverse( (obj)=> {
                UpdateManager.disposeOf( obj );
                if ( obj.material ) obj.material.dispose();
                if ( obj.geometry ) obj.geometry.dispose();
            });
        }
	};
}

/**
 * Job: create a plane geometry with the right UVs to map the MSDF texture on the wanted glyph.
 *
 * Knows: dimension of the plane to create, specs of the font used, glyph requireed
 */
class MSDFGlyph extends THREE.PlaneBufferGeometry {
    constructor( inline, font ) {
        const char = inline.glyph;
        const fontSize = inline.fontSize;

        super( fontSize, fontSize );

        // Misc glyphs
        if ( char.match(/\s/g) === null ) {
            if ( font.info.charset.indexOf( char ) === -1 ) console.error(`The character '${ char }' is not included in the font characters set.`)
            this.mapUVs( font, char );
            this.transformGeometry( font, fontSize, char, inline );
        // White spaces (we don't want our plane geometry to have a visual width nor a height)
        } else {
            this.nullifyUVs();
            this.scale( 0, 0, 1 );
            this.translate( 0, fontSize / 2, 0 );
        }
    }

    /**
     * Compute the right UVs that will map the MSDF texture so that the passed character
     * will appear centered in full size
     * @private
     */
    mapUVs( font, char ) {
        const charOBJ = font.chars.find( charOBJ => charOBJ.char === char );
        const common = font.common;
        const xMin = charOBJ.x / common.scaleW;
        const xMax = (charOBJ.x + charOBJ.width ) / common.scaleW;
        const yMin =  1 -((charOBJ.y + charOBJ.height ) / common.scaleH);
        const yMax = 1 - (charOBJ.y / common.scaleH);

        const uvAttribute = this.attributes.uv;

        for ( let i = 0; i < uvAttribute.count; i ++ ) {
            let u = uvAttribute.getX( i );
            let v = uvAttribute.getY( i );

            [ u, v ] = (()=> {
                switch ( i ) {
                case 0 : return [ xMin, yMax ]
                case 1 : return [ xMax, yMax ]
                case 2 : return [ xMin, yMin ]
                case 3 : return [ xMax, yMin ]
                }
            })();

            uvAttribute.setXY( i, u, v );
        }
    }

    /** Set all UVs to 0, so that none of the glyphs on the texture will appear */
    nullifyUVs() {
        const uvAttribute = this.attributes.uv;
        for ( let i = 0; i < uvAttribute.count; i ++ ) {
            uvAttribute.setXY( i, 0, 0 );
        }
    }

    /** Gives the previously computed scale and offset to the geometry */
    transformGeometry( font, fontSize, char, inline ) {
        const charOBJ = font.chars.find( charOBJ => charOBJ.char === char );
        const common = font.common;
        const newHeight = charOBJ.height / common.lineHeight;
        const newWidth = (charOBJ.width * newHeight) / charOBJ.height;

        this.scale(
            newWidth,
            newHeight,
            1
        );

        this.translate(
            inline.width / 2,
            ( inline.height / 2 ) - inline.anchor,
            0
        );
    }
}

/**

Job:
- Computing glyphs dimensions according to this component's font and content
- Create the text Mesh (call MSDFGlyph for each letter)

Knows:
- The Text component for which it creates Meshes
- The parameters of the text mesh it must return

*/

function getGlyphDimensions( options ) {
	const FONT = options.font;
	const FONT_SIZE = options.fontSize;
	const GLYPH = options.glyph;

	const charOBJ = FONT.chars.find( charOBJ => charOBJ.char === GLYPH );
	let width = charOBJ ? (charOBJ.width * FONT_SIZE) / FONT.common.lineHeight : FONT_SIZE / 3 ;
	let height = charOBJ ? (charOBJ.height * FONT_SIZE) / FONT.common.lineHeight : 0 ;

	// handle whitespaces and line breaks
	if ( width === 0 )  width = FONT_SIZE;
	if ( height === 0 )  height = FONT_SIZE * 0.7;
	if ( GLYPH === '\n' ) width = 0;

	// world-space length between lowest point and the text cursor position
	const anchor = charOBJ ? ((charOBJ.yoffset + charOBJ.height - FONT.common.base) * FONT_SIZE) / FONT.common.lineHeight : 0 ;

	return { width, height, anchor }
}

function mergeBufferAttributes( attributes ) {
	let TypedArray;
	let itemSize;
	let normalized;
	let arrayLength = 0;

	for ( let i = 0; i < attributes.length; ++ i ) {
		const attribute = attributes[ i ];

		if ( attribute.isInterleavedBufferAttribute ) {
			console.error( 'THREE.BufferGeometryUtils: .mergeBufferAttributes() failed. InterleavedBufferAttributes are not supported.' );
			return null;
		}
		if ( TypedArray === undefined ) TypedArray = attribute.array.constructor;
		if ( TypedArray !== attribute.array.constructor ) {
			console.error( 'THREE.BufferGeometryUtils: .mergeBufferAttributes() failed. BufferAttribute.array must be of consistent array types across matching attributes.' );
			return null;
		}
		if ( itemSize === undefined ) itemSize = attribute.itemSize;
		if ( itemSize !== attribute.itemSize ) {
			console.error( 'THREE.BufferGeometryUtils: .mergeBufferAttributes() failed. BufferAttribute.itemSize must be consistent across matching attributes.' );
			return null;
		}
		if ( normalized === undefined ) normalized = attribute.normalized;
		if ( normalized !== attribute.normalized ) {
			console.error( 'THREE.BufferGeometryUtils: .mergeBufferAttributes() failed. BufferAttribute.normalized must be consistent across matching attributes.' );
			return null;
		}
		arrayLength += attribute.array.length;
	}

	const array = new TypedArray( arrayLength );
	let offset = 0;
	for ( let i = 0; i < attributes.length; ++ i ) {
		array.set( attributes[ i ].array, offset );
		offset += attributes[ i ].array.length;
	}
	return new THREE.BufferAttribute( array, itemSize, normalized );
}

function mergeBufferGeometries( geometries, useGroups = false ) {
	const isIndexed = geometries[ 0 ].index !== null;
	const attributesUsed = new Set( Object.keys( geometries[ 0 ].attributes ) );
	const morphAttributesUsed = new Set( Object.keys( geometries[ 0 ].morphAttributes ) );
	const attributes = {};
	const morphAttributes = {};
	const morphTargetsRelative = geometries[ 0 ].morphTargetsRelative;
	const mergedGeometry = new THREE.BufferGeometry();
	let offset = 0;

	for ( let i = 0; i < geometries.length; ++ i ) {
		const geometry = geometries[ i ];
		let attributesCount = 0;

		// ensure that all geometries are indexed, or none
		if ( isIndexed !== ( geometry.index !== null ) ) {
			console.error( 'THREE.BufferGeometryUtils: .mergeBufferGeometries() failed with geometry at index ' + i + '. All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them.' );
			return null;
		}

		// gather attributes, exit early if they're different
		for ( const name in geometry.attributes ) {
			if ( ! attributesUsed.has( name ) ) {
				console.error( 'THREE.BufferGeometryUtils: .mergeBufferGeometries() failed with geometry at index ' + i + '. All geometries must have compatible attributes; make sure "' + name + '" attribute exists among all geometries, or in none of them.' );
				return null;
			}

			if ( attributes[ name ] === undefined ) attributes[ name ] = [];
			attributes[ name ].push( geometry.attributes[ name ] );
			attributesCount ++;
		}

		// ensure geometries have the same number of attributes
		if ( attributesCount !== attributesUsed.size ) {
			console.error( 'THREE.BufferGeometryUtils: .mergeBufferGeometries() failed with geometry at index ' + i + '. Make sure all geometries have the same number of attributes.' );
			return null;
		}

		// gather morph attributes, exit early if they're different
		if ( morphTargetsRelative !== geometry.morphTargetsRelative ) {
			console.error( 'THREE.BufferGeometryUtils: .mergeBufferGeometries() failed with geometry at index ' + i + '. .morphTargetsRelative must be consistent throughout all geometries.' );
			return null;
		}

		for ( const name in geometry.morphAttributes ) {
			if ( ! morphAttributesUsed.has( name ) ) {
				console.error( 'THREE.BufferGeometryUtils: .mergeBufferGeometries() failed with geometry at index ' + i + '.  .morphAttributes must be consistent throughout all geometries.' );
				return null;
			}
			if ( morphAttributes[ name ] === undefined ) morphAttributes[ name ] = [];
			morphAttributes[ name ].push( geometry.morphAttributes[ name ] );
		}

		// gather .userData
		mergedGeometry.userData.mergedUserData = mergedGeometry.userData.mergedUserData || [];
		mergedGeometry.userData.mergedUserData.push( geometry.userData );

		if ( useGroups ) {
			let count;
			if ( isIndexed ) {
				count = geometry.index.count;
			} else if ( geometry.attributes.position !== undefined ) {
				count = geometry.attributes.position.count;
			} else {
				console.error( 'THREE.BufferGeometryUtils: .mergeBufferGeometries() failed with geometry at index ' + i + '. The geometry must have either an index or a position attribute' );
				return null;
			}
			mergedGeometry.addGroup( offset, count, i );
			offset += count;
		}
	}

	// merge indices
	if ( isIndexed ) {
		let indexOffset = 0;
		const mergedIndex = [];

		for ( let i = 0; i < geometries.length; ++ i ) {
			const index = geometries[ i ].index;

			for ( let j = 0; j < index.count; ++ j ) {
				mergedIndex.push( index.getX( j ) + indexOffset );
			}
			indexOffset += geometries[ i ].attributes.position.count;
		}
		mergedGeometry.setIndex( mergedIndex );
	}

	// merge attributes
	for ( const name in attributes ) {
		const mergedAttribute = mergeBufferAttributes( attributes[ name ] );
		if ( ! mergedAttribute ) {
			console.error( 'THREE.BufferGeometryUtils: .mergeBufferGeometries() failed while trying to merge the ' + name + ' attribute.' );
			return null;
		}
		mergedGeometry.setAttribute( name, mergedAttribute );
	}

	// merge morph attributes
	for ( const name in morphAttributes ) {
		const numMorphTargets = morphAttributes[ name ][ 0 ].length;
		if ( numMorphTargets === 0 ) break;

		mergedGeometry.morphAttributes = mergedGeometry.morphAttributes || {};
		mergedGeometry.morphAttributes[ name ] = [];

		for ( let i = 0; i < numMorphTargets; ++ i ) {
			const morphAttributesToMerge = [];
			for ( let j = 0; j < morphAttributes[ name ].length; ++ j ) {
				morphAttributesToMerge.push( morphAttributes[ name ][ j ][ i ] );
			}

			const mergedMorphAttribute = mergeBufferAttributes( morphAttributesToMerge );
			if ( ! mergedMorphAttribute ) {
				console.error( 'THREE.BufferGeometryUtils: .mergeBufferGeometries() failed while trying to merge the ' + name + ' morphAttribute.' );
				return null;
			}
			mergedGeometry.morphAttributes[ name ].push( mergedMorphAttribute );
		}
	}
	return mergedGeometry;
}

/**
 * Creates a THREE.Plane geometry, with UVs carefully positioned to map a particular
 * glyph on the MSDF texture. Then creates a shaderMaterial with the MSDF shaders,
 * creates a THREE.Mesh, returns it.
 * @private
 */
function buildText() {
    const component = this;
    const translatedGeom = [];

    component.inlines.forEach( (inline, i)=> {
        translatedGeom[ i ] = new MSDFGlyph( inline, this.getFontFamily() );
        translatedGeom[ i ].translate( inline.offsetX, inline.offsetY, 0 );
    });
    const mergedGeom = mergeBufferGeometries( translatedGeom );
    const mesh = new THREE.Mesh( mergedGeom, this.getFontMaterial() );
    return mesh
}

const MSDFText = {
	getGlyphDimensions,
	buildText
}

/**

Job:
- Routing the request for Text dimensions and Text creation depending on Text type.

Knows:
- this component's textType attribute

Note:
Only one Text type is natively supported by the library at the moment,
but the architecture allows you to easily stick in your custom Text type.
More information here :
https://github.com/felixmariotto/three-mesh-ui/wiki/Using-a-custom-text-type

*/
function TextManager( Base = class {} ) {
    return class TextManager extends Base {
        createText() {
            const component = this;
            const mesh = (() => {
                switch ( this.getTextType() ) {
                case 'MSDF' :
                    return MSDFText.buildText.call( this )
                default :
                    console.warn(`'${ this.getTextType() }' is not a supported text type.\nSee https://github.com/felixmariotto/three-mesh-ui/wiki/Using-a-custom-text-type`);
                    break
                }
            })()
            mesh.renderOrder = Infinity;

            // This is for hiddenOverflow to work
            mesh.onBeforeRender = function() {
                if ( component.updateClippingPlanes ) {
                    component.updateClippingPlanes();
                }
            };
            return mesh
        }

        /**
         * Called by Text to get the domensions of a particular glyph,
         * in order for InlineManager to compute its position
         */
        getGlyphDimensions( options ) {
            switch ( options.textType ) {
            case 'MSDF' :
                return MSDFText.getGlyphDimensions( options )
            default :
                console.warn(`'${ options.textType }' is not a supported text type.\nSee https://github.com/felixmariotto/three-mesh-ui/wiki/Using-a-custom-text-type`);
                break
            }
        }
    }
}

/**

Job:
- Host the materials of a given component.
- Update a component's materials clipping planes
- When materials attributes are updated, update the material

Knows:
- Its component materials
- Its component ancestors clipping planes

*/
function MaterialManager( Base = class {} ) {
	return class MaterialManager extends Base {
        getBackgroundUniforms() {
            const texture = this.getBackgroundTexture();

            let color, opacity

            if ( texture.isDefault ) {
                color = this.getBackgroundColor();
                opacity = this.getBackgroundOpacity();
            } else {
                color = this.backgroundColor || Defaults.backgroundWhiteColor;

                opacity = ( !this.backgroundOpacity && this.backgroundOpacity !== 0 ) ?
                    Defaults.backgroundOpaqueOpacity :
                    this.backgroundOpacity;
            }
            return {
                texture,
                color,
                opacity
            }
        }

        /** Update existing backgroundMaterial uniforms */
        updateBackgroundMaterial() {
            if ( this.backgroundUniforms ) {
                const uniforms = this.getBackgroundUniforms();
                this.backgroundUniforms.u_texture.value = uniforms.texture;
                this.backgroundUniforms.u_color.value = uniforms.color;
                this.backgroundUniforms.u_opacity.value = uniforms.opacity;
            }
        }

        /** Update existing fontMaterial uniforms */
        updateTextMaterial() {
            if ( this.textUniforms ) {
                this.textUniforms.u_texture.value = this.getFontTexture();
                this.textUniforms.u_color.value = this.getFontColor();
                this.textUniforms.u_opacity.value = this.getFontOpacity();
            }
        }

        /**
         * Update a component's materials clipping planes.
         * Called every frame
         */
        updateClippingPlanes( value ) {
            const newClippingPlanes = value !== undefined ? value : this.getClippingPlanes();
            if ( JSON.stringify( newClippingPlanes ) !== JSON.stringify( this.clippingPlanes ) ) {
                this.clippingPlanes = newClippingPlanes;
                if ( this.fontMaterial ) this.fontMaterial.clippingPlanes = this.clippingPlanes;
                if ( this.backgroundMaterial ) this.backgroundMaterial.clippingPlanes = this.clippingPlanes;
            }
        }

        /** Called by Block, which needs the background material to create a mesh */
        getBackgroundMaterial() {
            const newUniforms = this.getBackgroundUniforms();

            if ( !this.backgroundMaterial || !this.backgroundUniforms ) {
                this.backgroundMaterial = this._makeBackgroundMaterial( newUniforms );
            } else if (
                newUniforms.texture !== this.backgroundUniforms.u_texture.value ||
                newUniforms.color !== this.backgroundUniforms.u_color.value ||
                newUniforms.opacity !== this.backgroundUniforms.u_opacity.value
            ) {
                this.updateBackgroundMaterial();
            }
            return this.backgroundMaterial
        }

        /** Called by Text to get the font material */
        getFontMaterial() {
            const newUniforms = {
                'u_texture': this.getFontTexture(),
                'u_color': this.getFontColor(),
                'u_opacity': this.getFontOpacity()
            };
            if ( !this.fontMaterial || !this.textUniforms ) {
                this.fontMaterial = this._makeTextMaterial( newUniforms );
            } else if (
                newUniforms.u_texture !== this.textUniforms.u_texture.value ||
                newUniforms.u_color !== this.textUniforms.u_color.value ||
                newUniforms.u_opacity !== this.textUniforms.u_opacity.value
            ) {
                this.updateTextMaterial();
            }
            return this.fontMaterial
        }

        /** @private */
        _makeTextMaterial( materialOptions ) {
            this.textUniforms = {
                'u_texture': { value: materialOptions.u_texture },
                'u_color': { value: materialOptions.u_color },
                'u_opacity': { value: materialOptions.u_opacity }
            }
            /*
            setInterval( ()=> {
                this.textUniforms.u_color.value.set( 0xffffff * Math.random() );
            }, 100 )
            */
            return new THREE.ShaderMaterial({
                uniforms: this.textUniforms,
                transparent: true,
                clipping: true,
                vertexShader: textVertex,
                fragmentShader: textFragment,
                extensions: {
                    derivatives: true
                }
            })
        }

        /** @private */
        _makeBackgroundMaterial( materialOptions ) {
            this.backgroundUniforms = {
                'u_texture': { value: materialOptions.texture },
                'u_color': { value: materialOptions.color },
                'u_opacity': { value: materialOptions.opacity }
            };
            /*
            setInterval( ()=> {
                this.backgroundUniforms.u_color.value.set( 0xffffff * Math.random() );
            }, 100 )
            */
            return new THREE.ShaderMaterial({
                uniforms: this.backgroundUniforms,
                transparent: true,
                clipping: true,
                vertexShader: backgroundVertex,
                fragmentShader: backgroundFragment,
                extensions: {
                    derivatives: true
                }
            })
        }
	}
}

////////////////
// Text shaders
////////////////

const textVertex = `
	varying vec2 vUv;

	#include <clipping_planes_pars_vertex>

	void main() {
		vUv = uv;
		vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
		gl_Position = projectionMatrix * mvPosition;
		gl_Position.z-= 0.005;

		#include <clipping_planes_vertex>
	}
`;

//

const textFragment = `
	uniform sampler2D u_texture;
	uniform vec3 u_color;
	uniform float u_opacity;

	varying vec2 vUv;

	#include <clipping_planes_pars_fragment>

	float median(float r, float g, float b) {
		return max(min(r, g), min(max(r, g), b));
	}

	void main() {
		vec3 textureSample = texture2D( u_texture, vUv ).rgb;
		float sigDist = median( textureSample.r, textureSample.g, textureSample.b ) - 0.5;
		float alpha = clamp( sigDist / fwidth( sigDist ) + 0.5, 0.0, 1.0 );
		gl_FragColor = vec4( u_color, min( alpha, u_opacity ) );

		#include <clipping_planes_fragment>
	}
`;

//////////////////////
// Background shaders
//////////////////////

const backgroundVertex = `
	varying vec2 vUv;

	#include <clipping_planes_pars_vertex>

	void main() {
		vUv = uv;
		vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
		gl_Position = projectionMatrix * mvPosition;

		#include <clipping_planes_vertex>

	}
`;

//

const backgroundFragment = `
	uniform sampler2D u_texture;
	uniform vec3 u_color;
	uniform float u_opacity;

	varying vec2 vUv;

	#include <clipping_planes_pars_fragment>

	void main() {
		vec4 textureSample = texture2D( u_texture, vUv ).rgba;
    float blendedOpacity = u_opacity * textureSample.a;
    vec3 blendedColor = textureSample.rgb * u_color;
		gl_FragColor = vec4( blendedColor, blendedOpacity );

		#include <clipping_planes_fragment>
	}
`;

/** Recursively erase THE CHILDREN of the passed object */
function deepDelete( object3D ) {
	object3D.children.forEach( (child)=> {
		if ( child.children.length > 0 ) deepDelete( child );
		object3D.remove( child );
		UpdateManager.disposeOf( child );
		if ( child.material ) child.material.dispose();
		if ( child.geometry ) child.geometry.dispose();
	});
	object3D.children = [];
}

let _Base = null

/**
 * A function for applying multiple mixins more tersely (less verbose)
 * @param {Function[]} mixins - All args to this function should be mixins that take a class and return a class.
 */
function mix(...mixins) {
    // console.log('initial Base: ', _Base);
    let Base = _Base || class Default {};
    _Base = null

    let i = mixins.length
    let mixin

    while ( --i >= 0 ) {
        mixin = mixins[ i ]
        Base = mixin(Base);
    }

    return Base;
}

mix.withBase = ( Base ) => {
    _Base = Base
    return mix
}

/**

Job:
- computing its own size according to user measurements or content measurement
- creating 'inlines' objects with info, so that the parent component can organise them in lines

Knows:
- Its text content (string)
- Font attributes ('font', 'fontSize'.. etc..)
- Parent block

*/
class Text extends mix.withBase( THREE.Object3D )(
    InlineComponent,
    TextManager,
    MaterialManager,
    MeshUIComponent
) {
    constructor( options ) {
        super( options );
        this.isText = true;
        this.set( options );
    }
    
    measure() {
      this.parseParams(x=>x);
      return [this.width, this.height];
    }

    ///////////
    // UPDATES
    ///////////


    /**
     * Here we compute each glyph dimension, and we store it in this
     * component's inlines parameter. This way the parent Block will
     * compute each glyph position on updateLayout.
     */
    parseParams( resolve ) {
        const content = this.content ;
        const font = this.getFontFamily();
        const fontSize = this.getFontSize();
        const breakChars = this.getBreakOn();
        const textType = this.getTextType();

        // Abort condition
        if ( !font || typeof font === 'string' ) {
            if ( !FontLibrary.getFontOf( this ) ) console.warn('no font was found');
            return
        }
        if ( !this.content ) { this.inlines = null; return; }
        if ( !textType ) { console.error( "You must to provide a 'textType' attribute so three-mesh-ui knows how to render your text.\n See https://github.com/felixmariotto/three-mesh-ui/wiki/Using-a-custom-text-type" ); return; }

        // Compute glyphs sizes
        const chars = Array.from ? Array.from( content ) : String( content ).split( '' );

        const glyphInfos = chars.map( (glyph)=> {
            // Get height, width, and anchor point of this glyph
            const dimensions = this.getGlyphDimensions({
                textType,
                glyph,
                font,
                fontSize
            });

            let lineBreak = null ;
            if ( breakChars.includes( glyph ) || glyph.match(/\s/g) ) lineBreak = "possible" ;
            if ( glyph.match(/\n/g) ) lineBreak = "mandatory" ;

            return {
                height: dimensions.height,
                width: dimensions.width,
                anchor: dimensions.anchor,
                lineBreak,
                glyph,
                fontSize
            };
        });

        // Update 'inlines' property, so that the parent can compute each glyph position
        this.inlines = glyphInfos;
        
        const minAnchor = glyphInfos.reduce((l,i) => l < i.anchor ? i.anchor : l, 0);
        const maxTop = glyphInfos.reduce((h,i) => h < i.height-i.anchor ? i.height-i.anchor : h, 0);
        this.height = minAnchor + maxTop;
        this.width = this.inlines.reduce((w,i) => w+i.width, 0);
        resolve();
    }


    /**
     * Create text content
     *
     * At this point, text.inlines should have been modified by the parent
     * component, to add xOffset and yOffset properties to each inlines.
     * This way, TextContent knows were to position each character.
     */
    updateLayout() {
        deepDelete( this );

        if ( this.inlines ) {
            // happening in TextManager
            this.textContent = this.createText();

            this.add( this.textContent );
        }
        this.position.z = this.getOffset();
    }

    updateInner() {
        this.position.z = this.getOffset();
        if ( this.textContent ) this.updateTextMaterial();
    }
}

// BLOCK

/**

Job: Handle everything related to a BoxComponent element dimensioning and positioning

Knows: Parents and children dimensions and positions

It's worth noting that in three-mesh-ui, it's the parent Block that computes
its children position. A Block can only have either only box components (Block)
as children, or only inline components (Text, InlineBlock).

*/
function BoxComponent( Base = class {} ) {

    return class BoxComponent extends Base {
        constructor( options ) {
            super( options );
            this.isBoxComponent = true;
            this.childrenPos = {};
        }


        /** Get width of this component minus its padding */
        getInnerWidth() {
            const DIRECTION = this.getContentDirection();
            switch ( DIRECTION ) {
            case 'row' :
            case 'row-reverse' :
                return this.width - (this.padding * 2 || 0) || this.getChildrenSideSum( 'width' );
            case 'column' :
            case 'column-reverse' :
                return this.getHighestChildSizeOn( 'width' )
            default :
                console.error(`Invalid contentDirection : ${ DIRECTION }`);
                break;
            }
        }

        /** Get height of this component minus its padding */
        getInnerHeight() {
            const DIRECTION = this.getContentDirection();
            switch ( DIRECTION ) {
            case 'row' :
            case 'row-reverse' :
                return this.getHighestChildSizeOn( 'height' );
            case 'column' :
            case 'column-reverse' :
                return this.height - (this.padding * 2 || 0) || this.getChildrenSideSum( 'height' );
            default :
                console.error(`Invalid contentDirection : ${ DIRECTION }`);
                break;
            }
        }

        /** Return the sum of all this component's children sides + their margin */
        getChildrenSideSum( dimension ) {
            return this.children.reduce((accu, child)=> {
                if ( !child.isBoxComponent ) return accu
                const margin = (child.margin * 2) || 0;
                const CHILD_SIZE = (dimension === "width") ?
                    (child.getWidth() + margin) :
                    (child.getHeight() + margin);
                return accu + CHILD_SIZE;
            }, 0 );
        }

        /** Look in parent record what is the instructed position for this component, then set its position */
        setPosFromParentRecords() {
            if ( this.getUIParent() && this.getUIParent().childrenPos[ this.id ] ) {
                this.position.x = ( this.getUIParent().childrenPos[ this.id ].x );
                this.position.y = ( this.getUIParent().childrenPos[ this.id ].y );
            }
        }

        /** Position inner elements according to dimensions and layout parameters. */
        computeChildrenPosition() {
            if ( this.children.length > 0 ) {
                const DIRECTION = this.getContentDirection();
                let X_START, Y_START;
                switch ( DIRECTION ) {
                case 'row' :
                    // start position of the children positioning inside this component
                    X_START = this.getInnerWidth() / 2;
                    this.setChildrenXPos( -X_START );
                    this.alignChildrenOnY();
                    break;
                case 'row-reverse' :
                    // start position of the children positioning inside this component
                    X_START = this.getInnerWidth() / 2;
                    this.setChildrenXPos( X_START );
                    this.alignChildrenOnY();
                    break;
                case 'column' :
                    // start position of the children positioning inside this component
                    Y_START = this.getInnerHeight() / 2;
                    this.setChildrenYPos( Y_START );
                    this.alignChildrenOnX();
                    break;
                case 'column-reverse' :
                    // start position of the children positioning inside this component
                    Y_START = this.getInnerHeight() / 2;
                    this.setChildrenYPos( -Y_START );
                    this.alignChildrenOnX();
                    break;
                }
            }
        }

        /** Set children X position according to this component dimension and attributes */
        setChildrenXPos( startPos ) {
            const JUSTIFICATION = this.getJustifyContent();

            if ( JUSTIFICATION !== 'center' && JUSTIFICATION !== 'start' && JUSTIFICATION !== 'end' ) {
                console.warn(`justifiyContent === '${ JUSTIFICATION }' is not supported`);
            }

            this.children.reduce( (accu, child)=> {
                if ( !child.isBoxComponent ) return accu

                const CHILD_ID = child.id;
                const CHILD_WIDTH = child.getWidth();
                const CHILD_MARGIN = child.margin || 0;

                accu += CHILD_MARGIN * -Math.sign( startPos );

                this.childrenPos[ CHILD_ID ] = {
                    x: accu + ((CHILD_WIDTH / 2) * -Math.sign( startPos )),
                    y: 0
                };

                return accu + (-Math.sign( startPos ) * (CHILD_WIDTH + CHILD_MARGIN))
            }, startPos );

            if ( JUSTIFICATION === "end" || JUSTIFICATION === "center" ) {
                let offset = (startPos * 2) - (this.getChildrenSideSum('width') * Math.sign(startPos));
                if ( JUSTIFICATION === "center" ) offset /= 2;
                this.children.forEach( (child)=> {
                    if ( !child.isBoxComponent ) return
                    this.childrenPos[ child.id ].x -= offset
                });
            }
        }

        /** Set children Y position according to this component dimension and attributes */
        setChildrenYPos( startPos ) {
            const JUSTIFICATION = this.getJustifyContent();
            this.children.reduce( (accu, child)=> {
                if ( !child.isBoxComponent ) return accu

                const CHILD_ID = child.id;
                const CHILD_HEIGHT = child.getHeight();
                const CHILD_MARGIN = child.margin || 0;

                accu += CHILD_MARGIN * -Math.sign( startPos );

                this.childrenPos[ CHILD_ID ] = {
                    x: 0,
                    y: accu + ((CHILD_HEIGHT / 2) * -Math.sign( startPos ))
                };

                return accu + (-Math.sign( startPos ) * (CHILD_HEIGHT + CHILD_MARGIN))
            }, startPos );

            if ( JUSTIFICATION === "end" || JUSTIFICATION === "center" ) {
                let offset = (startPos * 2) - (this.getChildrenSideSum('height') * Math.sign(startPos));
                if ( JUSTIFICATION === "center" ) offset /= 2;

                this.children.forEach( (child)=> {
                    if ( !child.isBoxComponent ) return
                    this.childrenPos[ child.id ].y -= offset
                });
            }
        }

        /** called if justifyContent is 'column' or 'column-reverse', it align the content horizontally */
        alignChildrenOnX() {
            const ALIGNMENT = this.getAlignContent();
            const X_TARGET = (this.getWidth() / 2) - (this.padding || 0);

            if ( ALIGNMENT !== "center" && ALIGNMENT !== "right" && ALIGNMENT !== "left" ) {
                console.warn(`alignContent === '${ ALIGNMENT }' is not supported on this direction.`)
            }

            this.children.forEach( (child)=> {
                if ( !child.isBoxComponent ) return
                let offset;

                if ( ALIGNMENT === "right" ) {
                    offset = X_TARGET - (child.getWidth() / 2) - (child.margin || 0) ;
                } else if ( ALIGNMENT === "left" ) {
                    offset = -X_TARGET + (child.getWidth() / 2) + (child.margin || 0) ;
                }
                this.childrenPos[ child.id ].x = offset || 0;
            });
        }

        /** called if justifyContent is 'row' or 'row-reverse', it align the content vertically */
        alignChildrenOnY() {
            const ALIGNMENT = this.getAlignContent();
            const Y_TARGET = (this.getHeight() / 2) - (this.padding || 0);
            if ( ALIGNMENT !== "center" && ALIGNMENT !== "top" && ALIGNMENT !== "bottom" ) {
                console.warn(`alignContent === '${ ALIGNMENT }' is not supported on this direction.`)
            }
            this.children.forEach( (child)=> {
                if ( !child.isBoxComponent ) return
                let offset;
                if ( ALIGNMENT === "top" ) {
                    offset = Y_TARGET - (child.getHeight() / 2) - (child.margin || 0) ;
                } else if ( ALIGNMENT === "bottom" ) {
                    offset = -Y_TARGET + (child.getHeight() / 2) + (child.margin || 0) ;
                }
                this.childrenPos[ child.id ].y = offset || 0;
            });
        }

        /**
         * Returns the highest linear dimension among all the children of the passed component
         * MARGIN INCLUDED
         */
        getHighestChildSizeOn( direction ) {
            return this.children.reduce((accu, child)=> {
                if ( !child.isBoxComponent ) return accu
                const margin = child.margin || 0;
                const maxSize = direction === "width" ?
                    child.getWidth() + (margin * 2) :
                    child.getHeight() + (margin * 2) ;
                return Math.max(accu, maxSize)
            }, 0 );
        }

        /**
         * Get width of this element
         * With padding, without margin
         */
        getWidth() {
            return this.width || this.getInnerWidth() + (this.padding * 2 || 0);
        }

        /**
         * Get height of this element
         * With padding, without margin
         */
        getHeight() {
            return this.height || this.getInnerHeight() + (this.padding * 2 || 0);
        }
    }
}

/**
 * Job: Create and return a plane mesh according to dimensions and style parameters
 *
 * Knows: Dimension and style of the plane to create
 */
class Frame extends THREE.Mesh {
    constructor( width, height, borderRadius, backgroundSize, material ) {
        const shape = new RoundedRectShape( width, height, borderRadius );
        const geometry = new THREE.ShapeBufferGeometry( shape );
        super( geometry, material );
        this.castShadow = true;
        this.receiveShadow = true;
        this.name = "MeshUI-Frame";
        this.width = width;
        this.height = height;
        this.updateUVs( backgroundSize ); // cover, contain, or stretch
    }

    /**
     * Call the right function to update the geometry UVs depending on the backgroundSize param
     * @private
     */
    updateUVs( backgroundSize ) {
        switch( backgroundSize ) {
        case 'stretch' :
            this.mapStretchUVs();
            break
        case 'contain' :
            if (!this.mapFitUVs( backgroundSize ))
                this.mapStretchUVs();
            break
        case 'cover' :
            if (!this.mapFitUVs( backgroundSize ))
                this.mapStretchUVs();
            break
        default :
            console.warn(`'${ backgroundSize }' is an unknown value for the backgroundSize attribute`)
        }
        this.geometry.attributes.uv.needsUpdate = true;
    }

    /**
     * Update the UVs of the geometry so that the
     * left-most point will be u = 0 and the right-most
     * point will be u = 1. Same for V direction.
     * @private
     */
    mapStretchUVs() {
        const uvAttribute = this.geometry.attributes.uv;
        const posAttribute = this.geometry.attributes.position;

        const dummyVec = new THREE.Vector2();
        const offset = new THREE.Vector2( this.width / 2, this.height / 2 );

        for ( let i = 0; i < posAttribute.count; i ++ ) {
            dummyVec.x = posAttribute.getX( i );
            dummyVec.y = posAttribute.getY( i );

            dummyVec.add( offset );

            // Stretch the texture to make it size like the geometry
            dummyVec.x /= this.width;
            dummyVec.y /= this.height;

            uvAttribute.setXY( i, dummyVec.x, dummyVec.y );
        }
    }

    /**
     * Update the UVs of the passed geometry so that the passed texture
     * is not deformed and is fit to the geometry's border.
     * Depending on the backgroundSize parameter, the texture will
     * overflow in the smallest axis of the geometry and fit the widest,
     * or the reverse.
     * @private
     */
    mapFitUVs( backgroundSize ) {
        const texture = this.material.uniforms.u_texture ?
            this.material.uniforms.u_texture.value :
            null;
        if (!texture) return false

        const imageHeight = texture.image.height;
        const imageWidth = texture.image.width;

        // get the dimension of the texture that fit the Y direction of the geometry
        const yFitDimensions = new THREE.Vector2(
            (this.height * imageWidth) / imageHeight,
            this.height
        );

        // get the dimension of the texture that fit the X direction of the geometry
        const xFitDimensions = new THREE.Vector2(
            this.width,
            (this.width * imageHeight) / imageWidth
        );

        // Depending on the backgroundSize attribute, we keep either yFitDimensions or xFitDimensions
        let fitDimensions;
        if ( backgroundSize === "contain" ) {
            fitDimensions = xFitDimensions.length() < yFitDimensions.length() ? xFitDimensions : yFitDimensions;
        } else {
            fitDimensions = xFitDimensions.length() > yFitDimensions.length() ? xFitDimensions : yFitDimensions;
        }

        // Update UVs
        const uvAttribute = this.geometry.attributes.uv;
        const posAttribute = this.geometry.attributes.position;

        const dummyVec = new THREE.Vector2();
        const offset = new THREE.Vector2( this.width / 2, this.height / 2 );

        for ( let i = 0; i < posAttribute.count; i ++ ) {
            dummyVec.x = posAttribute.getX( i );
            dummyVec.y = posAttribute.getY( i );
            dummyVec.add( offset );

            // resize the texture so it does not stretch
            dummyVec.x /= fitDimensions.x;
            dummyVec.y /= fitDimensions.y;

            // center the texture
            dummyVec.x -= (( this.width / fitDimensions.x ) / 2) - 0.5;
            dummyVec.y -= (( this.height / fitDimensions.y ) / 2) - 0.5;

            uvAttribute.setXY( i, dummyVec.x, dummyVec.y );
        }
        return true
    }
}

/** A THREE.Shape of rounded rectangle */
class RoundedRectShape extends THREE.Shape {
    constructor( width, height, radius ) {
        super();
        const x = - width / 2 ;
        const y = - height / 2 ;

        this.moveTo( x, y + radius );
        this.lineTo( x, y + height - radius );
        this.quadraticCurveTo( x, y + height, x + radius, y + height );
        this.lineTo( x + width - radius, y + height );
        this.quadraticCurveTo( x + width, y + height, x + width, y + height - radius );
        this.lineTo( x + width, y + radius );
        this.quadraticCurveTo( x + width, y, x + width - radius, y );
        this.lineTo( x + radius, y );
        this.quadraticCurveTo( x, y, x, y + radius );
    }
}

/**

Job: Positioning inline elements according to their dimensions inside this component

Knows: This component dimensions, and its children dimensions

This module is used for Block composition (Object.assign). A Block is responsible
for the positioning of its inline elements. In order for it to know what is the
size of these inline components, parseParams must be called on its children first.

It's worth noting that a Text is not positioned as a whole, but letter per letter,
in order to create a line break when necessary. It's Text that merge the various letters
in its own updateLayout function.

*/
function InlineManager( Base = class {} ) {

	return class InlineManager extends Base {

        /** Compute children .inlines objects position, according to their pre-computed dimensions */
        computeInlinesPosition() {
            // computed by BoxComponent
            const INNER_WIDTH = this.getWidth() - (this.padding * 2 || 0);
            // Will stock the characters of each line, so that we can
            // correct lines position before to merge
            const lines = [[]];

            this.children.filter( (child)=> {
                return child.isInline ? true : false
            })
                .reduce( (lastInlineOffset, inlineComponent)=> {
                    // Abort condition
                    if ( !inlineComponent.inlines ) return

                    //////////////////////////////////////////////////////////////
                    // Compute offset of each children according to its dimensions
                    //////////////////////////////////////////////////////////////

                    const currentInlineInfo = inlineComponent.inlines.reduce( (lastInlineOffset, inline, i, inlines)=> {
                        // Line break
                        const nextBreak = this.distanceToNextBreak( inlines, i );
                        if (
                            lastInlineOffset + inline.width > INNER_WIDTH ||
                            inline.lineBreak === "mandatory" ||
                            this.shouldFriendlyBreak( inlines[ i - 1 ], lastInlineOffset, nextBreak, INNER_WIDTH )
                        ) {
                            lines.push([ inline ]);
                            inline.offsetX = 0;
                            return inline.width;
                        }
                        lines[ lines.length - 1 ].push( inline );
                        inline.offsetX = lastInlineOffset;
                        return lastInlineOffset + inline.width;
                    }, lastInlineOffset );
                    return currentInlineInfo
                }, 0 );

            /////////////////////////////////////////////////////////////////
            // Position lines according to justifyContent and contentAlign
            /////////////////////////////////////////////////////////////////

            // got by BoxComponent
            const INNER_HEIGHT = this.getHeight() - (this.padding * 2 || 0);

            // got by MeshUIComponent
            const JUSTIFICATION = this.getJustifyContent();
            const ALIGNMENT = this.getAlignContent();
            const INTERLINE = this.getInterLine();

            // Compute lines dimensions
            lines.forEach( (line)=> {
                line.lowestPoint = line.reduce( (lowest, inline)=> {
                    return lowest < inline.anchor ? inline.anchor : lowest
                }, 0 );

                line.heighestPoint = line.reduce( (highest, inline)=> {
                    const topPart = inline.height - inline.anchor;
                    return highest < topPart ? topPart : highest
                }, 0 );

                line.totalHeight = line.lowestPoint + line.heighestPoint;

                line.width = line.reduce( (width, inline)=> {
                    return width + inline.width
                }, 0 );
            });

            // individual vertical offset
            let textHeight = lines.reduce( (offsetY, line, i, arr)=> {
                line.forEach( (char)=> {
                    char.offsetY = offsetY - line.totalHeight + line.lowestPoint + arr[0].totalHeight;
                });
                return offsetY - line.totalHeight - INTERLINE;
            }, 0 ) + INTERLINE;

            textHeight = Math.abs( textHeight );

            // Line vertical positioning
            const justificationOffset = (()=> {
                switch ( JUSTIFICATION ) {
                case 'start': return (INNER_HEIGHT / 2) - lines[0].totalHeight
                case 'end': return textHeight - lines[0].totalHeight - ( INNER_HEIGHT / 2 ) + (lines[ lines.length -1 ].totalHeight - lines[ lines.length -1 ].totalHeight) ;
                case 'center': return (textHeight / 2) - lines[0].totalHeight
                default: console.warn(`justifyContent: '${ JUSTIFICATION }' is not valid`)
                }
            })();

            lines.forEach( (line)=> {
                line.forEach( (inline)=> {
                    inline.offsetY += justificationOffset
                });
            });

            // Horizontal positioning
            lines.forEach( (line)=> {
                const alignmentOffset = (()=> {
                    switch ( ALIGNMENT ) {
                    case 'left': return -INNER_WIDTH / 2
                    case 'right': return -line.width + (INNER_WIDTH / 2)
                    case 'center': return -line.width / 2
                    default: console.warn(`alignContent: '${ ALIGNMENT }' is not valid`)
                    }
                })();
                line.forEach( (char)=> {
                    char.offsetX += alignmentOffset
                });
            });
        }

        /**
         * get the distance in world coord to the next glyph defined
         * as break-line-safe ( like whitespace for instance )
         * @private
         */
        distanceToNextBreak( inlines, currentIdx, accu ) {
            accu = accu || 0 ;
            // end of the text
            if ( !inlines[ currentIdx ] ) return accu

            // if inline.lineBreak is set, it is 'mandatory' or 'possible'
            if ( inlines[ currentIdx ].lineBreak ) {
                return accu + inlines[ currentIdx ].width
            // no line break is possible on this character
            }
            return this.distanceToNextBreak(
                inlines,
                currentIdx + 1,
                accu + inlines[ currentIdx ].width
            );
        }

        /**
         * Test if we should line break here even if the current glyph is not out of boundary.
         * It might be necessary if the last glyph was break-line-friendly (whitespace, hyphen..)
         * and the distance to the next friendly glyph is out of boundary.
         */
        shouldFriendlyBreak( prevChar, lastInlineOffset, nextBreak, INNER_WIDTH ) {
            // We can't check if last glyph is break-line-friendly it does not exist
            if ( !prevChar || !prevChar.glyph ) return false
            // Next break-line-friendly glyph is inside boundary
            if ( lastInlineOffset + nextBreak < INNER_WIDTH ) return false
            // Characters to prioritize breaking line (eg: white space)
            const BREAK_ON = this.getBreakOn();
            // Previous glyph was break-line-friendly
            return BREAK_ON.indexOf( prevChar.glyph ) > -1
        }
	}
}

/**

Job:
- Update a Block component
- Calls BoxComponent's API to position its children box components
- Calls InlineManager's API to position its children inline components
- Call creation and update functions of its background planes

*/
class Block extends mix.withBase( THREE.Object3D )(
    BoxComponent,
    InlineManager,
    MaterialManager,
    MeshUIComponent
) {
    constructor( options ) {
        super( options );
        this.isBlock = true;
        this.frameContainer = new THREE.Object3D();
        this.add( this.frameContainer );
        // Lastly set the options parameters to this object, which will trigger an update
        this.set( options );
    }

    ////////////
    //  UPDATE
    ////////////

    parseParams( resolve ) { resolve() }

    updateLayout() {
        // Get temporary dimension
        const WIDTH = this.getWidth();
        const HEIGHT = this.getHeight();
        if ( !WIDTH || !HEIGHT ) {
            console.warn('Block got no dimension from its parameters or from children parameters');
            return
        }

        // Position this element according to earlier parent computation.
        // Delegate to BoxComponent.
        this.setPosFromParentRecords();

        // Position inner elements according to dimensions and layout parameters.
        // Delegate to BoxComponent.
        if ( !this.children.find( child => child.isInline ) ) {
            this.computeChildrenPosition();
        } else {
            this.computeInlinesPosition();
        }

        // Cleanup previous depictions
        deepDelete( this.frameContainer );

        // Create new visible frame
        this.frame = new Frame(
            WIDTH,
            HEIGHT,
            this.getBorderRadius(),
            this.getBackgroundSize(),
            this.getBackgroundMaterial()
        );
        this.frame.renderOrder = this.getParentsNumber();
        const component = this;

        // This is for hiddenOverflow to work
        this.frame.onBeforeRender = function() {
            if ( component.updateClippingPlanes ) {
                component.updateClippingPlanes();
            }
        };
        this.frameContainer.add( this.frame );

        // We check if this block is the root component,
        // because most of the time the user wants to set the
        // root component's z position themselves
        if ( this.getUIParent() ) {
            this.position.z = this.getOffset();
        }
    }

    updateInner() {
        // We check if this block is the root component,
        // because most of the time the user wants to set the
        // root component's z position themselves
        if ( this.getUIParent() ) {
            this.position.z = this.getOffset();
        }
        if ( this.frame ) this.updateBackgroundMaterial();
    }
}

ThreeMeshUI = {
  Text, Block, update: () => UpdateManager.update()
};
