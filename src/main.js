import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ParticleSystem } from "./ParticleSystem.js";
import { AudioAnalyzer } from "./AudioAnalyzer.js";

class App {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.composer = null;
    this.bloomPass = null;
    this.particleSystem = null;
    this.audioAnalyzer = null;
    this.model = null;

    this.settings = {
      colorMode: "gradient",
      colorStart: "#ff0080",
      colorEnd: "#00d4ff",
      blendMode: "additive",
      particleCount: 15000,
      particleSize: 0.03,
      reactivity: 1.0,
      attenuation: 0.95,
      morphSpeed: 0.02,
      turbulence: 0.5,
      bloomIntensity: 0.15,
      bloomThreshold: 0.4,
      bloomRadius: 0.6,
    };

    this.stats = {
      fps: 0,
      frameCount: 0,
      lastTime: performance.now(),
    };

    this.init();
    this.setupEventListeners();
    this.animate();
  }

  init() {
    // ---- Scene ----
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050508);
    this.scene.fog = new THREE.FogExp2(0x050508, 0.035);

    // ---- Camera ----
    this.camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );
    this.camera.position.set(0, 1.5, 6);

    // ---- Renderer ----
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.9;
    document
      .getElementById("canvas-container")
      .appendChild(this.renderer.domElement);

    // ---- Post-processing ----
    this.composer = new EffectComposer(this.renderer);
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      this.settings.bloomIntensity,
      this.settings.bloomRadius,
      this.settings.bloomThreshold,
    );
    this.composer.addPass(this.bloomPass);

    // ---- Controls ----
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.maxDistance = 25;
    this.controls.minDistance = 1;
    this.controls.autoRotate = false;
    this.controls.autoRotateSpeed = 0.5;

    // ---- Lighting ----
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    this.scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0x00d4ff, 0.5, 20);
    pointLight.position.set(3, 4, 3);
    this.scene.add(pointLight);

    // ---- Systems ----
    this.particleSystem = new ParticleSystem(this.scene, this.settings);
    this.audioAnalyzer = new AudioAnalyzer();

    // ---- Resize ----
    window.addEventListener("resize", () => this.onWindowResize());
  }

  setupEventListeners() {
    // ---- File imports ----
    document.getElementById("model-upload").addEventListener("change", (e) => {
      this.loadModel(e.target.files[0]);
    });
    document.getElementById("audio-upload").addEventListener("change", (e) => {
      this.loadAudio(e.target.files[0]);
    });

    // ---- Color mode ----
    document.getElementById("color-mode").addEventListener("change", (e) => {
      this.settings.colorMode = e.target.value;
      this._updateGradientVisibility();
      this.particleSystem.updateColorMode(this.settings);
    });

    // ---- Gradient colors ----
    document.getElementById("color-start").addEventListener("input", (e) => {
      this.settings.colorStart = e.target.value;
      this.particleSystem.updateGradientColors(
        this.settings.colorStart,
        this.settings.colorEnd,
      );
    });
    document.getElementById("color-end").addEventListener("input", (e) => {
      this.settings.colorEnd = e.target.value;
      this.particleSystem.updateGradientColors(
        this.settings.colorStart,
        this.settings.colorEnd,
      );
    });

    // ---- Blend mode ----
    document.getElementById("blend-mode").addEventListener("change", (e) => {
      this.settings.blendMode = e.target.value;
      this.particleSystem.updateBlendMode(this.settings.blendMode);
    });

    // ---- Sliders ----
    this._slider("particle-count", (v) => {
      this.settings.particleCount = parseInt(v);
      this.particleSystem.updateParticleCount(this.settings.particleCount);
    });
    this._slider(
      "particle-size",
      (v) => {
        this.settings.particleSize = parseFloat(v);
        this.particleSystem.updateParticleSize(this.settings.particleSize);
      },
      2,
    );
    this._slider(
      "reactivity",
      (v) => {
        this.settings.reactivity = parseFloat(v);
      },
      1,
    );
    this._slider(
      "attenuation",
      (v) => {
        this.settings.attenuation = parseFloat(v);
      },
      2,
    );
    this._slider(
      "morph-speed",
      (v) => {
        this.settings.morphSpeed = parseFloat(v);
        this.particleSystem.setMorphSpeed(this.settings.morphSpeed);
      },
      3,
    );
    this._slider(
      "turbulence",
      (v) => {
        this.settings.turbulence = parseFloat(v);
      },
      2,
    );
    this._slider(
      "bloom-intensity",
      (v) => {
        this.settings.bloomIntensity = parseFloat(v);
        this.bloomPass.strength = this.settings.bloomIntensity;
      },
      1,
    );

    // ---- Morph toggle ----
    document.getElementById("morph-toggle").addEventListener("click", () => {
      this.particleSystem.toggleMorph();
      const btn = document.getElementById("morph-toggle");
      btn.textContent = btn.textContent.includes("Model")
        ? "🌿 Scatter Particles"
        : "🌸 Morph to Model";
    });

    // ---- Auto morph on beat ----
    document.getElementById("auto-morph").addEventListener("change", (e) => {
      this.particleSystem.setAutoMorphOnBeat(e.target.checked);
    });

    // ---- Play / Pause ----
    document.getElementById("play-pause").addEventListener("click", () => {
      this.toggleAudio();
    });

    this._updateGradientVisibility();
  }

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                            */
  /* ------------------------------------------------------------------ */

  _slider(id, callback, decimals = 0) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", (e) => {
      const val = e.target.value;
      const display = document.getElementById(id + "-val");
      if (display) {
        display.textContent =
          decimals > 0 ? parseFloat(val).toFixed(decimals) : val;
      }
      callback(val);
    });
  }

  _updateGradientVisibility() {
    const el = document.getElementById("gradient-colors");
    if (el)
      el.style.display =
        this.settings.colorMode === "gradient" ? "block" : "none";
  }

  /* ------------------------------------------------------------------ */
  /*  Model & Audio loading                                              */
  /* ------------------------------------------------------------------ */

  async loadModel(file) {
    if (!file) return;

    const loader = new GLTFLoader();
    const url = URL.createObjectURL(file);

    try {
      const gltf = await new Promise((resolve, reject) => {
        loader.load(url, resolve, undefined, reject);
      });

      if (this.model) this.scene.remove(this.model);

      this.model = gltf.scene;

      // Center and scale
      const box = new THREE.Box3().setFromObject(this.model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 2.5 / maxDim;

      this.model.position.sub(center);
      this.model.scale.multiplyScalar(scale);

      // Make the model invisible — we only want its shape for particles
      this.model.traverse((child) => {
        if (child.isMesh) {
          child.material.transparent = true;
          child.material.opacity = 0;
        }
      });

      this.scene.add(this.model);
      this.model.updateMatrixWorld(true);

      // Feed to particle system
      this.particleSystem.setModel(this.model, this.settings);

      // Update UI
      document.getElementById("model-name").textContent = file.name;
      document.getElementById("morph-toggle").disabled = false;

      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error loading model:", error);
      alert("Error loading model. Please ensure it's a valid GLB/GLTF file.");
      URL.revokeObjectURL(url);
    }
  }

  async loadAudio(file) {
    if (!file) return;
    try {
      await this.audioAnalyzer.loadAudio(file);
      document.getElementById("play-pause").disabled = false;
      document.getElementById("play-pause").textContent = "▶  Play Audio";
    } catch (error) {
      console.error("Error loading audio:", error);
      alert("Error loading audio file.");
    }
  }

  toggleAudio() {
    const btn = document.getElementById("play-pause");
    if (this.audioAnalyzer.isPlaying) {
      this.audioAnalyzer.pause();
      btn.textContent = "▶  Play Audio";
    } else {
      this.audioAnalyzer.play();
      btn.textContent = "⏸  Pause Audio";
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Resize                                                             */
  /* ------------------------------------------------------------------ */

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);
  }

  /* ------------------------------------------------------------------ */
  /*  Stats                                                              */
  /* ------------------------------------------------------------------ */

  updateStats() {
    this.stats.frameCount++;
    const now = performance.now();
    const delta = now - this.stats.lastTime;

    if (delta >= 1000) {
      this.stats.fps = Math.round((this.stats.frameCount * 1000) / delta);
      this.stats.frameCount = 0;
      this.stats.lastTime = now;

      document.getElementById("fps").textContent = this.stats.fps;
      document.getElementById("particle-total").textContent =
        this.particleSystem.getParticleCount();
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Animation loop                                                     */
  /* ------------------------------------------------------------------ */

  animate() {
    requestAnimationFrame(() => this.animate());

    // ---- Audio analysis ----
    this.audioAnalyzer.update();

    let audioLevel = 0;
    let frequencyData = null;

    if (this.audioAnalyzer.isPlaying) {
      audioLevel = this.audioAnalyzer.getAverageFrequency();
      frequencyData = this.audioAnalyzer.getFrequencyData();

      // Update stat displays
      const setBar = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = Math.round(value * 100) + "%";
      };
      setBar("bass-level", this.audioAnalyzer.bass);
      setBar("mid-level", this.audioAnalyzer.mid);
      setBar("treble-level", this.audioAnalyzer.treble);

      const audioEl = document.getElementById("audio-level");
      if (audioEl) audioEl.textContent = Math.round(audioLevel);

      // Beat indicator
      const beatEl = document.getElementById("beat-indicator");
      if (beatEl) {
        beatEl.style.opacity = this.audioAnalyzer.isBeat ? "1" : "0.15";
      }
    }

    // ---- Update particles ----
    this.particleSystem.update({
      audioLevel,
      frequencyData,
      bass: this.audioAnalyzer.bass,
      mid: this.audioAnalyzer.mid,
      treble: this.audioAnalyzer.treble,
      isBeat: this.audioAnalyzer.isBeat,
      reactivity: this.settings.reactivity,
      attenuation: this.settings.attenuation,
      turbulence: this.settings.turbulence,
      bloomIntensity: this.settings.bloomIntensity,
    });

    // ---- Morph state display ----
    const morphEl = document.getElementById("morph-state");
    if (morphEl) {
      const state = this.particleSystem.getMorphState();
      morphEl.textContent = state > 0.5 ? "Formed" : "Scattered";
    }

    // ---- Controls ----
    this.controls.update();

    // ---- Render with post-processing ----
    this.composer.render();

    // ---- Stats ----
    this.updateStats();
  }
}

// Start the application
new App();
