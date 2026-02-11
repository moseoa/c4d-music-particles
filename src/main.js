import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ParticleSystem } from './ParticleSystem.js';
import { AudioAnalyzer } from './AudioAnalyzer.js';

class App {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.particleSystem = null;
        this.audioAnalyzer = null;
        this.model = null;
        
        this.settings = {
            colorMode: 'gradient',
            colorStart: '#ff0080',
            colorEnd: '#00d4ff',
            blendMode: 'normal',
            particleCount: 10000,
            particleSize: 0.02,
            reactivity: 1.0,
            attenuation: 0.95
        };

        this.stats = {
            fps: 0,
            frameCount: 0,
            lastTime: performance.now()
        };

        this.init();
        this.setupEventListeners();
        this.animate();
    }

    init() {
        // Scene setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0a0a);
        this.scene.fog = new THREE.FogExp2(0x0a0a0a, 0.05);

        // Camera setup
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.set(0, 2, 5);

        // Renderer setup
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: true 
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        document.getElementById('canvas-container').appendChild(this.renderer.domElement);

        // Controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxDistance = 20;
        this.controls.minDistance = 1;

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 5, 5);
        this.scene.add(directionalLight);

        // Initialize particle system
        this.particleSystem = new ParticleSystem(this.scene, this.settings);

        // Initialize audio analyzer
        this.audioAnalyzer = new AudioAnalyzer();

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());
    }

    setupEventListeners() {
        // Model upload
        document.getElementById('model-upload').addEventListener('change', (e) => {
            this.loadModel(e.target.files[0]);
        });

        // Audio upload
        document.getElementById('audio-upload').addEventListener('change', (e) => {
            this.loadAudio(e.target.files[0]);
        });

        // Color mode
        document.getElementById('color-mode').addEventListener('change', (e) => {
            this.settings.colorMode = e.target.value;
            this.updateGradientVisibility();
            this.particleSystem.updateColorMode(this.settings);
        });

        // Gradient colors
        document.getElementById('color-start').addEventListener('input', (e) => {
            this.settings.colorStart = e.target.value;
            this.particleSystem.updateGradientColors(this.settings.colorStart, this.settings.colorEnd);
        });

        document.getElementById('color-end').addEventListener('input', (e) => {
            this.settings.colorEnd = e.target.value;
            this.particleSystem.updateGradientColors(this.settings.colorStart, this.settings.colorEnd);
        });

        // Blend mode
        document.getElementById('blend-mode').addEventListener('change', (e) => {
            this.settings.blendMode = e.target.value;
            this.particleSystem.updateBlendMode(this.settings.blendMode);
        });

        // Particle count
        document.getElementById('particle-count').addEventListener('input', (e) => {
            this.settings.particleCount = parseInt(e.target.value);
            document.getElementById('particle-count-val').textContent = this.settings.particleCount;
            this.particleSystem.updateParticleCount(this.settings.particleCount);
        });

        // Particle size
        document.getElementById('particle-size').addEventListener('input', (e) => {
            this.settings.particleSize = parseFloat(e.target.value);
            document.getElementById('particle-size-val').textContent = this.settings.particleSize.toFixed(2);
            this.particleSystem.updateParticleSize(this.settings.particleSize);
        });

        // Reactivity
        document.getElementById('reactivity').addEventListener('input', (e) => {
            this.settings.reactivity = parseFloat(e.target.value);
            document.getElementById('reactivity-val').textContent = this.settings.reactivity.toFixed(1);
        });

        // Attenuation
        document.getElementById('attenuation').addEventListener('input', (e) => {
            this.settings.attenuation = parseFloat(e.target.value);
            document.getElementById('attenuation-val').textContent = this.settings.attenuation.toFixed(2);
        });

        // Play/Pause button
        document.getElementById('play-pause').addEventListener('click', () => {
            this.toggleAudio();
        });

        this.updateGradientVisibility();
    }

    updateGradientVisibility() {
        const gradientColors = document.getElementById('gradient-colors');
        gradientColors.style.display = this.settings.colorMode === 'gradient' ? 'block' : 'none';
    }

    async loadModel(file) {
        if (!file) return;

        const loader = new GLTFLoader();
        const url = URL.createObjectURL(file);

        try {
            const gltf = await new Promise((resolve, reject) => {
                loader.load(url, resolve, undefined, reject);
            });

            // Remove old model
            if (this.model) {
                this.scene.remove(this.model);
            }

            this.model = gltf.scene;
            
            // Center and scale the model
            const box = new THREE.Box3().setFromObject(this.model);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 2 / maxDim;
            
            this.model.position.sub(center);
            this.model.scale.multiplyScalar(scale);

            this.scene.add(this.model);

            // Update particle system with model
            this.particleSystem.setModel(this.model, this.settings);

            // Update UI
            document.getElementById('model-name').textContent = file.name;

            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error loading model:', error);
            alert('Error loading model. Please ensure it\'s a valid GLB/GLTF file.');
            URL.revokeObjectURL(url);
        }
    }

    async loadAudio(file) {
        if (!file) return;

        try {
            await this.audioAnalyzer.loadAudio(file);
            document.getElementById('play-pause').disabled = false;
            document.getElementById('play-pause').textContent = 'Play Audio';
        } catch (error) {
            console.error('Error loading audio:', error);
            alert('Error loading audio file.');
        }
    }

    toggleAudio() {
        const button = document.getElementById('play-pause');
        
        if (this.audioAnalyzer.isPlaying) {
            this.audioAnalyzer.pause();
            button.textContent = 'Play Audio';
        } else {
            this.audioAnalyzer.play();
            button.textContent = 'Pause Audio';
        }
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    updateStats() {
        this.stats.frameCount++;
        const currentTime = performance.now();
        const delta = currentTime - this.stats.lastTime;

        if (delta >= 1000) {
            this.stats.fps = Math.round((this.stats.frameCount * 1000) / delta);
            this.stats.frameCount = 0;
            this.stats.lastTime = currentTime;

            // Update UI
            document.getElementById('fps').textContent = this.stats.fps;
            document.getElementById('particle-total').textContent = this.particleSystem.getParticleCount();
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        // Get audio data
        let audioLevel = 0;
        let frequencyData = null;
        
        if (this.audioAnalyzer.isPlaying) {
            audioLevel = this.audioAnalyzer.getAverageFrequency();
            frequencyData = this.audioAnalyzer.getFrequencyData();
            
            // Update audio level display
            document.getElementById('audio-level').textContent = 
                Math.round(audioLevel).toString();
        }

        // Update particle system
        this.particleSystem.update(
            audioLevel,
            frequencyData,
            this.settings.reactivity,
            this.settings.attenuation
        );

        // Update controls
        this.controls.update();

        // Render
        this.renderer.render(this.scene, this.camera);

        // Update stats
        this.updateStats();
    }
}

// Start the application
new App();
