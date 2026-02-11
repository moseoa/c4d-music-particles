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
    }

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
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        // Create audio element
        this.audioElement = new Audio();
        this.audioElement.src = URL.createObjectURL(file);
        this.audioElement.crossOrigin = "anonymous";
        this.audioElement.loop = true;

        // Wait for audio to be ready
        await new Promise((resolve, reject) => {
            this.audioElement.addEventListener('canplaythrough', resolve, { once: true });
            this.audioElement.addEventListener('error', reject, { once: true });
        });

        // Create analyser
        if (!this.analyser) {
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            this.analyser.smoothingTimeConstant = 0.8;
            
            this.bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(this.bufferLength);

            // Create gain node for volume control
            this.gainNode = this.audioContext.createGain();
            this.gainNode.gain.value = 1.0;
        }

        // Create source and connect
        this.source = this.audioContext.createMediaElementSource(this.audioElement);
        this.source.connect(this.analyser);
        this.analyser.connect(this.gainNode);
        this.gainNode.connect(this.audioContext.destination);
    }

    play() {
        if (!this.audioElement) return;

        // Resume audio context if suspended
        if (this.audioContext.state === 'suspended') {
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

    getFrequencyData() {
        if (!this.analyser || !this.isPlaying) return null;

        this.analyser.getByteFrequencyData(this.dataArray);
        return this.dataArray;
    }

    getAverageFrequency() {
        if (!this.analyser || !this.isPlaying) return 0;

        this.analyser.getByteFrequencyData(this.dataArray);
        
        let sum = 0;
        for (let i = 0; i < this.bufferLength; i++) {
            sum += this.dataArray[i];
        }
        
        return sum / this.bufferLength;
    }

    getBassFrequency() {
        if (!this.analyser || !this.isPlaying) return 0;

        this.analyser.getByteFrequencyData(this.dataArray);
        
        // Bass frequencies are typically in the first quarter of the spectrum
        const bassRange = Math.floor(this.bufferLength / 4);
        let sum = 0;
        
        for (let i = 0; i < bassRange; i++) {
            sum += this.dataArray[i];
        }
        
        return sum / bassRange;
    }

    getMidFrequency() {
        if (!this.analyser || !this.isPlaying) return 0;

        this.analyser.getByteFrequencyData(this.dataArray);
        
        // Mid frequencies
        const start = Math.floor(this.bufferLength / 4);
        const end = Math.floor(this.bufferLength * 3 / 4);
        let sum = 0;
        
        for (let i = start; i < end; i++) {
            sum += this.dataArray[i];
        }
        
        return sum / (end - start);
    }

    getTrebleFrequency() {
        if (!this.analyser || !this.isPlaying) return 0;

        this.analyser.getByteFrequencyData(this.dataArray);
        
        // Treble frequencies are in the last quarter
        const start = Math.floor(this.bufferLength * 3 / 4);
        let sum = 0;
        
        for (let i = start; i < this.bufferLength; i++) {
            sum += this.dataArray[i];
        }
        
        return sum / (this.bufferLength - start);
    }

    setVolume(volume) {
        if (this.gainNode) {
            this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
        }
    }
}
