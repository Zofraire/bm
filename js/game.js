/**
 * 3D Flappy Bird Game
 * Built with Three.js
 * Background: Interactive Landscape by André Mattos (Codrops)
 */

(function() {
    'use strict';

    // ============================================
    // GAME CONFIGURATION
    // ============================================
    const CONFIG = {
        // Bird settings
        bird: {
            startX: 0,
            startY: 8,
            startZ: -20,
            size: 1.2,
            gravity: -0.018,
            flapStrength: 0.4,
            maxVelocity: 0.5,
            minVelocity: -0.6,
            rotationSpeed: 0.1
        },
        // Pipe settings
        pipes: {
            speed: 0.3,
            spawnInterval: 2500,
            gapSize: 9,
            width: 4,
            height: 25,
            depth: 4,
            startZ: -120,
            endZ: 10,
            minY: 4,
            maxY: 14
        },
        // Game boundaries
        bounds: {
            top: 18,
            bottom: -2,
            left: -25,
            right: 25
        },
        // Camera
        camera: {
            fov: 60,
            near: 0.1,
            far: 10000,
            positionY: 10,
            positionZ: 15
        }
    };

    // ============================================
    // GAME STATE
    // ============================================
    let gameState = {
        status: 'start', // 'start', 'playing', 'gameover'
        score: 0,
        highScore: parseInt(localStorage.getItem('flappyHighScore')) || 0
    };

    // ============================================
    // THREE.JS SCENE SETUP
    // ============================================
    let container, width, height;
    let scene, renderer, camera;
    let terrain, bird, pipes = [];
    let clock = new THREE.Clock();

    // Bird physics
    let birdVelocity = 0;
    let birdRotation = 0;

    // Pipe spawning
    let lastPipeSpawn = 0;

    // Input state
    let flapPressed = false;

    // UI Elements
    const scoreDisplay = document.getElementById('score');
    const startScreen = document.getElementById('start-screen');
    const gameOverScreen = document.getElementById('game-over');
    const finalScoreEl = document.getElementById('final-score');
    const highScoreEl = document.getElementById('high-score');

    // ============================================
    // INITIALIZATION
    // ============================================
    function init() {
        container = document.querySelector('.landscape');
        width = window.innerWidth;
        height = window.innerHeight;

        setupScene();
        createLandscape();
        createBird();
        setupLights();
        setupEventListeners();

        // Update high score display
        highScoreEl.textContent = gameState.highScore;

        // Start render loop
        render();
    }

    function setupScene() {
        scene = new THREE.Scene();

        // White fog background (like demo1)
        const fogColor = new THREE.Color(0xffffff);
        scene.background = fogColor;
        scene.fog = new THREE.Fog(fogColor, 10, 400);

        // Camera
        camera = new THREE.PerspectiveCamera(
            CONFIG.camera.fov,
            width / height,
            CONFIG.camera.near,
            CONFIG.camera.far
        );
        camera.position.y = CONFIG.camera.positionY;
        camera.position.z = CONFIG.camera.positionZ;

        // Renderer
        renderer = new THREE.WebGLRenderer({
            canvas: container,
            antialias: true
        });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(width, height);

        // Sky
        createSky();
    }

    function createSky() {
        const sky = new THREE.Sky();
        sky.scale.setScalar(450000);
        sky.material.uniforms.turbidity.value = 20;
        sky.material.uniforms.rayleigh.value = 0;
        sky.material.uniforms.luminance.value = 1;
        sky.material.uniforms.mieCoefficient.value = 0.01;
        sky.material.uniforms.mieDirectionalG.value = 0.8;
        scene.add(sky);

        const sunSphere = new THREE.Mesh(
            new THREE.SphereBufferGeometry(20000, 16, 8),
            new THREE.MeshBasicMaterial({ color: 0xffffff })
        );
        sunSphere.visible = false;
        scene.add(sunSphere);

        const theta = Math.PI * (-0.02);
        const phi = 2 * Math.PI * (-0.25);

        sunSphere.position.x = 400000 * Math.cos(phi);
        sunSphere.position.y = 400000 * Math.sin(phi) * Math.sin(theta);
        sunSphere.position.z = 400000 * Math.sin(phi) * Math.cos(theta);

        sky.material.uniforms.sunPosition.value.copy(sunSphere.position);
    }

    function setupLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
        directionalLight.position.set(10, 20, 10);
        scene.add(directionalLight);
    }

    // ============================================
    // LANDSCAPE (BACKGROUND)
    // ============================================
    function createLandscape() {
        const geometry = new THREE.PlaneBufferGeometry(100, 400, 400, 400);

        const uniforms = {
            time: { type: 'f', value: 0.0 },
            distortCenter: { type: 'f', value: 0.1 },
            roadWidth: { type: 'f', value: 1.0 },
            pallete: { type: 't', value: null },
            speed: { type: 'f', value: 0.5 },
            maxHeight: { type: 'f', value: 10.0 },
            color: new THREE.Color(1, 1, 1)
        };

        const material = new THREE.ShaderMaterial({
            uniforms: THREE.UniformsUtils.merge([THREE.ShaderLib.basic.uniforms, uniforms]),
            vertexShader: document.getElementById('custom-vertex').textContent,
            fragmentShader: document.getElementById('custom-fragment').textContent,
            wireframe: false,
            fog: true
        });

        terrain = new THREE.Mesh(geometry, material);
        terrain.position.z = -180;
        terrain.rotation.x = -Math.PI / 2;
        scene.add(terrain);

        // Load texture
        new THREE.TextureLoader().load('img/pallete5.png', function(texture) {
            terrain.material.uniforms.pallete.value = texture;
            terrain.material.needsUpdate = true;
        });
    }

    // ============================================
    // BIRD
    // ============================================
    function createBird() {
        // Inner group for the bird model (built facing +X)
        const birdModel = new THREE.Group();

        // Body - main ellipsoid
        const bodyGeometry = new THREE.SphereGeometry(CONFIG.bird.size, 16, 16);
        bodyGeometry.scale(1.2, 1, 0.9);
        const bodyMaterial = new THREE.MeshPhongMaterial({
            color: 0xf9d71c, // Yellow
            shininess: 30
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        birdModel.add(body);

        // Belly - white part
        const bellyGeometry = new THREE.SphereGeometry(CONFIG.bird.size * 0.7, 16, 16);
        bellyGeometry.scale(1, 0.8, 0.7);
        const bellyMaterial = new THREE.MeshPhongMaterial({
            color: 0xfef5e7,
            shininess: 20
        });
        const belly = new THREE.Mesh(bellyGeometry, bellyMaterial);
        belly.position.set(0.2, -0.1, 0.3);
        birdModel.add(belly);

        // Eye white (left)
        const eyeWhiteGeometry = new THREE.SphereGeometry(CONFIG.bird.size * 0.35, 12, 12);
        const eyeWhiteMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
        const eyeWhiteLeft = new THREE.Mesh(eyeWhiteGeometry, eyeWhiteMaterial);
        eyeWhiteLeft.position.set(0.6, 0.3, 0.5);
        birdModel.add(eyeWhiteLeft);

        // Eye white (right)
        const eyeWhiteRight = new THREE.Mesh(eyeWhiteGeometry, eyeWhiteMaterial);
        eyeWhiteRight.position.set(0.6, 0.3, -0.5);
        birdModel.add(eyeWhiteRight);

        // Pupil (left)
        const pupilGeometry = new THREE.SphereGeometry(CONFIG.bird.size * 0.15, 8, 8);
        const pupilMaterial = new THREE.MeshPhongMaterial({ color: 0x000000 });
        const pupilLeft = new THREE.Mesh(pupilGeometry, pupilMaterial);
        pupilLeft.position.set(0.85, 0.35, 0.5);
        birdModel.add(pupilLeft);

        // Pupil (right)
        const pupilRight = new THREE.Mesh(pupilGeometry, pupilMaterial);
        pupilRight.position.set(0.85, 0.35, -0.5);
        birdModel.add(pupilRight);

        // Beak
        const beakGeometry = new THREE.ConeGeometry(0.3, 0.8, 8);
        const beakMaterial = new THREE.MeshPhongMaterial({ color: 0xff6b35 });
        const beak = new THREE.Mesh(beakGeometry, beakMaterial);
        beak.rotation.z = -Math.PI / 2;
        beak.position.set(1.4, 0, 0);
        birdModel.add(beak);

        // Wing (left)
        const wingGeometry = new THREE.SphereGeometry(CONFIG.bird.size * 0.5, 8, 8);
        wingGeometry.scale(1.2, 0.3, 0.8);
        const wingMaterial = new THREE.MeshPhongMaterial({ color: 0xe6c619 });
        const wingLeft = new THREE.Mesh(wingGeometry, wingMaterial);
        wingLeft.position.set(-0.2, 0, 0.9);
        wingLeft.name = 'wingLeft';
        birdModel.add(wingLeft);

        // Wing (right)
        const wingRight = new THREE.Mesh(wingGeometry.clone(), wingMaterial);
        wingRight.position.set(-0.2, 0, -0.9);
        wingRight.name = 'wingRight';
        birdModel.add(wingRight);

        // Tail
        const tailGeometry = new THREE.BoxGeometry(0.6, 0.1, 0.8);
        const tailMaterial = new THREE.MeshPhongMaterial({ color: 0xe6c619 });
        const tail = new THREE.Mesh(tailGeometry, tailMaterial);
        tail.position.set(-1.2, 0.1, 0);
        tail.rotation.z = 0.2;
        birdModel.add(tail);

        // Rotate the model to face forward (-Z direction, away from camera)
        birdModel.rotation.y = -Math.PI / 2;
        birdModel.name = 'birdModel';

        // Outer group for position and tilt
        bird = new THREE.Group();
        bird.add(birdModel);
        bird.position.set(CONFIG.bird.startX, CONFIG.bird.startY, CONFIG.bird.startZ);
        scene.add(bird);
    }

    function animateBirdWings(time) {
        if (!bird) return;

        const birdModel = bird.getObjectByName('birdModel');
        if (!birdModel) return;

        const wingLeft = birdModel.getObjectByName('wingLeft');
        const wingRight = birdModel.getObjectByName('wingRight');

        if (wingLeft && wingRight) {
            const flapSpeed = gameState.status === 'playing' ? 15 : 5;
            const flapAmount = Math.sin(time * flapSpeed) * 0.4;
            wingLeft.rotation.x = flapAmount;
            wingRight.rotation.x = -flapAmount;
        }
    }

    // ============================================
    // PIPES
    // ============================================
    function createPipe(gapCenterY) {
        const pipeGroup = new THREE.Group();
        pipeGroup.userData.passed = false;

        // Pipe material - green gradient look
        const pipeMaterial = new THREE.MeshPhongMaterial({
            color: 0x2ecc71,
            shininess: 30
        });

        const pipeCapMaterial = new THREE.MeshPhongMaterial({
            color: 0x27ae60,
            shininess: 40
        });

        // Top pipe
        const topPipeHeight = CONFIG.bounds.top - gapCenterY - CONFIG.pipes.gapSize / 2;
        if (topPipeHeight > 0) {
            const topPipeGeometry = new THREE.BoxGeometry(
                CONFIG.pipes.width,
                topPipeHeight,
                CONFIG.pipes.depth
            );
            const topPipe = new THREE.Mesh(topPipeGeometry, pipeMaterial);
            topPipe.position.y = gapCenterY + CONFIG.pipes.gapSize / 2 + topPipeHeight / 2;
            pipeGroup.add(topPipe);

            // Top pipe cap
            const topCapGeometry = new THREE.BoxGeometry(
                CONFIG.pipes.width + 0.8,
                1,
                CONFIG.pipes.depth + 0.8
            );
            const topCap = new THREE.Mesh(topCapGeometry, pipeCapMaterial);
            topCap.position.y = gapCenterY + CONFIG.pipes.gapSize / 2 + 0.5;
            pipeGroup.add(topCap);
        }

        // Bottom pipe
        const bottomPipeHeight = gapCenterY - CONFIG.pipes.gapSize / 2 - CONFIG.bounds.bottom;
        if (bottomPipeHeight > 0) {
            const bottomPipeGeometry = new THREE.BoxGeometry(
                CONFIG.pipes.width,
                bottomPipeHeight,
                CONFIG.pipes.depth
            );
            const bottomPipe = new THREE.Mesh(bottomPipeGeometry, pipeMaterial);
            bottomPipe.position.y = CONFIG.bounds.bottom + bottomPipeHeight / 2;
            pipeGroup.add(bottomPipe);

            // Bottom pipe cap
            const bottomCapGeometry = new THREE.BoxGeometry(
                CONFIG.pipes.width + 0.8,
                1,
                CONFIG.pipes.depth + 0.8
            );
            const bottomCap = new THREE.Mesh(bottomCapGeometry, pipeCapMaterial);
            bottomCap.position.y = gapCenterY - CONFIG.pipes.gapSize / 2 - 0.5;
            pipeGroup.add(bottomCap);
        }

        // Store gap info for collision detection
        pipeGroup.userData.gapTop = gapCenterY + CONFIG.pipes.gapSize / 2;
        pipeGroup.userData.gapBottom = gapCenterY - CONFIG.pipes.gapSize / 2;

        // Position pipe at bird's X, spawn far ahead in -Z
        pipeGroup.position.set(CONFIG.bird.startX, 0, CONFIG.pipes.startZ);
        scene.add(pipeGroup);
        pipes.push(pipeGroup);

        return pipeGroup;
    }

    function spawnPipe() {
        const gapY = CONFIG.pipes.minY + Math.random() * (CONFIG.pipes.maxY - CONFIG.pipes.minY);
        createPipe(gapY);
    }

    function updatePipes(delta) {
        const moveAmount = CONFIG.pipes.speed;

        for (let i = pipes.length - 1; i >= 0; i--) {
            const pipe = pipes[i];
            pipe.position.z += moveAmount;

            // Check if pipe passed the bird (for scoring)
            // Score when pipe passes the bird's Z position going towards camera
            if (!pipe.userData.passed && pipe.position.z > bird.position.z + 2) {
                pipe.userData.passed = true;
                incrementScore();
            }

            // Remove pipes that are behind the camera
            if (pipe.position.z > CONFIG.pipes.endZ) {
                scene.remove(pipe);
                pipes.splice(i, 1);
            }
        }
    }

    // ============================================
    // COLLISION DETECTION
    // ============================================
    function checkCollisions() {
        if (gameState.status !== 'playing') return false;

        const birdY = bird.position.y;
        const birdX = bird.position.x;
        const birdZ = bird.position.z;
        const birdRadius = CONFIG.bird.size * 0.8;

        // Check bounds
        if (birdY < CONFIG.bounds.bottom + birdRadius || birdY > CONFIG.bounds.top - birdRadius) {
            return true;
        }

        // Check pipe collisions
        for (const pipe of pipes) {
            const pipeZ = pipe.position.z;
            const pipeX = pipe.position.x || birdX;

            // Check if bird is within pipe's Z range
            const zDistance = Math.abs(pipeZ - birdZ);
            if (zDistance < CONFIG.pipes.depth / 2 + birdRadius) {
                // Check if bird is within pipe's X range (they share same X)
                const xDistance = Math.abs(pipeX - birdX);
                if (xDistance < CONFIG.pipes.width / 2 + birdRadius) {
                    // Check if bird is in the gap
                    if (birdY - birdRadius < pipe.userData.gapBottom ||
                        birdY + birdRadius > pipe.userData.gapTop) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    // ============================================
    // GAME LOGIC
    // ============================================
    function startGame() {
        gameState.status = 'playing';
        gameState.score = 0;
        birdVelocity = 0;
        gameTime = 0;
        lastPipeSpawn = 0;

        // Reset bird position and rotation
        bird.position.set(CONFIG.bird.startX, CONFIG.bird.startY, CONFIG.bird.startZ);
        const birdModel = bird.getObjectByName('birdModel');
        if (birdModel) {
            birdModel.rotation.x = 0;
        }

        // Clear existing pipes
        pipes.forEach(pipe => scene.remove(pipe));
        pipes = [];

        // Update UI
        scoreDisplay.textContent = '0';
        startScreen.classList.add('hidden');
        gameOverScreen.classList.add('hidden');

        // First pipe spawns after a short delay (handled by gameTime check)
    }

    function gameOver() {
        gameState.status = 'gameover';

        // Update high score
        if (gameState.score > gameState.highScore) {
            gameState.highScore = gameState.score;
            localStorage.setItem('flappyHighScore', gameState.highScore);
        }

        // Show game over screen
        finalScoreEl.textContent = gameState.score;
        highScoreEl.textContent = gameState.highScore;
        gameOverScreen.classList.remove('hidden');
    }

    function incrementScore() {
        gameState.score++;
        scoreDisplay.textContent = gameState.score;

        // Visual feedback
        scoreDisplay.style.transform = 'translateX(-50%) scale(1.3)';
        setTimeout(() => {
            scoreDisplay.style.transform = 'translateX(-50%) scale(1)';
        }, 100);
    }

    function flap() {
        if (gameState.status === 'start' || gameState.status === 'gameover') {
            startGame();
        }

        if (gameState.status === 'playing') {
            birdVelocity = CONFIG.bird.flapStrength;
        }
    }

    // ============================================
    // EVENT LISTENERS
    // ============================================
    function setupEventListeners() {
        // Keyboard
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !flapPressed) {
                e.preventDefault();
                flapPressed = true;
                flap();
            }
        });

        window.addEventListener('keyup', (e) => {
            if (e.code === 'Space') {
                flapPressed = false;
            }
        });

        // Touch/Mouse
        window.addEventListener('touchstart', (e) => {
            e.preventDefault();
            flap();
        }, { passive: false });

        window.addEventListener('mousedown', (e) => {
            if (e.button === 0) {
                flap();
            }
        });

        // Resize
        window.addEventListener('resize', onResize);
    }

    function onResize() {
        width = window.innerWidth;
        height = window.innerHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    }

    // ============================================
    // RENDER LOOP
    // ============================================
    let gameTime = 0;

    function render() {
        requestAnimationFrame(render);

        const time = performance.now() * 0.001;
        const delta = clock.getDelta();

        // Update landscape
        if (terrain && terrain.material.uniforms) {
            terrain.material.uniforms.time.value = time;
        }

        // Game logic
        if (gameState.status === 'playing') {
            gameTime += delta;

            // Apply gravity to bird
            birdVelocity += CONFIG.bird.gravity;
            birdVelocity = Math.max(CONFIG.bird.minVelocity, Math.min(CONFIG.bird.maxVelocity, birdVelocity));
            bird.position.y += birdVelocity;

            // Tilt bird based on velocity (X rotation for pitch since bird faces -Z)
            const birdModel = bird.getObjectByName('birdModel');
            if (birdModel) {
                const targetTilt = -birdVelocity * 2.5; // negative because of orientation
                birdModel.rotation.x = THREE.MathUtils.lerp(birdModel.rotation.x, targetTilt, 0.1);
            }

            // Spawn pipes at regular intervals
            if (gameTime > lastPipeSpawn + CONFIG.pipes.spawnInterval / 1000) {
                spawnPipe();
                lastPipeSpawn = gameTime;
            }

            // Update pipes
            updatePipes(delta);

            // Check collisions
            if (checkCollisions()) {
                gameOver();
            }
        } else if (gameState.status === 'start') {
            // Idle animation - bird bobs up and down
            bird.position.y = CONFIG.bird.startY + Math.sin(time * 2) * 0.5;
            const birdModel = bird.getObjectByName('birdModel');
            if (birdModel) {
                birdModel.rotation.x = Math.sin(time * 3) * 0.1;
            }
        }

        // Animate bird wings
        animateBirdWings(time);

        renderer.render(scene, camera);
    }

    // ============================================
    // START
    // ============================================
    init();

})();
