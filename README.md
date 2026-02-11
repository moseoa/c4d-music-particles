# C4D Music Particle System

A Cinema 4D-style particle system with music synchronization built with Three.js and Web Audio API. Import custom GLB models and audio files. 

https://github.com/user-attachments/assets/c18241f1-9731-4c09-b119-56800872382d

## Features

- **Custom GLB Model Import** - Load your own 3D models
- **Music Synchronization** - Real-time audio analysis and particle reactivity
- **Flexible Color Modes**
  - Custom gradient colors
  - Inherit model's material colors
- **Blend Modes** - Normal and Additive blending
- **Real-time Controls**
  - Particle count (1,000 - 50,000)
  - Particle size
  - Music reactivity
  - Color attenuation speed
- **Performance Monitoring** - FPS counter and stats display

## Installation

### Prerequisites
- Node.js (v16 or higher)
- VSCode (recommended)

### Setup

1. **Navigate to the project directory:**
   ```bash
   cd c4d-music-particles
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open in browser:**
   The application will automatically open at `http://localhost:3000`

## Usage

### Importing Models

1. Click "Import GLB Model" button
2. Select a `.glb` or `.gltf` file from your computer
3. The model will be loaded and particles will distribute around it
4. The model's colors will be extracted for use in "Model Color" mode

### Importing Audio

1. Click "Import Audio" button
2. Select an audio file (MP3, WAV, OGG, etc.)
3. Click "Play Audio" to start playback
4. Particles will react to the music in real-time

### Controls

#### Color Settings
- **Color Mode**
  - *Custom Gradient*: Use custom gradient colors
  - *Model Color*: Use colors extracted from the imported 3D model
- **Gradient Start/End**: Choose gradient colors (only in Custom Gradient mode)
- **Blend Mode**
  - *Normal*: Standard blending
  - *Additive*: Bright, glowing particles with additive blending

#### Particle Settings
- **Particle Count**: Number of particles (1,000 - 50,000)
  - Lower counts = better performance
  - Higher counts = more detailed visualizations
- **Particle Size**: Size of individual particles (0.01 - 0.1)
- **Music Reactivity**: How strongly particles react to audio (0 - 3)
  - 0 = No reaction
  - 1 = Moderate reaction (default)
  - 3 = Extreme reaction
- **Attenuation Speed**: How quickly colors return to normal (0.8 - 0.99)
  - Lower = faster attenuation
  - Higher = slower, more sustained effects

### Camera Controls
- **Rotate**: Left-click and drag
- **Zoom**: Scroll wheel
- **Pan**: Right-click and drag

## Project Structure

```
c4d-music-particles/
├── index.html              # Main HTML file
├── package.json            # Project dependencies
├── vite.config.js         # Vite configuration
├── src/
│   ├── main.js            # Application entry point
│   ├── ParticleSystem.js  # Particle system logic
│   └── AudioAnalyzer.js   # Audio analysis and processing
├── models/                # Place sample GLB models here
└── audio/                 # Place sample audio files here
```

## Technical Details

### Technologies Used
- **Three.js** - 3D graphics library
- **Web Audio API** - Real-time audio analysis
- **Vite** - Fast development server and build tool
- **GLTFLoader** - For loading 3D models

### How It Works

1. **Audio Analysis**
   - Audio is processed using Web Audio API's AnalyserNode
   - FFT (Fast Fourier Transform) extracts frequency data
   - Frequency data is mapped to particle properties

2. **Particle System**
   - Particles are created as Three.js Points
   - Each particle has position, color, size, and velocity
   - Audio data influences all particle properties in real-time

3. **Color Modes**
   - *Gradient Mode*: Particles are colored along a gradient
   - *Model Mode*: Colors are sampled from the 3D model's materials

4. **Attenuation**
   - Colors gradually return to their original values
   - Attenuation speed controls the decay rate
   - Creates pulsing effects synchronized with music

## Performance Tips

- Start with lower particle counts (5,000-10,000) on slower hardware
- Additive blending is more GPU-intensive than normal blending
- Complex models with many materials may impact performance
- Close other browser tabs for best performance

## Browser Compatibility

- Chrome/Edge (recommended)
- Firefox
- Safari (limited Web Audio API support)

## Troubleshooting

**Audio not playing:**
- Ensure browser allows autoplay (may require user interaction)
- Check browser console for errors
- Try a different audio format

**Model not loading:**
- Ensure file is a valid GLB/GLTF format
- Check file isn't corrupted
- Try a smaller model first

**Poor performance:**
- Reduce particle count
- Use simpler 3D models
- Close other applications
- Try normal blend mode instead of additive

## Development

### Building for Production
```bash
npm run build
```

Output will be in the `dist/` directory.

### Preview Production Build
```bash
npm run preview
```

## Example Models & Audio

Place sample files in the respective directories:
- `models/` - GLB/GLTF files
- `audio/` - Audio files (MP3, WAV, etc.)

## License

MIT License - feel free to use and modify for your projects!

## Credits

Built with Three.js, Web Audio API, and Vite.
