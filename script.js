const params = {
    massSun: 1.989e30,       // Massa do Sol (kg)
    massEarth: 5.972e24,     // Massa da Terra (kg)
    massMoon: 7.348e22,      // Massa da Lua (kg)

    positionEarth: { x: 7.5e10, y: 0, z: 0 }, // Aproximadamente 0.5 UA
    positionMoon: { x: 7.5e10 + 3.84e9, y: 0, z: 1e7 }, // Terra + distância Terra-Lua com escala reduzida
    
    // Velocidades iniciais (em metros por segundo)
    velocityEarth: { x: 0, y: 0, z: 23824 }, // Velocidade orbital média da Terra reduzida
    velocityMoon: { x: 0, y: 1022, z: 23824 }, // Velocidade da Terra + componente perpendicular para Lua

    timeScale: 1000,

    distanceScale: 1e-8,
    velocityScale: 1e-5,

    focusBody: 'None',
    
    showGrid: true,
    gridOpacity: 1.0
};

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
    75, window.innerWidth / window.innerHeight, 0.1, 1e13
);
camera.position.set(0, 30, 60);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const pointLight = new THREE.PointLight(0xffffff, 2);
pointLight.position.set(0, 0, 0);
scene.add(pointLight);

const gridSize = 1e6;
const gridDivisions = 10000;
const gridHelper = new THREE.GridHelper(gridSize, gridDivisions, 0x444444, 0x888888);

gridHelper.material.transparent = true;
gridHelper.material.opacity = params.gridOpacity;

gridHelper.position.y = -0.5;
scene.add(gridHelper);

function createCelestialBody(radius, color, textureURL) {
    const geometry = new THREE.SphereGeometry(radius, 32, 32);
    let material;
    if (textureURL) {
        const textureLoader = new THREE.TextureLoader();
        const texture = textureLoader.load(textureURL);
        material = new THREE.MeshPhongMaterial({ map: texture });
    } else {
        material = new THREE.MeshPhongMaterial({ color });
    }
    return new THREE.Mesh(geometry, material);
}

const sun = createCelestialBody(5, 0xffff00, '');
const earth = createCelestialBody(1.5, 0x0000ff, '');
const moon = createCelestialBody(0.4, 0x888888, '');

scene.add(sun);
scene.add(earth);
scene.add(moon);

const gui = new dat.GUI();
gui.add(params, 'timeScale', 0.1, 10000000).name('Tempo');
gui.add(params, 'distanceScale', 1e-10, 1e-6).name('Distância');
gui.add(params, 'velocityScale', 1e-6, 1e-4).name('Velocidade');
gui.add(params, 'focusBody', ['None', 'Sol', 'Terra', 'Lua']).name('Focar em');

gui.add({ separator: '------- Grid -------' }, 'separator').name(' ').listen();

gui.add(params, 'showGrid').name('Mostrar').onChange((value) => {
    gridHelper.visible = value;
});
gui.add(params, 'gridOpacity', 0.0, 1.0).name('Opacidade').onChange((value) => {
    gridHelper.material.opacity = value;
});

// Constante Gravitacional
const G = 6.67430e-11;

const bodies = [
    {
        name: 'Sol',
        mesh: sun,
        mass: params.massSun,
        position: new THREE.Vector3(0, 0, 0),
        velocity: new THREE.Vector3(0, 0, 0),
        acceleration: new THREE.Vector3(0, 0, 0),
        trail: null,
        trailPositions: []
    },
    {
        name: 'Terra',
        mesh: earth,
        mass: params.massEarth,
        position: new THREE.Vector3(
            params.positionEarth.x,
            params.positionEarth.y,
            params.positionEarth.z
        ),
        velocity: new THREE.Vector3(
            params.velocityEarth.x,
            params.velocityEarth.y,
            params.velocityEarth.z
        ),
        acceleration: new THREE.Vector3(0, 0, 0),
        trail: null,
        trailPositions: []
    },
    {
        name: 'Lua',
        mesh: moon,
        mass: params.massMoon,
        position: new THREE.Vector3(
            params.positionMoon.x,
            params.positionMoon.y,
            params.positionMoon.z
        ),
        velocity: new THREE.Vector3(
            params.velocityMoon.x,
            params.velocityMoon.y,
            params.velocityMoon.z
        ),
        acceleration: new THREE.Vector3(0, 0, 0),
        trail: null,
        trailPositions: []
    }
];

bodies.forEach(body => {
    body.mesh.position.copy(body.position.clone().multiplyScalar(params.distanceScale));
});

const trailMaterials = {
    'Sol': new THREE.LineBasicMaterial({ color: 0xffff00 }),
    'Terra': new THREE.LineBasicMaterial({ color: 0x0000ff }),
    'Lua': new THREE.LineBasicMaterial({ color: 0x888888 })
};

function initTrails() {
    bodies.forEach(body => {
        const geometry = new THREE.BufferGeometry().setFromPoints([]);
        const line = new THREE.Line(geometry, trailMaterials[body.name]);
        scene.add(line);
        body.trail = line;
    });
}

initTrails();

function updatePositions(dt) {
    bodies.forEach(body => {
        body.acceleration.set(0, 0, 0);
    });

    for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
            const bodyA = bodies[i];
            const bodyB = bodies[j];

            const distanceVector = new THREE.Vector3().subVectors(
                bodyB.position, bodyA.position
            );
            const distance = distanceVector.length();
            const forceMagnitude = (G * bodyA.mass * bodyB.mass) / (distance * distance);

            const forceVector = distanceVector.normalize().multiplyScalar(forceMagnitude);

            bodyA.acceleration.add(
                forceVector.clone().divideScalar(bodyA.mass)
            );
            bodyB.acceleration.add(
                forceVector.clone().negate().divideScalar(bodyB.mass)
            );
        }
    }

    bodies.forEach(body => {
        body.velocity.add(body.acceleration.clone().multiplyScalar(dt * params.timeScale));

        body.position.add(body.velocity.clone().multiplyScalar(dt * params.timeScale));

        body.mesh.position.copy(body.position.clone().multiplyScalar(params.distanceScale));

        body.trailPositions.push(body.mesh.position.clone());

        if (body.trailPositions.length > 1000) {
            body.trailPositions.shift();
        }

        const positions = body.trailPositions.map(pos => pos.toArray()).flat();
        body.trail.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        body.trail.geometry.setDrawRange(0, body.trailPositions.length);
        body.trail.geometry.attributes.position.needsUpdate = true;
    });
}

window.addEventListener('resize', () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
});

let isPlaying = false;
const playButton = document.getElementById('playButton');

playButton.addEventListener('click', () => {
    isPlaying = !isPlaying;
    playButton.textContent = isPlaying ? 'Pause' : 'Play';
});

let currentFocus = 'None';

gui.__controllers.forEach(controller => {
    if (controller.property === 'focusBody') {
        controller.onChange(function(value) {
            currentFocus = value;
            if (value === 'None') {
                controls.target.set(0, 0, 0);
            } else {
                const body = bodies.find(b => b.name === value);
                if (body) {
                    controls.target.copy(body.mesh.position);
                }
            }
        });
    }
});

let lastTime = Date.now();

function animate() {
    requestAnimationFrame(animate);

    const currentTime = Date.now();
    const deltaTime = ((currentTime - lastTime) / 1000); // deltaTime em segundos
    lastTime = currentTime;

    if (isPlaying) {
        updatePositions(deltaTime);
    }

    if (currentFocus !== 'None') {
        const body = bodies.find(b => b.name === currentFocus);
        if (body) {
            controls.target.copy(body.mesh.position);
        }
    }

    controls.update();
    renderer.render(scene, camera);
}
animate();
