import * as THREE from 'three';

export class ParticleSystem {
    constructor(scene, settings) {
        this.scene = scene;
        this.settings = settings;
        this.particles = null;
        this.particlePositions = null;
        this.particleColors = null;
        this.particleVelocities = null;
        this.particleSizes = null;
        this.originalColors = null;
        this.model = null;
        this.modelColors = [];
        
        this.createParticles();
    }

    createParticles() {
        // Clean up old particles
        if (this.particles) {
            this.scene.remove(this.particles);
            if (this.particles.geometry) this.particles.geometry.dispose();
            if (this.particles.material) this.particles.material.dispose();
        }

        const count = this.settings.particleCount;

        // Geometry
        const geometry = new THREE.BufferGeometry();

        // Positions
        this.particlePositions = new Float32Array(count * 3);
        for (let i = 0; i < count * 3; i++) {
            this.particlePositions[i] = (Math.random() - 0.5) * 4;
        }
        geometry.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3));

        // Colors
        this.particleColors = new Float32Array(count * 3);
        this.originalColors = new Float32Array(count * 3);
        this.updateColorsFromSettings();
        geometry.setAttribute('color', new THREE.BufferAttribute(this.particleColors, 3));

        // Sizes
        this.particleSizes = new Float32Array(count);
        for (let i = 0; i < count; i++) {
            this.particleSizes[i] = this.settings.particleSize;
        }
        geometry.setAttribute('size', new THREE.BufferAttribute(this.particleSizes, 1));

        // Velocities for animation
        this.particleVelocities = new Float32Array(count * 3);
        for (let i = 0; i < count * 3; i++) {
            this.particleVelocities[i] = (Math.random() - 0.5) * 0.02;
        }

        // Material
        const material = new THREE.PointsMaterial({
            size: this.settings.particleSize,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            blending: this.settings.blendMode === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending,
            depthWrite: false,
            sizeAttenuation: true
        });

        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);
    }

    updateColorsFromSettings() {
        const count = this.settings.particleCount;
        const startColor = new THREE.Color(this.settings.colorStart);
        const endColor = new THREE.Color(this.settings.colorEnd);

        if (this.settings.colorMode === 'gradient') {
            // Create gradient colors
            for (let i = 0; i < count; i++) {
                const t = i / count;
                const color = new THREE.Color().lerpColors(startColor, endColor, t);
                
                this.originalColors[i * 3] = color.r;
                this.originalColors[i * 3 + 1] = color.g;
                this.originalColors[i * 3 + 2] = color.b;
                
                this.particleColors[i * 3] = color.r;
                this.particleColors[i * 3 + 1] = color.g;
                this.particleColors[i * 3 + 2] = color.b;
            }
        } else if (this.settings.colorMode === 'model' && this.modelColors.length > 0) {
            // Use model colors
            for (let i = 0; i < count; i++) {
                const colorIndex = Math.floor(Math.random() * this.modelColors.length);
                const color = this.modelColors[colorIndex];
                
                this.originalColors[i * 3] = color.r;
                this.originalColors[i * 3 + 1] = color.g;
                this.originalColors[i * 3 + 2] = color.b;
                
                this.particleColors[i * 3] = color.r;
                this.particleColors[i * 3 + 1] = color.g;
                this.particleColors[i * 3 + 2] = color.b;
            }
        }
    }

    setModel(model, settings) {
        this.model = model;
        this.modelColors = [];

        // Extract colors from model
        model.traverse((child) => {
            if (child.isMesh && child.material) {
                const material = child.material;
                
                if (Array.isArray(material)) {
                    material.forEach(mat => {
                        if (mat.color) {
                            this.modelColors.push(mat.color.clone());
                        }
                    });
                } else if (material.color) {
                    this.modelColors.push(material.color.clone());
                }
            }
        });

        // If no colors found, use default
        if (this.modelColors.length === 0) {
            this.modelColors.push(new THREE.Color(0xffffff));
        }

        // Distribute particles around model
        this.distributeParticlesAroundModel();

        // Update colors if in model color mode
        if (settings.colorMode === 'model') {
            this.updateColorsFromSettings();
            this.particles.geometry.attributes.color.needsUpdate = true;
        }
    }

    distributeParticlesAroundModel() {
        if (!this.model) return;

        const box = new THREE.Box3().setFromObject(this.model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);

        const count = this.settings.particleCount;
        
        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            
            // Create particles in a sphere around the model
            const radius = maxDim * (0.5 + Math.random() * 1.5);
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            
            this.particlePositions[i3] = center.x + radius * Math.sin(phi) * Math.cos(theta);
            this.particlePositions[i3 + 1] = center.y + radius * Math.sin(phi) * Math.sin(theta);
            this.particlePositions[i3 + 2] = center.z + radius * Math.cos(phi);
        }

        this.particles.geometry.attributes.position.needsUpdate = true;
    }

    updateColorMode(settings) {
        this.settings = settings;
        this.updateColorsFromSettings();
        this.particles.geometry.attributes.color.needsUpdate = true;
    }

    updateGradientColors(startColor, endColor) {
        this.settings.colorStart = startColor;
        this.settings.colorEnd = endColor;
        
        if (this.settings.colorMode === 'gradient') {
            this.updateColorsFromSettings();
            this.particles.geometry.attributes.color.needsUpdate = true;
        }
    }

    updateBlendMode(blendMode) {
        this.particles.material.blending = 
            blendMode === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending;
        this.particles.material.needsUpdate = true;
    }

    updateParticleCount(count) {
        this.settings.particleCount = count;
        this.createParticles();
        
        if (this.model) {
            this.distributeParticlesAroundModel();
        }
    }

    updateParticleSize(size) {
        this.settings.particleSize = size;
        this.particles.material.size = size;
        
        for (let i = 0; i < this.particleSizes.length; i++) {
            this.particleSizes[i] = size;
        }
        
        this.particles.geometry.attributes.size.needsUpdate = true;
    }

    update(audioLevel, frequencyData, reactivity, attenuation) {
        if (!this.particles) return;

        const positions = this.particles.geometry.attributes.position.array;
        const colors = this.particles.geometry.attributes.color.array;
        const sizes = this.particles.geometry.attributes.size.array;

        // Normalize audio level (0-255 to 0-1)
        const normalizedAudio = audioLevel / 255;
        const audioMultiplier = 1 + (normalizedAudio * reactivity);

        const count = this.settings.particleCount;

        for (let i = 0; i < count; i++) {
            const i3 = i * 3;

            // Update positions with velocity and audio reactivity
            positions[i3] += this.particleVelocities[i3] * audioMultiplier;
            positions[i3 + 1] += this.particleVelocities[i3 + 1] * audioMultiplier;
            positions[i3 + 2] += this.particleVelocities[i3 + 2] * audioMultiplier;

            // Boundary check - reset particles that go too far
            const distance = Math.sqrt(
                positions[i3] ** 2 + 
                positions[i3 + 1] ** 2 + 
                positions[i3 + 2] ** 2
            );

            if (distance > 10) {
                positions[i3] = (Math.random() - 0.5) * 4;
                positions[i3 + 1] = (Math.random() - 0.5) * 4;
                positions[i3 + 2] = (Math.random() - 0.5) * 4;
            }

            // Color attenuation with audio reactivity
            if (frequencyData) {
                const freqIndex = Math.floor((i / count) * frequencyData.length);
                const freqValue = frequencyData[freqIndex] / 255;
                const colorBoost = 1 + (freqValue * reactivity * 0.5);

                colors[i3] = this.originalColors[i3] * colorBoost;
                colors[i3 + 1] = this.originalColors[i3 + 1] * colorBoost;
                colors[i3 + 2] = this.originalColors[i3 + 2] * colorBoost;
            } else {
                // Attenuate back to original color
                colors[i3] = colors[i3] * attenuation + this.originalColors[i3] * (1 - attenuation);
                colors[i3 + 1] = colors[i3 + 1] * attenuation + this.originalColors[i3 + 1] * (1 - attenuation);
                colors[i3 + 2] = colors[i3 + 2] * attenuation + this.originalColors[i3 + 2] * (1 - attenuation);
            }

            // Size variation with audio
            sizes[i] = this.settings.particleSize * (1 + normalizedAudio * reactivity * 0.3);
        }

        // Update buffers
        this.particles.geometry.attributes.position.needsUpdate = true;
        this.particles.geometry.attributes.color.needsUpdate = true;
        this.particles.geometry.attributes.size.needsUpdate = true;

        // Rotate particle system slightly
        this.particles.rotation.y += 0.001 * (1 + normalizedAudio);
    }

    getParticleCount() {
        return this.settings.particleCount;
    }
}
