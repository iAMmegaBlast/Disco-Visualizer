Japanese Disco Lightshow Visualizer (Three.js)

BEGINNER STEPS (copy exactly):

1) Install Node.js
   - Download from: https://nodejs.org/
   - Install the LTS version.

2) Open terminal in this project folder

3) Run:
   npm install

4) Run:
   npm run dev

5) Open the localhost URL shown in the terminal
   (usually something like http://localhost:5173)

6) Click "Load Audio"
   - Choose your music file (.mp3/.wav/etc.)

7) Click "Play"

Controls in the web app:
- Sliders: Master Intensity, Bloom Strength, Disco Energy, Laser Amount,
  Spotlight Brightness, EXTREME
- Toggles: Cinematic Mode, Club Mode, HUD meters
- Recording: Start Recording / Stop Recording

Recording details:
- "Start Recording" captures the visualizer canvas as WebM using MediaRecorder.
- "Stop Recording" automatically downloads the file.

OBS recording instructions:
1) Open OBS
2) Add Source -> Browser
3) URL: your local page (for example http://localhost:5173)
4) Set Width=1920 Height=1080
5) Start Recording in OBS
6) Click Play in the visualizer and record the full song

Notes:
- This visualizer is designed as a lighting director with musical states:
  INTRO -> GROOVE -> BUILD -> CLIMAX
- It uses Web Audio analysis (bass/mid/high/RMS/onset) with smoothing + AGC
  so brightness breathes and avoids constant white-out.
