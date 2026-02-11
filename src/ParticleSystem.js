import * as THREE from "three";

/* =====================================================================
   Simplex-style 3D noise (compact inline implementation)
   Used for organic turbulence without external dependencies.
   ===================================================================== */
const _p = new Uint8Array(512);
const _perm = new Uint8Array(512);
(function initNoise() {
  const p0 = [
    151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140,
    36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148, 247, 120,
    234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33,
    88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71,
    134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133,
    230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161,
    1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169, 200, 196, 135, 130,
    116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64, 52, 217, 226, 250,
    124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59, 227,
    47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213, 119, 248, 152, 2, 44,
    154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9, 129, 22, 39, 253, 19, 98,
    108, 110, 79, 113, 224, 232, 178, 185, 112, 104, 218, 246, 97, 228, 251, 34,
    242, 193, 238, 210, 144, 12, 191, 179, 162, 241, 81, 51, 145, 235, 249, 14,
    239, 107, 49, 192, 214, 31, 181, 199, 106, 157, 184, 84, 204, 176, 115, 121,
    50, 45, 127, 4, 150, 254, 138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243,
    141, 128, 195, 78, 66, 215, 61, 156, 180,
  ];
  for (let i = 0; i < 256; i++) {
    _p[i] = p0[i];
    _p[i + 256] = p0[i];
  }
  for (let i = 0; i < 512; i++) _perm[i] = _p[i] & 255;
})();

function _fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}
function _lerp(a, b, t) {
  return a + t * (b - a);
}
function _grad3(hash, x, y, z) {
  const h = hash & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

function noise3D(x, y, z) {
  const X = Math.floor(x) & 255,
    Y = Math.floor(y) & 255,
    Z = Math.floor(z) & 255;
  x -= Math.floor(x);
  y -= Math.floor(y);
  z -= Math.floor(z);
  const u = _fade(x),
    v = _fade(y),
    w = _fade(z);
  const A = _perm[X] + Y,
    AA = _perm[A] + Z,
    AB = _perm[A + 1] + Z;
  const B = _perm[X + 1] + Y,
    BA = _perm[B] + Z,
    BB = _perm[B + 1] + Z;
  return _lerp(
    _lerp(
      _lerp(_grad3(_perm[AA], x, y, z), _grad3(_perm[BA], x - 1, y, z), u),
      _lerp(
        _grad3(_perm[AB], x, y - 1, z),
        _grad3(_perm[BB], x - 1, y - 1, z),
        u,
      ),
      v,
    ),
    _lerp(
      _lerp(
        _grad3(_perm[AA + 1], x, y, z - 1),
        _grad3(_perm[BA + 1], x - 1, y, z - 1),
        u,
      ),
      _lerp(
        _grad3(_perm[AB + 1], x, y - 1, z - 1),
        _grad3(_perm[BB + 1], x - 1, y - 1, z - 1),
        u,
      ),
      v,
    ),
    w,
  );
}

/* =====================================================================
   Vertex & Fragment shaders
   ===================================================================== */

const vertexShader = /* glsl */ `
    attribute float aSize;
    attribute vec3  aOrigColor;
    attribute float aMorphFactor;
    attribute vec3  aTargetPosition;

    uniform float uTime;
    uniform float uAudioScale;
    uniform float uBaseSize;

    varying vec3 vColor;
    varying float vAlpha;

    void main() {
        vColor = aOrigColor;

        // Morph between current position and target (model) position
        vec3 morphed = mix(position, aTargetPosition, aMorphFactor);

        vec4 mvPosition = modelViewMatrix * vec4(morphed, 1.0);

        // Size with audio reactivity and distance attenuation
        float sizeScale = uBaseSize * aSize * uAudioScale;
        gl_PointSize = sizeScale * (200.0 / -mvPosition.z);

        // Slight alpha fade for distant particles
        vAlpha = clamp(1.0 - (-mvPosition.z / 25.0), 0.15, 1.0);

        gl_Position = projectionMatrix * mvPosition;
    }
`;

const fragmentShader = /* glsl */ `
    varying vec3 vColor;
    varying float vAlpha;

    void main() {
        // Soft circular sprite
        vec2 center = gl_PointCoord - vec2(0.5);
        float dist = length(center);
        if (dist > 0.5) discard;

        // Smooth falloff for soft edges
        float alpha = 1.0 - smoothstep(0.1, 0.5, dist);
        alpha *= vAlpha * 0.12;

        // Slightly desaturate towards edges for depth
        vec3 col = vColor * (0.9 + 0.1 * (1.0 - dist * 2.0));

        gl_FragColor = vec4(col, alpha);
    }
`;

/* =====================================================================
   ParticleSystem class
   ===================================================================== */

export class ParticleSystem {
  constructor(scene, settings) {
    this.scene = scene;
    this.settings = { ...settings };
    this.particles = null;
    this.geometry = null;
    this.material = null;

    // Arrays
    this.positions = null;
    this.scatterPositions = null; // random scattered positions
    this.targetPositions = null; // model vertex positions
    this.colors = null;
    this.originalColors = null;
    this.sizes = null;
    this.morphFactors = null;
    this.velocities = null;

    // Morph state
    this.morphTarget = 0; // 0 = scattered, 1 = model shape
    this.morphSpeed = 0.02;
    this.autoMorphOnBeat = true;
    this.morphDirection = -1; // 1 = towards model, -1 = towards scatter
    this.morphPauseFrames = 0;

    // Model data
    this.model = null;
    this.modelVertices = [];
    this.modelColors = [];
    this.modelTexture = null;
    this.modelUVs = [];

    // Time
    this.time = 0;

    this.createParticles();
  }

  /* ------------------------------------------------------------------ */
  /*  Particle creation                                                 */
  /* ------------------------------------------------------------------ */

  createParticles() {
    // Clean up old
    if (this.particles) {
      this.scene.remove(this.particles);
      if (this.geometry) this.geometry.dispose();
      if (this.material) this.material.dispose();
    }

    const count = this.settings.particleCount;

    this.geometry = new THREE.BufferGeometry();

    // ---- positions (scattered) ------------------------------------
    this.positions = new Float32Array(count * 3);
    this.scatterPositions = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) {
      const val = (Math.random() - 0.5) * 10;
      this.positions[i] = val;
      this.scatterPositions[i] = val;
    }
    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.positions, 3),
    );

    // ---- target positions (will be filled on model load) ----------
    this.targetPositions = new Float32Array(count * 3);
    this.targetPositions.set(this.positions); // default = same as scatter
    this.geometry.setAttribute(
      "aTargetPosition",
      new THREE.BufferAttribute(this.targetPositions, 3),
    );

    // ---- colors ---------------------------------------------------
    this.colors = new Float32Array(count * 3);
    this.originalColors = new Float32Array(count * 3);
    this._applyColors();
    this.geometry.setAttribute(
      "aOrigColor",
      new THREE.BufferAttribute(this.colors, 3),
    );

    // ---- sizes ----------------------------------------------------
    this.sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      this.sizes[i] = 0.7 + Math.random() * 0.6; // variation
    }
    this.geometry.setAttribute(
      "aSize",
      new THREE.BufferAttribute(this.sizes, 1),
    );

    // ---- morph factors --------------------------------------------
    this.morphFactors = new Float32Array(count);
    this.geometry.setAttribute(
      "aMorphFactor",
      new THREE.BufferAttribute(this.morphFactors, 1),
    );

    // ---- velocities (for turbulence, CPU side) --------------------
    this.velocities = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) {
      this.velocities[i] = (Math.random() - 0.5) * 0.008;
    }

    // ---- material -------------------------------------------------
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uAudioScale: { value: 1.0 },
        uBaseSize: { value: this.settings.particleSize * 100 },
      },
      transparent: true,
      depthWrite: false,
      blending:
        this.settings.blendMode === "additive"
          ? THREE.AdditiveBlending
          : THREE.NormalBlending,
    });

    this.particles = new THREE.Points(this.geometry, this.material);
    this.scene.add(this.particles);
  }

  /* ------------------------------------------------------------------ */
  /*  Color helpers                                                      */
  /* ------------------------------------------------------------------ */

  _applyColors() {
    const count = this.settings.particleCount;

    if (this.settings.colorMode === "gradient") {
      this._applyGradientColors();
    } else if (
      this.settings.colorMode === "model" &&
      this.modelColors.length > 0
    ) {
      this._applyModelColors();
    } else {
      this._applyGradientColors(); // fallback
    }

    // Store originals for attenuation
    this.originalColors.set(this.colors);
  }

  _applyGradientColors() {
    const count = this.settings.particleCount;
    const start = new THREE.Color(this.settings.colorStart);
    const end = new THREE.Color(this.settings.colorEnd);

    for (let i = 0; i < count; i++) {
      const t = i / count;
      const c = new THREE.Color().lerpColors(start, end, t);
      this.colors[i * 3] = c.r;
      this.colors[i * 3 + 1] = c.g;
      this.colors[i * 3 + 2] = c.b;
    }
  }

  _applyModelColors() {
    const count = this.settings.particleCount;

    if (this.modelTexture && this.modelUVs.length > 0) {
      // ---- Texture-based color sampling ----
      this._sampleTextureColors();
    } else if (this.modelColors.length > 0) {
      // ---- Flat material colors ----
      for (let i = 0; i < count; i++) {
        const ci = Math.floor(Math.random() * this.modelColors.length);
        const c = this.modelColors[ci];
        this.colors[i * 3] = c.r;
        this.colors[i * 3 + 1] = c.g;
        this.colors[i * 3 + 2] = c.b;
      }
    }
  }

  /**
   * Sample pixel colors from the model's texture at the UV coordinates
   * of each particle's target vertex.
   */
  _sampleTextureColors() {
    const count = this.settings.particleCount;
    const tex = this.modelTexture;

    if (!tex || !tex.image) {
      this._applyGradientColors();
      return;
    }

    // Draw the texture to a canvas so we can read pixels
    const canvas = document.createElement("canvas");
    const img = tex.image;
    canvas.width = img.width || 256;
    canvas.height = img.height || 256;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

    for (let i = 0; i < count; i++) {
      let u, v;
      if (i < this.modelUVs.length) {
        u = this.modelUVs[i * 2];
        v = this.modelUVs[i * 2 + 1];
      } else {
        // Wrap around if more particles than UVs
        const wi = i % (this.modelUVs.length / 2);
        u = this.modelUVs[wi * 2];
        v = this.modelUVs[wi * 2 + 1];
      }

      // UV → pixel coordinates (V is flipped in most textures)
      const px = Math.floor(u * (canvas.width - 1));
      const py = Math.floor((1 - v) * (canvas.height - 1));
      const idx = (py * canvas.width + px) * 4;

      this.colors[i * 3] = (imgData[idx] || 0) / 255;
      this.colors[i * 3 + 1] = (imgData[idx + 1] || 0) / 255;
      this.colors[i * 3 + 2] = (imgData[idx + 2] || 0) / 255;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Model loading                                                      */
  /* ------------------------------------------------------------------ */

  setModel(model, settings) {
    this.model = model;
    this.modelColors = [];
    this.modelVertices = [];
    this.modelUVs = [];
    this.modelTexture = null;

    // Traverse model and collect vertices, UVs, colors, textures
    model.traverse((child) => {
      if (!child.isMesh) return;

      const geom = child.geometry;
      const mat = child.material;

      // ---- Vertices ----
      const posAttr = geom.attributes.position;
      if (posAttr) {
        // Apply world matrix to get correct world positions
        const worldMatrix = child.matrixWorld;
        for (let i = 0; i < posAttr.count; i++) {
          const v = new THREE.Vector3(
            posAttr.getX(i),
            posAttr.getY(i),
            posAttr.getZ(i),
          );
          v.applyMatrix4(worldMatrix);
          this.modelVertices.push(v.x, v.y, v.z);
        }
      }

      // ---- UVs ----
      const uvAttr = geom.attributes.uv;
      if (uvAttr) {
        for (let i = 0; i < uvAttr.count; i++) {
          this.modelUVs.push(uvAttr.getX(i), uvAttr.getY(i));
        }
      }

      // ---- Texture (take the first one found) ----
      if (!this.modelTexture) {
        const materials = Array.isArray(mat) ? mat : [mat];
        for (const m of materials) {
          if (m.map && m.map.image) {
            this.modelTexture = m.map;
            break;
          }
        }
      }

      // ---- Material colors ----
      const materials = Array.isArray(mat) ? mat : [mat];
      for (const m of materials) {
        if (m.color) this.modelColors.push(m.color.clone());
      }
    });

    if (this.modelColors.length === 0) {
      this.modelColors.push(new THREE.Color(0xffffff));
    }

    // ---- Build target positions from collected vertices ----
    this._buildTargetPositions();

    // ---- Update colors if in model mode ----
    if (settings.colorMode === "model") {
      this._applyColors();
      this.originalColors.set(this.colors);
      this.geometry.attributes.aOrigColor.needsUpdate = true;
    }
  }

  _buildTargetPositions() {
    const count = this.settings.particleCount;
    const verts = this.modelVertices;

    if (verts.length === 0) return;

    const vertCount = verts.length / 3;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;

      // Sample a random vertex from the model (with slight jitter for natural look)
      const vi = Math.floor(Math.random() * vertCount);
      const jitter = 0.03;

      this.targetPositions[i3] = verts[vi * 3] + (Math.random() - 0.5) * jitter;
      this.targetPositions[i3 + 1] =
        verts[vi * 3 + 1] + (Math.random() - 0.5) * jitter;
      this.targetPositions[i3 + 2] =
        verts[vi * 3 + 2] + (Math.random() - 0.5) * jitter;
    }

    this.geometry.attributes.aTargetPosition.needsUpdate = true;
  }

  /* ------------------------------------------------------------------ */
  /*  Settings updates                                                   */
  /* ------------------------------------------------------------------ */

  updateColorMode(settings) {
    this.settings = { ...this.settings, ...settings };
    this._applyColors();
    this.originalColors.set(this.colors);
    this.geometry.attributes.aOrigColor.needsUpdate = true;
  }

  updateGradientColors(startColor, endColor) {
    this.settings.colorStart = startColor;
    this.settings.colorEnd = endColor;
    if (this.settings.colorMode === "gradient") {
      this._applyColors();
      this.originalColors.set(this.colors);
      this.geometry.attributes.aOrigColor.needsUpdate = true;
    }
  }

  updateBlendMode(blendMode) {
    this.settings.blendMode = blendMode;
    this.material.blending =
      blendMode === "additive" ? THREE.AdditiveBlending : THREE.NormalBlending;
    this.material.needsUpdate = true;
  }

  updateParticleCount(count) {
    this.settings.particleCount = count;
    this.createParticles();
    if (this.model) {
      this._buildTargetPositions();
    }
  }

  updateParticleSize(size) {
    this.settings.particleSize = size;
    this.material.uniforms.uBaseSize.value = size * 100;
  }

  setMorphSpeed(speed) {
    this.morphSpeed = speed;
  }

  setAutoMorphOnBeat(value) {
    this.autoMorphOnBeat = value;
  }

  toggleMorph() {
    this.morphDirection *= -1;
  }

  /* ------------------------------------------------------------------ */
  /*  Per-frame update                                                   */
  /* ------------------------------------------------------------------ */

  update(audioData) {
    if (!this.particles) return;

    const {
      audioLevel = 0,
      frequencyData = null,
      bass = 0,
      mid = 0,
      treble = 0,
      isBeat = false,
      reactivity = 1.0,
      attenuation = 0.95,
      turbulence = 0.5,
      bloomIntensity = 1.0,
    } = audioData;

    this.time += 0.016; // ~60fps

    const count = this.settings.particleCount;
    const positions = this.geometry.attributes.position.array;
    const colors = this.geometry.attributes.aOrigColor.array;
    const sizes = this.geometry.attributes.aSize.array;
    const morphs = this.geometry.attributes.aMorphFactor.array;

    const normalizedAudio = audioLevel / 255;

    // ---- Audio-reactive uniform ----
    this.material.uniforms.uAudioScale.value =
      1.0 + normalizedAudio * reactivity * 0.5;
    this.material.uniforms.uTime.value = this.time;

    // ---- Beat-triggered morph ----
    if (isBeat && this.autoMorphOnBeat && this.morphPauseFrames <= 0) {
      this.morphDirection *= -1;
      this.morphPauseFrames = 15; // prevent rapid toggling
    }
    if (this.morphPauseFrames > 0) this.morphPauseFrames--;

    // ---- Update each particle ----
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;

      // ---- Morph factor (smooth lerp towards target) ----
      const morphGoal = this.morphDirection > 0 ? 1.0 : 0.0;
      morphs[i] += (morphGoal - morphs[i]) * this.morphSpeed;

      // ---- Turbulence (Perlin noise-driven drift on scatter positions) ----
      const noiseScale = 0.4;
      const timeScale = 0.3;
      const turbulenceStrength = turbulence * (1.0 + treble * reactivity * 2.0);

      const nx =
        noise3D(
          this.scatterPositions[i3] * noiseScale + this.time * timeScale,
          this.scatterPositions[i3 + 1] * noiseScale,
          this.scatterPositions[i3 + 2] * noiseScale,
        ) *
        turbulenceStrength *
        0.01;
      const ny =
        noise3D(
          this.scatterPositions[i3] * noiseScale,
          this.scatterPositions[i3 + 1] * noiseScale + this.time * timeScale,
          this.scatterPositions[i3 + 2] * noiseScale,
        ) *
        turbulenceStrength *
        0.01;
      const nz =
        noise3D(
          this.scatterPositions[i3] * noiseScale,
          this.scatterPositions[i3 + 1] * noiseScale,
          this.scatterPositions[i3 + 2] * noiseScale + this.time * timeScale,
        ) *
        turbulenceStrength *
        0.01;

      // Apply turbulence + velocity drift to scatter positions
      this.scatterPositions[i3] += this.velocities[i3] + nx;
      this.scatterPositions[i3 + 1] += this.velocities[i3 + 1] + ny;
      this.scatterPositions[i3 + 2] += this.velocities[i3 + 2] + nz;

      // Boundary — gently pull back if too far
      const dist = Math.sqrt(
        this.scatterPositions[i3] ** 2 +
          this.scatterPositions[i3 + 1] ** 2 +
          this.scatterPositions[i3 + 2] ** 2,
      );
      if (dist > 8) {
        const pull = 0.01;
        this.scatterPositions[i3] *= 1 - pull;
        this.scatterPositions[i3 + 1] *= 1 - pull;
        this.scatterPositions[i3 + 2] *= 1 - pull;
      }

      // Write to position attribute (scatter side— morph blending done in shader)
      positions[i3] = this.scatterPositions[i3];
      positions[i3 + 1] = this.scatterPositions[i3 + 1];
      positions[i3 + 2] = this.scatterPositions[i3 + 2];

      // ---- Color attenuation with frequency reactivity ----
      if (frequencyData) {
        const freqIndex = Math.floor((i / count) * frequencyData.length);
        const freqValue = (frequencyData[freqIndex] || 0) / 255;

        // Mid frequencies drive color boost
        const colorBoost =
          1.0 + freqValue * reactivity * 0.6 + mid * reactivity * 0.4;
        colors[i3] = Math.min(this.originalColors[i3] * colorBoost, 1.5);
        colors[i3 + 1] = Math.min(
          this.originalColors[i3 + 1] * colorBoost,
          1.5,
        );
        colors[i3 + 2] = Math.min(
          this.originalColors[i3 + 2] * colorBoost,
          1.5,
        );
      } else {
        // Attenuate back
        colors[i3] =
          colors[i3] * attenuation +
          this.originalColors[i3] * (1 - attenuation);
        colors[i3 + 1] =
          colors[i3 + 1] * attenuation +
          this.originalColors[i3 + 1] * (1 - attenuation);
        colors[i3 + 2] =
          colors[i3 + 2] * attenuation +
          this.originalColors[i3 + 2] * (1 - attenuation);
      }

      // ---- Size: bass-reactive pulse ----
      const basePulse = 1.0 + bass * reactivity * 0.8;
      sizes[i] = (0.7 + Math.random() * 0.05) * basePulse;
    }

    // ---- Flag buffers for GPU upload ----
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.aOrigColor.needsUpdate = true;
    this.geometry.attributes.aSize.needsUpdate = true;
    this.geometry.attributes.aMorphFactor.needsUpdate = true;

    // ---- Slow global rotation ----
    this.particles.rotation.y += 0.0008 * (1 + normalizedAudio * 0.5);
  }

  getParticleCount() {
    return this.settings.particleCount;
  }

  getMorphState() {
    if (!this.morphFactors || this.morphFactors.length === 0) return 0;
    // Average morph factor across all particles
    let sum = 0;
    const len = Math.min(100, this.morphFactors.length); // sample first 100
    for (let i = 0; i < len; i++) sum += this.morphFactors[i];
    return sum / len;
  }
}
