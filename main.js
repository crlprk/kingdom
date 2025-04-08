/**
 * Kingdom Main Module
 * This module initializes the THREE.js renderer, scenes, camera, and handles user interactions.
 * It creates a main 3D scene where the camera is controlled with mouse and keyboard events.
 */

import * as THREE from 'three';

// Global variables

/** Main camera using an orthographic projection. */
let camera;
/** Pivot point for the camera to enable rotation. */
let cameraPivot;
/** WebGL renderer for drawing scenes. */
let renderer;
/** Main 3D scene. */
let mainScene;
/** Render target for off-screen rendering. */
let renderTarget;
/** Scene used to render a quad that displays the render target texture. */
let renderScene;
/** Orthographic camera for the render scene. */
let renderCamera;
/** Mesh for the quad that displays the render target texture. */
let quadMesh;

// Mouse and camera control variables
let mouseAction = false;
let previousMouseX = 0;
let cameraDistance = 5;
let zoomLevel = 1;
let targetZoomLevel = zoomLevel;
/** Discrete zoom levels available to the camera. */
const zoomLevels = [0.5, 1, 2, 4]; 
let zoomIndex = 1; 
let cameraRotation = 0;

const VIEWPORT_SCALE = window.innerWidth / 640;

// Render offset variables for pixel snapping
/** Offset for rendering panned movements. */
let renderOffset = new THREE.Vector3(0, 0, 0);
/** World units per pixel in the camera view. Updated when zoom changes. */
let unitPerCameraPixel = 0;
/** Adjusted unit value considering camera tilt. */
let xAngleAdjustedUPCP = 0;

/**
 * Initializes the application:
 * - Sets up event listeners.
 * - Configures the renderer, off-screen target, and scenes.
 * - Creates the camera and associated pivot for rotation.
 * - Adds a default light and a test box.
 */
function init() {
    // Setup event listeners
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('wheel', onMouseScroll);

    // Renderer setup with the designated canvas
    const canvas = document.querySelector('#c');
    renderer = new THREE.WebGLRenderer({canvas, antialias: false});
    renderer.setSize(window.innerWidth, window.innerWidth / 2);
    renderer.setPixelRatio(1);

    // Create off-screen render target with nearest filtering to preserve pixel art sharpness
    renderTarget = new THREE.WebGLRenderTarget(644, 324);
    renderTarget.texture.minFilter = THREE.NearestFilter;
    renderTarget.texture.magFilter = THREE.NearestFilter;

    // Setup render scene and its orthographic camera
    renderScene = new THREE.Scene();
    renderCamera = new THREE.OrthographicCamera(-320, 320, 160, -160, 0, 1);

    // Create a quad mesh that will display the contents of the render target
    const quadMaterial = new THREE.MeshBasicMaterial({
        map: renderTarget.texture
    });
    const quadGeometry = new THREE.PlaneGeometry(644, 324);
    quadMesh = new THREE.Mesh(quadGeometry, quadMaterial);
    renderScene.add(quadMesh);

    // Setup the main orthographic camera and its pivot
    cameraPivot = new THREE.Object3D();
    const aspect = 2;
    const fustrumSize = 10;
    camera = new THREE.OrthographicCamera(
        -fustrumSize * aspect,
        fustrumSize * aspect,
        fustrumSize,
        -fustrumSize,
        0.1,
        1000
    );
    setZoom(zoomLevel);
    camera.position.set(0, Math.tan(Math.PI / 6), cameraDistance);
    camera.rotation.set(-Math.PI / 6, 0, 0);
    cameraPivot.add(camera);

    // Main scene setup
    mainScene = new THREE.Scene();

    // Add a directional light source
    const color = 0xFFFFFF;
    const intensity = 5;
    const light = new THREE.DirectionalLight(color, intensity);
    light.position.set(-5, 4, 0);
    mainScene.add(light);

    // Create a testing box in the scene
    const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
    const boxMaterial = new THREE.MeshPhongMaterial({color: 0x44aa88});
    const box = new THREE.Mesh(boxGeometry, boxMaterial);
    box.rotation.y = Math.PI / 4;
    mainScene.add(box);

    // Add the camera pivot to the main scene, so its transformation is applied
    mainScene.add(cameraPivot);

    // Begin the animation loop
    start();
}

/**
 * Handles the mouse down event.
 * Enables mouse action for camera rotation.
 *
 * @param {MouseEvent} event - The mouse event.
 */
function onMouseDown(event) {
    mouseAction = true;
    previousMouseX = event.clientX;
}

/**
 * Handles the mouse up event.
 * Disables the mouse action.
 *
 * @param {MouseEvent} event - The mouse event.
 */
function onMouseUp(event) {
    mouseAction = false;
}

/**
 * Handles the mouse move event.
 * Rotates the camera pivot if the mouse is held down.
 *
 * @param {MouseEvent} event - The mouse event.
 */
function onMouseMove(event) {
    if (!mouseAction) {
        return;
    }
    const deltaX = event.clientX - previousMouseX; 
    if (deltaX < 0 && Math.abs(deltaX) > 40) {
        cameraRotation += Math.PI / 4;
        previousMouseX = event.clientX;
    }
    if (deltaX > 0 && Math.abs(deltaX) > 40) {
        cameraRotation -= Math.PI / 4;
        previousMouseX = event.clientX;
    }
}

/**
 * Handles key down events to pan the view.
 * W/A/S/D keys translate the render offset.
 *
 * @param {KeyboardEvent} event - The keyboard event.
 */
function onKeyDown(event) {
    const moveSpeed = 0.9;
    if (event.key === 'w') renderOffset.z += moveSpeed;
    if (event.key === 's') renderOffset.z -= moveSpeed;
    if (event.key === 'a') renderOffset.x -= moveSpeed;
    if (event.key === 'd') renderOffset.x += moveSpeed;
}

/**
 * Handles the mouse scroll event to change the zoom level.
 * Adjusts discretely between preset zoom levels.
 *
 * @param {WheelEvent} event - The wheel event.
 */
function onMouseScroll(event) {
    console.log(zoomLevel, targetZoomLevel);
    if (Math.abs(zoomLevel - targetZoomLevel) > 0.1) {
        return; // Ignore scroll input if a zoom transition is in progress.
    }
    if (event.deltaY < 0) {
        // Zoom in
        if (zoomIndex < zoomLevels.length - 1) {
            zoomIndex++;
        }
    } else {
        // Zoom out
        if (zoomIndex > 0) {
            zoomIndex--;
        }
    }
    targetZoomLevel = zoomLevels[zoomIndex];
}

/**
 * Calculates the units per camera pixel based on the camera's frustum.
 * Also calculates an adjusted value based on the camera's tilt.
 *
 * @returns {Object} Contains:
 *  - unitPerCameraPixel {number}: World units per pixel.
 *  - xAngleAdjustedUPCP {number}: Adjusted value factoring in camera tilt.
 */
function calculateUnitPerCameraPixel() {
    const verticalViewSize = camera.top - camera.bottom;
    const verticalPixelHeight = renderTarget.height;
    const unitPerCameraPixel = verticalViewSize / verticalPixelHeight;
    const cameraTiltAngleDegrees = THREE.MathUtils.radToDeg(-camera.rotation.x);
    const xAngleAdjustedUPCP = unitPerCameraPixel * Math.tan(THREE.MathUtils.degToRad(90 - cameraTiltAngleDegrees));
    return { unitPerCameraPixel, xAngleAdjustedUPCP };
}

/**
 * Snaps a given vector's component to the nearest pixel grid.
 *
 * @param {number} vector - The original value.
 * @param {number} pixelSize - The size of a pixel in world units.
 * @returns {number} The snapped value.
 */
function snapToPixelGrid(vector, pixelSize) {
    return Math.round(vector / pixelSize) * pixelSize;
}

/**
 * Applies the render offset to the camera pivot using pixel snapping.
 * This ensures that the displayed scene aligns to the pixel grid for clarity.
 */
function applyRenderOffset() {
    if (Math.abs(renderOffset.x) >= 1) {
        // Horizontal movement (right/left)
        const moveX = unitPerCameraPixel * Math.sign(renderOffset.x);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cameraPivot.quaternion);
        cameraPivot.position.add(right.multiplyScalar(moveX));
        renderOffset.x -= Math.sign(renderOffset.x);
    }
    
    if (Math.abs(renderOffset.z) >= 1) {
        // Forward/backward movement, adjusted by the camera tilt angle
        const moveZ = xAngleAdjustedUPCP * Math.sign(renderOffset.z);
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(cameraPivot.quaternion);
        cameraPivot.position.add(forward.multiplyScalar(moveZ));
        renderOffset.z -= Math.sign(renderOffset.z);
    }
    
    if (Math.abs(renderOffset.y) >= 1) {
        // Vertical movement (up/down)
        const moveY = unitPerCameraPixel * Math.sign(renderOffset.y);
        const up = new THREE.Vector3(0, 1, 0);
        cameraPivot.position.add(up.multiplyScalar(moveY));
        renderOffset.y -= Math.sign(renderOffset.y);
    }
    
    // Snap the camera pivot position to ensure pixel-perfect rendering
    cameraPivot.position.x = snapToPixelGrid(cameraPivot.position.x, unitPerCameraPixel);
    cameraPivot.position.y = snapToPixelGrid(cameraPivot.position.y, unitPerCameraPixel);
    cameraPivot.position.z = snapToPixelGrid(cameraPivot.position.z, unitPerCameraPixel);
    
    // Calculate and apply the final offset for the quad that displays the scene.
    const finalOffsetX = -Math.round(renderOffset.x) * unitPerCameraPixel;
    const finalOffsetY = -Math.round(renderOffset.y + renderOffset.z) * unitPerCameraPixel;
    quadMesh.position.set(finalOffsetX, finalOffsetY, 0);
}

/**
 * Sets the zoom level by adjusting the camera's frustum parameters.
 * Also recalculates pixel unit values based on the new zoom.
 *
 * @param {number} level - The desired zoom level.
 */
function setZoom(level) {
    zoomLevel = level;
    const aspect = 2;
    const frustumSize = 10 / zoomLevel;
    camera.top = frustumSize;
    camera.bottom = -frustumSize;
    camera.left = -frustumSize * aspect;
    camera.right = frustumSize * aspect;
    camera.updateProjectionMatrix();
    // Recalculate pixel sizes based on the new frustum
    const pixelUnits = calculateUnitPerCameraPixel();
    unitPerCameraPixel = pixelUnits.unitPerCameraPixel;
    xAngleAdjustedUPCP = pixelUnits.xAngleAdjustedUPCP;
}

/**
 * Starts the animation and rendering loop.
 * This function continually updates the scene, processes zoom interpolation,
 * applies render offsets, and re-renders both the main scene and the display quad.
 */
function start() {
    requestAnimationFrame(start);
    // Smoothly interpolate toward the target zoom level
    zoomLevel = THREE.MathUtils.lerp(zoomLevel, targetZoomLevel, 0.1);
    setZoom(zoomLevel);
    // Apply any panning movements
    applyRenderOffset();
    // Render the main scene to the off-screen target
    renderer.setRenderTarget(renderTarget);
    renderer.render(mainScene, camera);
    // Render the quad scene (displaying the off-screen texture) to the screen
    renderer.setRenderTarget(null);
    renderer.render(renderScene, renderCamera);
    // Update camera pivot rotation based on mouse input
    cameraPivot.rotation.y = cameraRotation;
}

// Initialize the application
init();