# Quick Start Guide

## Get Up and Running in 3 Steps

### 1. Install Dependencies
```bash
cd c4d-music-particles
npm install
```

### 2. Start Development Server
```bash
npm run dev
```

The app will open automatically in your browser at `http://localhost:3000`

### 3. Import and Play

1. **Import a GLB Model** (optional)
   - Click "Import GLB Model"
   - Select a `.glb` file
   - Particles will distribute around your model

2. **Import Audio**
   - Click "Import Audio"
   - Select any audio file (MP3, WAV, etc.)
   - Click "Play Audio"

3. **Experiment with Controls**
   - Try different color modes
   - Adjust reactivity to see particles pulse with the music
   - Change blend mode to additive for glowing effects

## Quick Controls Reference

| Control | What It Does |
|---------|-------------|
| **Color Mode** | Switch between custom gradients or model colors |
| **Blend Mode** | Normal (solid) or Additive (glowing) |
| **Particle Count** | More particles = more detail (but slower) |
| **Reactivity** | How much particles respond to music |
| **Attenuation** | How fast colors fade back to normal |

## Tips

- Start with **10,000 particles** for good balance
- Set **Reactivity to 1.5** for dramatic effects
- Try **Additive blend mode** with darker gradient colors
- Use **Model Color mode** after importing a colorful 3D model

## Camera Controls

- **Orbit**: Left-click + drag
- **Zoom**: Mouse wheel
- **Pan**: Right-click + drag

## Troubleshooting

**Can't hear audio?**
- Make sure browser volume is up
- Click anywhere on the page first (browsers require user interaction)

**Slow performance?**
- Reduce particle count to 5,000
- Use Normal blend mode instead of Additive

**Model won't load?**
- Make sure it's a `.glb` or `.gltf` file
- Try a smaller model first

---

**Need help?** Check the full README.md for detailed documentation!
