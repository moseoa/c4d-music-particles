/**
 * AudioAnalyzer — Enhanced audio analysis with beat detection and frequency band separation
 * Bass/Mid/Treble are separated and smoothed for fluid animation driving.
 */
export class AudioAnalyzer {
  constructor() {
    this.audioContext = null;
    this.analyser = null;
    this.dataArray = null;
    this.bufferLength = null;
    this.source = null;
    this.audioElement = null;
    this.isPlaying = false;
    this.gainNode = null;

    // Smoothed frequency bands (0–1 range)
    this.bass = 0;
    this.mid = 0;
    this.treble = 0;

    // Beat detection
    this.beatThreshold = 0.45;
    this.beatDecay = 0.98;
    this.beatMinInterval = 200; // ms between beats
    this.lastBeatTime = 0;
    this.beatEnergy = 0;
    this.isBeat = false;

    // Energy history for adaptive threshold
    this.energyHistory = [];
    this.energyHistoryMax = 60; // ~1 s at 60 fps

    // Smoothing factor — higher = smoother
    this.smoothing = 0.82;
  }

  /* ------------------------------------------------------------------ */
  /*  Audio loading                                                      */
  /* ------------------------------------------------------------------ */

  async loadAudio(file) {
    // Clean up previous audio
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }

    // Create audio context if it doesn't exist
    if (!this.audioContext) {
      this.audioContext = new (
        window.AudioContext || window.webkitAudioContext
      )();
    }

    // Create audio element
    this.audioElement = new Audio();
    this.audioElement.src = URL.createObjectURL(file);
    this.audioElement.crossOrigin = "anonymous";
    this.audioElement.loop = true;

    // Wait for audio to be ready
    await new Promise((resolve, reject) => {
      this.audioElement.addEventListener("canplaythrough", resolve, {
        once: true,
      });
      this.audioElement.addEventListener("error", reject, { once: true });
    });

    // Create analyser (higher fftSize for finer frequency resolution)
    if (!this.analyser) {
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.75;

      this.bufferLength = this.analyser.frequencyBinCount; // 256 bins
      this.dataArray = new Uint8Array(this.bufferLength);

      // Gain node
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 1.0;
    }

    // Connect source → analyser → gain → destination
    this.source = this.audioContext.createMediaElementSource(this.audioElement);
    this.source.connect(this.analyser);
    this.analyser.connect(this.gainNode);
    this.gainNode.connect(this.audioContext.destination);
  }

  /* ------------------------------------------------------------------ */
  /*  Playback controls                                                  */
  /* ------------------------------------------------------------------ */

  play() {
    if (!this.audioElement) return;
    if (this.audioContext.state === "suspended") {
      this.audioContext.resume();
    }
    this.audioElement.play();
    this.isPlaying = true;
  }

  pause() {
    if (!this.audioElement) return;
    this.audioElement.pause();
    this.isPlaying = false;
  }

  setVolume(volume) {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Analysis — call once per frame                                     */
  /* ------------------------------------------------------------------ */

  /**
   * Main update — call every frame.
   * Computes smoothed bass/mid/treble, average level, and beat detection.
   */
  update() {
    if (!this.analyser || !this.isPlaying) {
      this.isBeat = false;
      return;
    }

    this.analyser.getByteFrequencyData(this.dataArray);

    // --- frequency band boundaries ----------------------------------
    // With 512 fftSize → 256 bins, sample rate ~44100
    // Each bin = sampleRate / fftSize ≈ 86 Hz
    // Bass  : bins 0–6   → 0 – ~520 Hz
    // Mid   : bins 7–40  → ~600 – ~3400 Hz
    // Treble: bins 41–128 → ~3500 – ~11000 Hz
    const bassEnd = 7;
    const midEnd = 41;
    const trebleEnd = Math.min(128, this.bufferLength);

    const rawBass = this._bandAverage(0, bassEnd);
    const rawMid = this._bandAverage(bassEnd, midEnd);
    const rawTreble = this._bandAverage(midEnd, trebleEnd);

    // Exponential smoothing
    const s = this.smoothing;
    this.bass = this.bass * s + rawBass * (1 - s);
    this.mid = this.mid * s + rawMid * (1 - s);
    this.treble = this.treble * s + rawTreble * (1 - s);

    // --- beat detection (based on bass energy) ----------------------
    this._detectBeat(rawBass);
  }

  /* ------------------------------------------------------------------ */
  /*  Getters (for backwards-compat and convenience)                     */
  /* ------------------------------------------------------------------ */

  getFrequencyData() {
    if (!this.analyser || !this.isPlaying) return null;
    // dataArray already populated by update()
    return this.dataArray;
  }

  getAverageFrequency() {
    if (!this.analyser || !this.isPlaying) return 0;
    let sum = 0;
    for (let i = 0; i < this.bufferLength; i++) {
      sum += this.dataArray[i];
    }
    return sum / this.bufferLength;
  }

  getBassFrequency() {
    return this.bass * 255;
  }
  getMidFrequency() {
    return this.mid * 255;
  }
  getTrebleFrequency() {
    return this.treble * 255;
  }

  /* ------------------------------------------------------------------ */
  /*  Internal helpers                                                   */
  /* ------------------------------------------------------------------ */

  /** Average a range of bins, normalized 0–1 */
  _bandAverage(start, end) {
    let sum = 0;
    for (let i = start; i < end; i++) {
      sum += this.dataArray[i];
    }
    return sum / (end - start) / 255;
  }

  /** Simple onset / beat detection on a normalized energy value */
  _detectBeat(energy) {
    // Update energy history
    this.energyHistory.push(energy);
    if (this.energyHistory.length > this.energyHistoryMax) {
      this.energyHistory.shift();
    }

    // Adaptive threshold = average recent energy * multiplier
    const avg =
      this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length;
    const adaptiveThreshold = Math.max(this.beatThreshold, avg * 1.4);

    const now = performance.now();
    if (
      energy > adaptiveThreshold &&
      energy > this.beatEnergy &&
      now - this.lastBeatTime > this.beatMinInterval
    ) {
      this.isBeat = true;
      this.lastBeatTime = now;
    } else {
      this.isBeat = false;
    }

    // Decay stored energy
    this.beatEnergy = energy * this.beatDecay;
  }
}
