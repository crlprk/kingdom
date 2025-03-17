import * as THREE from 'three';

function init() {
    // Renderer
    const canvas = document.querySelector('#c');
    const renderer = new THREE.WebGLRenderer({canvas});
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Camera
    const aspect = window.innerWidth / window.innerHeight;
    const fustrumSize = 10;
    const camera = new THREE.OrthographicCamera(
        -fustrumSize * aspect,
        fustrumSize * aspect,
        fustrumSize,
        -fustrumSize,
        0.1,
        1000
    );

    camera.position.z = 5;
    camera.rotation.x = Math.PI / 6;

    // Main scene
    const mainScene = new THREE.Scene();

    // Testing box
    const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
    const boxMaterial = new THREE.MeshBasicMaterial({color: 0x44aa88});
    const box = new THREE.Mesh(boxGeometry, boxMaterial);
    mainScene.add(box);
}