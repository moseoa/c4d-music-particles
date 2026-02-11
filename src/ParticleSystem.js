/* =====================================================================
   C4D-Style Particle System (Plexus / Node Based)
   - Sharp, distinct particles (Nodes)
   - Dynamic line connections (Edges)
   - Morphing between Scatter and Model states
   - Audio-reactive turbulence and connectivity
   ===================================================================== */

import * as THREE from "three";
import { createNoise3D } from "simplex-noise";

// Perlin noise instance
const noise3D = createNoise3D();

function computeCurl(x, y, z) {
  const eps = 0.0001;

  // Find rate of change in X
  const n1 = noise3D(x, y + eps, z);
  const n2 = noise3D(x, y - eps, z);
  const a = (n1 - n2) / (2 * eps);

  const n3 = noise3D(x, y, z + eps);
  const n4 = noise3D(x, y, z - eps);
  const b = (n3 - n4) / (2 * eps);

  // Find rate of change in Y
  const n5 = noise3D(x + eps, y, z);
  const n6 = noise3D(x - eps, y, z);
  const c = (n5 - n6) / (2 * eps);

  const n7 = noise3D(x, y, z + eps);
  const n8 = noise3D(x, y, z - eps);
  const d = (n7 - n8) / (2 * eps);

  // Find rate of change in Z
  const n9 = noise3D(x + eps, y, z);
  const n10 = noise3D(x - eps, y, z);
  const e = (n9 - n10) / (2 * eps);

  const n11 = noise3D(x, y + eps, z);
  const n12 = noise3D(x, y - eps, z);
  const f = (n11 - n12) / (2 * eps);

  // Curl
  return new THREE.Vector3(a - d, b - e, c - f); // Wait, standard curl is (Ry - Qz, Pz - Rx, Qx - Py)
  // Let's use a simpler approximation based on partials of 3 potential fields.
  // But for single noise field potential (0, 0, n) or similar, it's easier.
  // Actually, standard way is 3 noise fields (n1, n2, n3).
  // For performance, let's use the potential method with 3 cheap noise lookups or just 1.
}

// Better Curl Noise implementation using 3 noise values (potential field)
function curlNoise(p) {
  const e = 0.1;

  const dx = new THREE.Vector3(e, 0.0, 0.0);
  const dy = new THREE.Vector3(0.0, e, 0.0);
  const dz = new THREE.Vector3(0.0, 0.0, e);

  const p_x0 = noise3D(p.x - e, p.y, p.z);
  const p_x1 = noise3D(p.x + e, p.y, p.z);

  const p_y0 = noise3D(p.x, p.y - e, p.z);
  const p_y1 = noise3D(p.x, p.y + e, p.z);

  const p_z0 = noise3D(p.x, p.y, p.z - e);
  const p_z1 = noise3D(p.x, p.y, p.z + e);

  const x = p_y1 - p_y0 - (p_z1 - p_z0);
  const y = p_z1 - p_z0 - (p_x1 - p_x0);
  const z = p_x1 - p_x0 - (p_y1 - p_y0);

  const v = new THREE.Vector3(x, y, z);
  v.normalize();
  return v;
}

// ---------------------------------------------------------------------
// Shaders: Sharp Particles (Nodes)
// ---------------------------------------------------------------------

const vertexShader = /* glsl */ `
    uniform float uTime;
    uniform float uBaseSize;
    uniform float uAudioScale;
    
    attribute float aSize;
    attribute vec3 aColor;
    
    varying vec3 vColor;
    varying float vAlpha;

    void main() {
        vColor = aColor;
        
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        
        // Size with audio reactivity (sharp nodes don't need massive scaling)
        float sizeScale = uBaseSize * aSize * (1.0 + uAudioScale * 0.5);
        gl_PointSize = sizeScale * (300.0 / -mvPosition.z);
        
        // Distance attenuation for alpha
        vAlpha = clamp(1.0 - (-mvPosition.z / 40.0), 0.2, 1.0);
        
        gl_Position = projectionMatrix * mvPosition;
    }
`;

const fragmentShader = /* glsl */ `
    varying vec3 vColor;
    varying float vAlpha;

    void main() {
        // Soft Gaussian glow instead of sharp circle
        float r = 0.0;
        vec2 cxy = 2.0 * gl_PointCoord - 1.0;
        r = dot(cxy, cxy);
        
        if (r > 1.0) discard;
        
        // Soft falloff: (1-r^2)^2 or similar
        float strength = pow(1.0 - r, 3.0);
        
        gl_FragColor = vec4(vColor, strength * vAlpha);
    }
`;

export class ParticleSystem {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;

    // -----------------------------------------------------------------
    // Configuration
    // -----------------------------------------------------------------
    // Ultra-high density for botanical structures
    this.params = {
      count: 100000,
      baseSize: 0.05, // Micro-particles
      turbulence: 0.1,
      connectionDistance: 0, // Disabled
      maxConnections: 0, // Disabled
      autoMorph: false,
    };

    this.mouse = new THREE.Vector3(9999, 9999, 0); // Start off-screen

    // -----------------------------------------------------------------
    // Data Structures
    // -----------------------------------------------------------------
    this.particles = null;
    console.log("ParticleSystem constructor called");
    this.geometry = null;
    this.material = null;
    this.positions = null;
    this.colors = null;
    this.sizes = null;
    this.scatterPositions = null;
    this.modelPositions = null;
    this.modelColors = null;

    // Connection Lines
    this.linesMesh = null;
    this.linePositions = null;
    this.lineColors = null;

    // State
    this.morphTarget = 0; // 0 = scattered, 1 = model shape
    this.morphSpeed = 0.02;
    this.autoMorphOnBeat = true;
    this.morphDirection = -1; // 1 = towards model, -1 = towards scatter
    this.morphPauseFrames = 0;

    // Model data
    this.originalModelGeometry = null;

    this.init();
  }

  init() {
    this.createParticles();
  }

  createParticles() {
    console.log("Creating particles...", this.params.count);
    if (this.particles) {
      this.scene.remove(this.particles);
      this.geometry.dispose();
      this.material.dispose();
    }

    const { count } = this.params;

    this.geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(count * 3);
    this.colors = new Float32Array(count * 3);
    this.sizes = new Float32Array(count);
    this.scatterPositions = new Float32Array(count * 3);

    // Initial random positions (Scatter state)
    for (let i = 0; i < count * 3; i++) {
      const val = (Math.random() - 0.5) * 15;
      this.positions[i] = val;
      this.scatterPositions[i] = val;
    }

    // Complex Palette (Gold, Teal, Purple, Pink, White)
    const palette = [
      new THREE.Color("#FFD700"), // Gold
      new THREE.Color("#00fffbff"), // Teal
      new THREE.Color("#9D00FF"), // Purple
      new THREE.Color("#FF0066"), // Pink
      new THREE.Color("#FFFFFF"), // White
    ];

    for (let i = 0; i < count; i++) {
      // Pick random color from palette
      const color = palette[Math.floor(Math.random() * palette.length)];

      // Add slight variation
      this.colors[i * 3 + 0] = color.r + (Math.random() - 0.5) * 0.1;
      this.colors[i * 3 + 1] = color.g + (Math.random() - 0.5) * 0.1;
      this.colors[i * 3 + 2] = color.b + (Math.random() - 0.5) * 0.1;

      this.sizes[i] = 0.3 + Math.random() * 0.7;
    }

    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.positions, 3),
    );
    this.geometry.setAttribute(
      "aColor",
      new THREE.BufferAttribute(this.colors, 3),
    );
    this.geometry.setAttribute(
      "aSize",
      new THREE.BufferAttribute(this.sizes, 1),
    );

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uBaseSize: { value: this.params.baseSize },
        uAudioScale: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      // Additive blending for luminous glow
      blending: THREE.AdditiveBlending,
    });

    this.particles = new THREE.Points(this.geometry, this.material);
    this.scene.add(this.particles);
  }

  setModel(model) {
    if (!model) {
      this.modelPositions = null;
      this.morphTarget = 0;
      this.morphDirection = -1;
      return;
    }

    // Collect all vertices
    const vertices = [];
    model.traverse((child) => {
      if (child.isMesh) {
        const posAttr = child.geometry.attributes.position;
        if (posAttr) {
          const worldMatrix = child.matrixWorld;
          for (let i = 0; i < posAttr.count; i++) {
            const v = new THREE.Vector3();
            v.fromBufferAttribute(posAttr, i);
            v.applyMatrix4(worldMatrix);
            vertices.push(v);
          }
        }
      }
    });

    if (vertices.length > 0) {
      this.modelPositions = new Float32Array(this.params.count * 3);

      // Sample points from mesh vertices to match our particle count
      for (let i = 0; i < this.params.count; i++) {
        // Randomly sample vertices
        const v = vertices[Math.floor(Math.random() * vertices.length)];
        // Add slight jitter to prevent stacking
        this.modelPositions[i * 3] = v.x + (Math.random() - 0.5) * 0.05;
        this.modelPositions[i * 3 + 1] = v.y + (Math.random() - 0.5) * 0.05;
        this.modelPositions[i * 3 + 2] = v.z + (Math.random() - 0.5) * 0.05;
      }

      this.morphTarget = 0.01;
      this.morphDirection = 1; // Start morphing to model

      // Color based on height (Y axis) for the flower look
      // Find min/max Y
      let minY = Infinity,
        maxY = -Infinity;
      for (let i = 0; i < this.params.count; i++) {
        const y = this.modelPositions[i * 3 + 1];
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }

      const heightRange = maxY - minY || 1;

      // Apply colors
      for (let i = 0; i < this.params.count; i++) {
        const y = this.modelPositions[i * 3 + 1];
        const nY = (y - minY) / heightRange; // 0..1

        let r, g, b;

        if (nY > 0.6) {
          // Top (Petals) - Purple/Pink
          r = 0.8 + Math.random() * 0.2;
          g = 0.0 + Math.random() * 0.2;
          b = 0.8 + Math.random() * 0.2;
        } else if (nY > 0.3) {
          // Middle (Transition) - Gold/Teal mix
          r = 0.0 + Math.random() * 0.5;
          g = 0.8 + Math.random() * 0.2;
          b = 0.8 + Math.random() * 0.2;
        } else {
          // Bottom (Stem) - Gold/Yellow
          r = 1.0;
          g = 0.8 + Math.random() * 0.2;
          b = 0.0 + Math.random() * 0.2;
        }

        // Mix with existing current color for smooth transition?
        // For now, hard set target colors or just let them be.
        // Since we want to replicate the reference, let's set them.
        this.colors[i * 3] = r;
        this.colors[i * 3 + 1] = g;
        this.colors[i * 3 + 2] = b;
      }
      this.geometry.attributes.aColor.needsUpdate = true;
    }
  }

  toggleMorph() {
    if (this.morphTarget >= 0.5) {
      this.morphDirection = -1; // Scatter
    } else {
      this.morphDirection = 1; // Form
    }
  }

  setMorphSpeed(speed) {
    this.params.morphSpeed = speed;
  }

  setAutoMorphOnBeat(enabled) {
    this.params.autoMorph = enabled;
  }

  // API wrappers to match existing main.js calls
  updateGradientColors(c1, c2) {
    // Simplified: we just tint the shader or vertices
    const count = this.params.count;
    const color1 = new THREE.Color(c1);
    const color2 = new THREE.Color(c2);

    for (let i = 0; i < count; i++) {
      const mix = Math.random();
      this.colors[i * 3] = THREE.MathUtils.lerp(color1.r, color2.r, mix);
      this.colors[i * 3 + 1] = THREE.MathUtils.lerp(color1.g, color2.g, mix);
      this.colors[i * 3 + 2] = THREE.MathUtils.lerp(color1.b, color2.b, mix);
    }
    this.geometry.attributes.aColor.needsUpdate = true;
  }

  updateBlendMode(mode) {
    if (!this.material) return;
    this.material.blending =
      mode === "additive" ? THREE.AdditiveBlending : THREE.NormalBlending;
    this.material.needsUpdate = true;
  }

  updateParticleCount(c) {
    if (c !== this.params.count) {
      this.params.count = c;
      this.init();
    }
  }

  updateParticleSize(s) {
    // Map UI size 0..1 to reasonable base size 0.05..0.5
    this.params.baseSize = 0.05 + s * 0.4;
    if (this.material)
      this.material.uniforms.uBaseSize.value = this.params.baseSize;
  }

  setMorphSpeed(s) {
    this.morphSpeed = s;
  }
  setTurbulence(t) {
    /* handled in update */
  }
  toggleMorph() {
    this.morphDirection *= -1;
  }
  setAutoMorphOnBeat(b) {
    this.autoMorphOnBeat = b;
  }

  update(audioData) {
    const time = performance.now() * 0.001;
    if (this.material) this.material.uniforms.uTime.value = time;

    // Audio levels
    const bass = audioData.bass || 0;

    // Morph Update Logic
    if (this.morphDirection !== 0) {
      this.morphTarget += this.morphDirection * this.params.morphSpeed; // Use setting
      if (this.morphTarget >= 1) {
        this.morphTarget = 1;
        this.morphDirection = 0;
      } else if (this.morphTarget <= 0) {
        this.morphTarget = 0;
        this.morphDirection = 0;
      }
    }
    // Auto morph on beat
    if (this.params.autoMorph && audioData.isBeat && this.morphTarget < 0.1) {
      this.toggleMorph();
    } else if (
      this.params.autoMorph &&
      this.morphTarget > 0.9 &&
      Math.random() < 0.01
    ) {
      this.toggleMorph();
    }
    const mid = audioData.mid || 0;
    const treble = audioData.treble || 0;
    const beat = audioData.beat || false;

    if (this.material) this.material.uniforms.uAudioScale.value = bass;

    // -----------------------------------------------------------------
    // Morph Layout Handling
    // -----------------------------------------------------------------
    if (this.autoMorphOnBeat && beat && this.morphPauseFrames <= 0) {
      // Toggle morph direction on strong beats occasionally
      if (Math.random() > 0.7) {
        this.morphDirection *= -1;
        this.morphPauseFrames = 60;
      }
    }
    if (this.morphPauseFrames > 0) this.morphPauseFrames--;

    // Update morph target factor
    if (this.modelPositions) {
      this.morphTarget += this.morphDirection * this.morphSpeed;
      this.morphTarget = THREE.MathUtils.clamp(this.morphTarget, 0, 1);
    } else {
      this.morphTarget = 0;
    }

    const positions = this.geometry.attributes.position.array;
    const count = this.params.count;

    // Movement Parameters
    const noiseScale = 0.5;
    const noiseSpeed = 0.1;
    const turbulence = 0.02 + treble * 0.08; // Audio drives turbulence

    // Smooth factor for lerp
    const lerpFactor = 0.05;

    // -----------------------------------------------------------------
    // Particle Physics Loop
    // -----------------------------------------------------------------
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;

      // Target Position Interpolation
      let tx, ty, tz;
      if (this.modelPositions) {
        tx = THREE.MathUtils.lerp(
          this.scatterPositions[i3],
          this.modelPositions[i3],
          this.morphTarget,
        );
        ty = THREE.MathUtils.lerp(
          this.scatterPositions[i3 + 1],
          this.modelPositions[i3 + 1],
          this.morphTarget,
        );
        tz = THREE.MathUtils.lerp(
          this.scatterPositions[i3 + 2],
          this.modelPositions[i3 + 2],
          this.morphTarget,
        );
      } else {
        tx = this.scatterPositions[i3];
        ty = this.scatterPositions[i3 + 1];
        tz = this.scatterPositions[i3 + 2];
      }

      // Noise / Turbulence
      // Using simplex noise for organic movement
      // ---- Curl Noise (Fluid Motion) ----
      // We use the position as input to get a divergence-free velocity vector
      const scale = 0.08;
      const speed = 0.15;
      const timeOffset = time * speed;

      const curl = curlNoise(
        new THREE.Vector3(
          positions[i3] * scale,
          positions[i3 + 1] * scale,
          positions[i3 + 2] * scale + timeOffset,
        ),
      );

      const fluidFactor = 0.4 * turbulence;

      // ---- Mouse Interaction (Repulsor) ----
      // Project mouse to 3D roughly (assuming z=0 plane for interaction)
      // For accurate 3D picking we'd need raycaster, but simple 2D proximity is often enough for "screen space" feel
      const dx = positions[i3] - this.mouse.x;
      const dy = positions[i3 + 1] - this.mouse.y;
      // const dz = positions[i3+2] - this.mouse.z; // Mouse is 2D, let's assume cylinder or sphere influence?
      // Let's assume cylinder influence along Z for simplicity
      // Or just screen space distance
      const distSq = dx * dx + dy * dy;

      let mouseForceX = 0,
        mouseForceY = 0,
        mouseForceZ = 0;

      if (distSq < 16.0) {
        // Radius 4
        const dist = Math.sqrt(distSq);
        const force = (4.0 - dist) * 0.1; // Repel strength
        mouseForceX = (dx / dist) * force;
        mouseForceY = (dy / dist) * force;
        // Z push too?
        mouseForceZ = (Math.random() - 0.5) * force;
      }

      // Apply Forces (Target + Fluid + Mouse)
      const targetWeight = 0.05; // Strength of return to shape

      // ---- Breathing Effect (Botanical Pulse) ----
      const breathing = Math.sin(time * 0.8) * 0.05 + 1.0;

      positions[i3] = THREE.MathUtils.lerp(
        positions[i3],
        tx * breathing + curl.x * 5 * fluidFactor + mouseForceX * 10,
        targetWeight,
      );
      positions[i3 + 1] = THREE.MathUtils.lerp(
        positions[i3 + 1],
        ty * breathing + curl.y * 5 * fluidFactor + mouseForceY * 10,
        targetWeight,
      );
      positions[i3 + 2] = THREE.MathUtils.lerp(
        positions[i3 + 2],
        tz * breathing + curl.z * 5 * fluidFactor + mouseForceZ * 10,
        targetWeight,
      );
    }

    this.geometry.attributes.position.needsUpdate = true;

    // -----------------------------------------------------------------
    // Final position update
    // -----------------------------------------------------------------
    this.geometry.attributes.position.needsUpdate = true;
  }

  getParticleCount() {
    return this.params.count;
  }

  setMouse(x, y) {
    // Map normalized -1..1 to world units approx
    this.mouse.x = x * 15;
    this.mouse.y = y * 15;
  }

  getMorphState() {
    return this.morphTarget;
  }
}
