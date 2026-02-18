import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

const app = document.getElementById('app');

const ui = {
  panel: document.getElementById('ui'),
  dropZone: document.getElementById('dropZone'),
  fileInput: document.getElementById('fileInput'),
  playBtn: document.getElementById('playBtn'),
  pauseBtn: document.getElementById('pauseBtn'),
  recordStartBtn: document.getElementById('recordStartBtn'),
  recordStopBtn: document.getElementById('recordStopBtn'),
  masterIntensity: document.getElementById('masterIntensity'),
  bloomStrength: document.getElementById('bloomStrength'),
  discoEnergy: document.getElementById('discoEnergy'),
  laserAmount: document.getElementById('laserAmount'),
  spotBrightness: document.getElementById('spotBrightness'),
  extreme: document.getElementById('extreme'),
  cinematicMode: document.getElementById('cinematicMode'),
  clubMode: document.getElementById('clubMode'),
  showHud: document.getElementById('showHud'),
  hud: document.getElementById('hud'),
  bassMeter: document.getElementById('bassMeter'),
  midMeter: document.getElementById('midMeter'),
  highMeter: document.getElementById('highMeter'),
  stateText: document.getElementById('stateText'),
  status: document.getElementById('status')
};

const config = {
  masterIntensity: 1.0,
  bloomStrength: 1.2,
  discoEnergy: 1.0,
  laserAmount: 0.9,
  spotlightBrightness: 1.0,
  extreme: 0.35,
  cinematicMode: true,
  clubMode: false,
  showHud: true
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x090612);
scene.fog = new THREE.Fog(0x11061f, 18, 65);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 8.4, 19);
camera.lookAt(0, 5, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
app.appendChild(renderer.domElement);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.95, 0.48, 0.62);
composer.addPass(bloomPass);

const chromaPass = new ShaderPass({
  uniforms: {
    tDiffuse: { value: null },
    amount: { value: 0.0 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float amount;
    varying vec2 vUv;
    void main() {
      vec2 shift = amount * vec2(0.003, 0.002);
      float r = texture2D(tDiffuse, vUv + shift).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - shift).b;
      gl_FragColor = vec4(r, g, b, 1.0);
    }
  `
});
composer.addPass(chromaPass);

const ambient = new THREE.AmbientLight(0x2f2038, 0.3);
scene.add(ambient);

const hazeGeo = new THREE.SphereGeometry(52, 32, 16);
const hazeMat = new THREE.MeshBasicMaterial({
  color: 0x531f77,
  transparent: true,
  opacity: 0.06,
  side: THREE.BackSide,
  depthWrite: false
});
const haze = new THREE.Mesh(hazeGeo, hazeMat);
scene.add(haze);

const BG_IMAGE_PATH = '/mnt/data/dancefloor_daimyo_bg_upscaled_1920x1080.png';
const textureLoader = new THREE.TextureLoader();
const bgTexture = textureLoader.load(
  BG_IMAGE_PATH,
  undefined,
  undefined,
  () => setStatus(`Background image not found at ${BG_IMAGE_PATH}. Please place it there.`)
);
bgTexture.colorSpace = THREE.SRGBColorSpace;
const bgPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(42, 23.625),
  new THREE.MeshBasicMaterial({ map: bgTexture, toneMapped: false, depthWrite: false, depthTest: false })
);
bgPlane.position.set(0, 8.8, -22);
bgPlane.renderOrder = -10;
scene.add(bgPlane);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(50, 36, 1, 1),
  new THREE.MeshPhysicalMaterial({
    color: 0x1d1024,
    metalness: 0.48,
    roughness: 0.3,
    clearcoat: 0.9,
    clearcoatRoughness: 0.2,
    emissive: 0x130717,
    emissiveIntensity: 0.18
  })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -1.15;
scene.add(floor);

const dotCount = 560;
const dotsGeo = new THREE.BufferGeometry();
const dotPositions = new Float32Array(dotCount * 3);
const dotColors = new Float32Array(dotCount * 3);
const dotSizes = new Float32Array(dotCount);
const dotTwinkles = new Float32Array(dotCount);

const dotBaseRadius = new Float32Array(dotCount);
const dotAngle = new Float32Array(dotCount);
const dotHeight = new Float32Array(dotCount);
const dotSeed = new Float32Array(dotCount);
const dotPop = new Float32Array(dotCount);
const dotCooldown = new Float32Array(dotCount);

for (let i = 0; i < dotCount; i++) {
  dotBaseRadius[i] = 1.5 + Math.pow(Math.random(), 0.72) * 13.5;
  dotAngle[i] = Math.random() * Math.PI * 2;
  dotHeight[i] = -1.1 + (Math.random() - 0.5) * 10.8;
  dotSeed[i] = Math.random();
  dotSizes[i] = 18 + Math.random() * 25;
  dotTwinkles[i] = 0.3;

  const warm = new THREE.Color().setHSL(0.12 + Math.random() * 0.08, 0.9, 0.58);
  const magenta = new THREE.Color().setHSL(0.86 + Math.random() * 0.06, 0.8, 0.54);
  const mix = 0.4 + Math.random() * 0.6;
  const color = warm.lerp(magenta, mix * 0.52);
  dotColors[i * 3 + 0] = color.r;
  dotColors[i * 3 + 1] = color.g;
  dotColors[i * 3 + 2] = color.b;
}

dotsGeo.setAttribute('position', new THREE.BufferAttribute(dotPositions, 3));
dotsGeo.setAttribute('aColor', new THREE.BufferAttribute(dotColors, 3));
dotsGeo.setAttribute('aSize', new THREE.BufferAttribute(dotSizes, 1));
dotsGeo.setAttribute('aTwinkle', new THREE.BufferAttribute(dotTwinkles, 1));

const dotsMat = new THREE.ShaderMaterial({
  uniforms: {
    uPixelRatio: { value: renderer.getPixelRatio() },
    uIntensity: { value: 1.0 }
  },
  vertexShader: `
    attribute vec3 aColor;
    attribute float aSize;
    attribute float aTwinkle;
    varying vec3 vColor;
    varying float vTwinkle;
    void main() {
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      gl_PointSize = aSize * uPixelRatio * (150.0 / -mvPosition.z);
      vColor = aColor;
      vTwinkle = aTwinkle;
    }
  `,
  fragmentShader: `
    uniform float uIntensity;
    varying vec3 vColor;
    varying float vTwinkle;
    void main() {
      vec2 p = gl_PointCoord - vec2(0.5);
      float d = length(p) * 2.0;
      float body = smoothstep(1.0, 0.0, d);
      float core = smoothstep(0.45, 0.0, d);
      float alpha = body * (0.18 + vTwinkle * 0.75);
      vec3 col = vColor * (0.55 + core * 0.8 + vTwinkle * 0.55) * uIntensity;
      gl_FragColor = vec4(col, alpha);
    }
  `,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending
});
const dotPoints = new THREE.Points(dotsGeo, dotsMat);
dotPoints.position.set(0, 6.4, -4.0);
scene.add(dotPoints);

const sparkMax = 1300;
const sparkGeo = new THREE.BufferGeometry();
const sparkPositions = new Float32Array(sparkMax * 3);
const sparkSizes = new Float32Array(sparkMax);
const sparkColors = new Float32Array(sparkMax * 3);
const sparkTwinkles = new Float32Array(sparkMax);
const sparkVel = new Float32Array(sparkMax * 3);
const sparkLife = new Float32Array(sparkMax);
let sparkWrite = 0;

sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
sparkGeo.setAttribute('aColor', new THREE.BufferAttribute(sparkColors, 3));
sparkGeo.setAttribute('aSize', new THREE.BufferAttribute(sparkSizes, 1));
sparkGeo.setAttribute('aTwinkle', new THREE.BufferAttribute(sparkTwinkles, 1));

const sparksMat = dotsMat.clone();
sparksMat.uniforms = {
  uPixelRatio: { value: renderer.getPixelRatio() },
  uIntensity: { value: 1.0 }
};
const sparks = new THREE.Points(sparkGeo, sparksMat);
sparks.position.copy(dotPoints.position);
scene.add(sparks);

const laserGroup = new THREE.Group();
scene.add(laserGroup);
const laserMax = 8;
const laserMeshes = [];
const laserSegments = Array.from({ length: laserMax }, () => ({
  active: false,
  a: new THREE.Vector2(),
  b: new THREE.Vector2(),
  intensity: 0
}));
const laserPalette = [0xff70c4, 0xffb35f, 0xdc6fff, 0xff9ea0, 0xff74ff, 0xf7bb63, 0xff63a7, 0xf79bf8];

for (let i = 0; i < laserMax; i++) {
  const mat = new THREE.MeshBasicMaterial({
    color: laserPalette[i],
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(18, 0.09), mat);
  mesh.position.set(0, 6, -6.2 + i * 0.02);
  laserGroup.add(mesh);
  laserMeshes.push(mesh);
}

const clock = new THREE.Clock();
const tempColor = new THREE.Color();
const tempVec2 = new THREE.Vector2();

let currentLaserMode = 0;
let laserModeTime = 0;
let laserModeDuration = 8;
let visualSyncStart = 0;
const LASER_MODES = ['fan', 'crisscross', 'triangle', 'wave'];

const audio = new Audio();
audio.crossOrigin = 'anonymous';
audio.loop = false;
audio.preload = 'auto';

let audioCtx = null;
let analyser = null;
let sourceNode = null;
let freqData = null;
let recorder = null;
let recordedChunks = [];
let currentAudioUrl = null;

const audioState = {
  bass: 0,
  mid: 0,
  high: 0,
  rms: 0,
  onset: 0,
  prevRms: 0,
  agc: 1,
  compressed: 0,
  smoothBass: 0,
  smoothMid: 0,
  smoothHigh: 0,
  smoothRms: 0,
  mode: { calm: 1, drive: 0, surge: 0 },
  modeDisplay: 'CALM'
};

let isFullscreen = false;
let lastMouseMoveMs = performance.now();
let uiHiddenForIdle = false;

function setStatus(text) {
  ui.status.textContent = text;
}

function setupAudioContext() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.7;
  freqData = new Uint8Array(analyser.frequencyBinCount);

  sourceNode = audioCtx.createMediaElementSource(audio);
  sourceNode.connect(analyser);
  analyser.connect(audioCtx.destination);
}

function isSupportedAudioFile(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  return ['mp3', 'wav', 'ogg', 'm4a'].includes(ext) || (file.type && file.type.startsWith('audio/'));
}

function resetVisualTiming() {
  visualSyncStart = clock.elapsedTime;
  laserModeTime = 0;
  laserModeDuration = 6 + Math.random() * 6;
}

function loadAudioFile(file) {
  if (!file) return;
  if (!isSupportedAudioFile(file)) {
    setStatus('Unsupported file format. Use mp3, wav, ogg, or m4a.');
    return;
  }

  try {
    setupAudioContext();
    if (currentAudioUrl) URL.revokeObjectURL(currentAudioUrl);
    currentAudioUrl = URL.createObjectURL(file);
    audio.pause();
    audio.src = currentAudioUrl;
    audio.load();
    ui.playBtn.disabled = false;
    setStatus(`Loaded ${file.name}`);
    setDropVisible(false);
    resetVisualTiming();
  } catch (err) {
    setStatus(`Load error: ${err.message}`);
  }
}

function bandEnergy(data, minHz, maxHz, sampleRate) {
  const nyquist = sampleRate / 2;
  const len = data.length;
  const i0 = Math.max(0, Math.floor((minHz / nyquist) * len));
  const i1 = Math.min(len - 1, Math.floor((maxHz / nyquist) * len));
  if (i1 <= i0) return 0;
  let sum = 0;
  for (let i = i0; i <= i1; i++) sum += data[i];
  return (sum / (i1 - i0 + 1)) / 255;
}

function analyzeAudio(dt) {
  if (!analyser || audio.paused) {
    const decay = 1 - Math.exp(-dt / 0.4);
    audioState.smoothBass += (0 - audioState.smoothBass) * decay;
    audioState.smoothMid += (0 - audioState.smoothMid) * decay;
    audioState.smoothHigh += (0 - audioState.smoothHigh) * decay;
    audioState.smoothRms += (0 - audioState.smoothRms) * decay;
    audioState.onset *= 0.88;
    return;
  }

  analyser.getByteFrequencyData(freqData);
  const sr = audioCtx.sampleRate;
  const bass = bandEnergy(freqData, 20, 180, sr);
  const mid = bandEnergy(freqData, 180, 2500, sr);
  const high = bandEnergy(freqData, 2500, 11000, sr);

  let rms = 0;
  for (let i = 0; i < freqData.length; i++) {
    const v = freqData[i] / 255;
    rms += v * v;
  }
  rms = Math.sqrt(rms / freqData.length);

  const rise = Math.max(0, rms - audioState.prevRms);
  audioState.prevRms = rms;
  audioState.onset = THREE.MathUtils.lerp(audioState.onset, Math.min(1, rise * 8.4 + high * 0.28), 0.22);

  const agcTarget = 0.42;
  const gainNow = THREE.MathUtils.clamp(agcTarget / Math.max(0.08, rms), 0.55, 1.9);
  audioState.agc = THREE.MathUtils.lerp(audioState.agc, gainNow, 0.1);
  const rmsAgc = THREE.MathUtils.clamp(rms * audioState.agc, 0, 2);
  audioState.compressed = rmsAgc / (rmsAgc + 0.8);

  const smoothA = 1 - Math.exp(-dt / 0.13);
  audioState.smoothBass += (bass - audioState.smoothBass) * smoothA;
  audioState.smoothMid += (mid - audioState.smoothMid) * smoothA;
  audioState.smoothHigh += (high - audioState.smoothHigh) * smoothA;
  audioState.smoothRms += (audioState.compressed - audioState.smoothRms) * (1 - Math.exp(-dt / 0.18));
}

function updateStateDirector(dt) {
  const calmTarget = THREE.MathUtils.clamp(1.0 - (audioState.smoothRms * 1.6 + audioState.smoothMid * 0.7), 0, 1);
  const driveTarget = THREE.MathUtils.clamp(audioState.smoothMid * 1.35 + audioState.smoothRms * 0.5, 0, 1);
  const surgeTarget = THREE.MathUtils.clamp(audioState.smoothBass * 1.2 + audioState.onset * 0.9, 0, 1);

  const blend = 1 - Math.exp(-dt / 0.22);
  audioState.mode.calm += (calmTarget - audioState.mode.calm) * blend;
  audioState.mode.drive += (driveTarget - audioState.mode.drive) * blend;
  audioState.mode.surge += (surgeTarget - audioState.mode.surge) * blend;

  const sum = audioState.mode.calm + audioState.mode.drive + audioState.mode.surge || 1;
  audioState.mode.calm /= sum;
  audioState.mode.drive /= sum;
  audioState.mode.surge /= sum;

  let modeName = 'CALM';
  if (audioState.mode.drive > audioState.mode.calm && audioState.mode.drive >= audioState.mode.surge) modeName = 'DRIVE';
  if (audioState.mode.surge > audioState.mode.drive && audioState.mode.surge > audioState.mode.calm) modeName = 'SURGE';
  audioState.modeDisplay = modeName;
  ui.stateText.textContent = `State: ${audioState.modeDisplay}`;
}

function distancePointToSegment(p, a, b) {
  tempVec2.copy(b).sub(a);
  const lenSq = Math.max(1e-6, tempVec2.lengthSq());
  const t = THREE.MathUtils.clamp(((p.x - a.x) * tempVec2.x + (p.y - a.y) * tempVec2.y) / lenSq, 0, 1);
  const px = a.x + tempVec2.x * t;
  const py = a.y + tempVec2.y * t;
  const dx = p.x - px;
  const dy = p.y - py;
  return Math.sqrt(dx * dx + dy * dy);
}

function emitSparkBurst(x, y, z, baseColor, amount) {
  for (let s = 0; s < amount; s++) {
    const idx = sparkWrite;
    sparkWrite = (sparkWrite + 1) % sparkMax;

    const ang = Math.random() * Math.PI * 2;
    const spd = 0.7 + Math.random() * 2.3;
    sparkPositions[idx * 3 + 0] = x;
    sparkPositions[idx * 3 + 1] = y;
    sparkPositions[idx * 3 + 2] = z;
    sparkVel[idx * 3 + 0] = Math.cos(ang) * spd;
    sparkVel[idx * 3 + 1] = Math.sin(ang) * spd;
    sparkVel[idx * 3 + 2] = (Math.random() - 0.5) * 0.5;
    sparkLife[idx] = 0.12 + Math.random() * 0.26;
    sparkSizes[idx] = 7 + Math.random() * 12;
    sparkTwinkles[idx] = 0.6 + Math.random() * 0.4;

    tempColor.copy(baseColor).offsetHSL((Math.random() - 0.5) * 0.04, 0.05, 0.08);
    sparkColors[idx * 3 + 0] = tempColor.r;
    sparkColors[idx * 3 + 1] = tempColor.g;
    sparkColors[idx * 3 + 2] = tempColor.b;
  }
}

function updateSwirlDots(dt, elapsed) {
  const bassPush = 0.65 + audioState.smoothBass * 1.05;
  const swirlSpeed = (0.18 + audioState.smoothMid * 1.85) * (0.7 + config.discoEnergy * 0.6);
  const highTwinkle = THREE.MathUtils.clamp(0.2 + audioState.smoothHigh * 1.2, 0.2, 1.25);
  const sizePulse = 1 + audioState.smoothHigh * 0.24 + audioState.onset * 0.12;

  for (let i = 0; i < dotCount; i++) {
    dotAngle[i] += dt * swirlSpeed * (0.52 + dotSeed[i] * 1.1);
    const wobble = 1 + 0.17 * Math.sin(elapsed * (0.4 + dotSeed[i] * 1.2) + dotSeed[i] * 12.0);
    const radius = dotBaseRadius[i] * bassPush * wobble + audioState.onset * (0.35 + dotSeed[i] * 1.2);

    const flowAngle = dotAngle[i] + Math.sin(elapsed * 0.28 + dotSeed[i] * 8.0) * 0.3;
    dotPositions[i * 3 + 0] = Math.cos(flowAngle) * radius;
    dotPositions[i * 3 + 1] = dotHeight[i] + Math.sin(flowAngle * 1.8 + elapsed * 0.6 + dotSeed[i] * 6.0) * 0.75;
    dotPositions[i * 3 + 2] = Math.sin(flowAngle * 0.72 + elapsed * 0.3) * 1.9;

    dotCooldown[i] = Math.max(0, dotCooldown[i] - dt);
    dotPop[i] = Math.max(0, dotPop[i] - dt * 4.8);

    dotTwinkles[i] = 0.25 + highTwinkle * (0.25 + 0.75 * Math.abs(Math.sin(elapsed * (4.5 + dotSeed[i] * 6.8) + dotSeed[i] * 18.0)));
    dotSizes[i] = (14 + dotBaseRadius[i] * 1.1) * sizePulse * (1 + dotPop[i] * 0.9);
  }

  dotsGeo.attributes.position.needsUpdate = true;
  dotsGeo.attributes.aSize.needsUpdate = true;
  dotsGeo.attributes.aTwinkle.needsUpdate = true;
  dotsMat.uniforms.uIntensity.value = 0.88 + audioState.smoothRms * 0.95;
}

function updateLasers(dt, elapsed) {
  laserModeTime += dt;
  if (laserModeTime >= laserModeDuration) {
    laserModeTime = 0;
    laserModeDuration = 6 + Math.random() * 6;
    currentLaserMode = (currentLaserMode + 1) % LASER_MODES.length;
  }

  const mode = LASER_MODES[currentLaserMode];
  const energy = audioState.smoothRms;
  const activeCount = THREE.MathUtils.clamp(Math.round(3 + audioState.smoothMid * 5 + energy * 1.5), 3, laserMax);
  const baseSpeed = 0.25 + audioState.smoothMid * 1.3 + config.extreme * 0.5;
  const baseLen = 14.5 + energy * 6.8;
  const onsetSnap = audioState.onset > 0.33 ? (Math.random() - 0.5) * 0.09 : 0;

  for (let i = 0; i < laserMax; i++) {
    const mesh = laserMeshes[i];
    const seg = laserSegments[i];

    if (i >= activeCount) {
      mesh.material.opacity = 0;
      seg.active = false;
      continue;
    }

    const n = activeCount <= 1 ? 0 : i / (activeCount - 1);
    let angle = 0;
    if (mode === 'fan') {
      const sweep = Math.sin((elapsed + i * 0.08) * (0.6 + baseSpeed)) * 0.65;
      angle = THREE.MathUtils.lerp(-0.95, 0.95, n) + sweep * 0.25;
    } else if (mode === 'crisscross') {
      const dir = i % 2 ? 1 : -1;
      angle = dir * (0.42 + 0.43 * Math.sin(elapsed * (0.8 + baseSpeed * 0.7) + n * 8.0));
    } else if (mode === 'triangle') {
      const triCorner = (elapsed * (0.36 + baseSpeed * 0.3) + n * Math.PI * 2) % (Math.PI * 2);
      angle = triCorner + (Math.PI / 3) * Math.round((i % 3)) + Math.sin(elapsed * 0.5 + n * 7.0) * 0.16;
    } else {
      angle = Math.sin(elapsed * (0.45 + baseSpeed * 0.35) + n * 9.0) * 1.05;
    }

    angle += onsetSnap;
    const y = 1.8 + n * 7.8 + Math.sin(elapsed * 0.5 + i * 1.2) * 0.4;
    const x = Math.sin(elapsed * 0.23 + i * 0.9) * 1.5;

    const bassPunch = 1 + audioState.smoothBass * 1.4 + audioState.onset * 0.8;
    const thickness = (0.055 + 0.06 * bassPunch) * config.laserAmount * (0.86 + config.spotlightBrightness * 0.22);
    const highFlicker = 0.9 + 0.28 * audioState.smoothHigh * Math.sin(elapsed * (22 + i * 3.1));
    const brightness = THREE.MathUtils.clamp((0.16 + energy * 0.5 + audioState.smoothMid * 0.35) * highFlicker * config.masterIntensity, 0.08, 0.72);

    mesh.position.set(x, y, -6.15 + i * 0.012);
    mesh.rotation.z = angle;
    mesh.scale.set(baseLen / 18, thickness / 0.09, 1);
    mesh.material.opacity = brightness;

    seg.active = true;
    seg.intensity = brightness;
    const halfLen = baseLen * 0.5;
    const dx = Math.cos(angle) * halfLen;
    const dy = Math.sin(angle) * halfLen;
    seg.a.set(x - dx, y - dy);
    seg.b.set(x + dx, y + dy);
  }
}

function updateDotLaserInteractions() {
  for (let i = 0; i < dotCount; i++) {
    if (dotCooldown[i] > 0) continue;

    const dotP = tempVec2.set(dotPositions[i * 3 + 0], dotPositions[i * 3 + 1] + 6.4);
    for (let l = 0; l < laserMax; l++) {
      const seg = laserSegments[l];
      if (!seg.active || seg.intensity < 0.06) continue;
      const threshold = 0.2 + seg.intensity * 0.9;
      const d = distancePointToSegment(dotP, seg.a, seg.b);
      if (d < threshold) {
        dotPop[i] = Math.min(1, dotPop[i] + 0.9);
        dotCooldown[i] = 0.15 + Math.random() * 0.15;

        const warmMagenta = new THREE.Color(dotColors[i * 3 + 0], dotColors[i * 3 + 1], dotColors[i * 3 + 2]);
        emitSparkBurst(
          dotPositions[i * 3 + 0],
          dotPositions[i * 3 + 1],
          dotPositions[i * 3 + 2],
          warmMagenta,
          2 + Math.floor(Math.random() * 5)
        );
        break;
      }
    }
  }
}

function updateSparks(dt) {
  for (let i = 0; i < sparkMax; i++) {
    if (sparkLife[i] <= 0) {
      sparkSizes[i] = 0;
      continue;
    }
    sparkLife[i] -= dt;
    if (sparkLife[i] <= 0) {
      sparkSizes[i] = 0;
      continue;
    }

    sparkPositions[i * 3 + 0] += sparkVel[i * 3 + 0] * dt;
    sparkPositions[i * 3 + 1] += sparkVel[i * 3 + 1] * dt;
    sparkPositions[i * 3 + 2] += sparkVel[i * 3 + 2] * dt;
    sparkVel[i * 3 + 2] *= 0.98;

    const lifeNorm = THREE.MathUtils.clamp(sparkLife[i] / 0.3, 0, 1);
    sparkTwinkles[i] = 0.2 + lifeNorm * 1.2;
    sparkSizes[i] *= 0.96;
  }

  sparkGeo.attributes.position.needsUpdate = true;
  sparkGeo.attributes.aSize.needsUpdate = true;
  sparkGeo.attributes.aTwinkle.needsUpdate = true;
  sparksMat.uniforms.uIntensity.value = 0.82 + audioState.smoothHigh * 0.9;
}

function applyVisualDirection(dt, elapsed) {
  const visualTime = audio.paused ? elapsed - visualSyncStart : audio.currentTime;

  updateSwirlDots(dt, visualTime);
  updateLasers(dt, visualTime);
  updateDotLaserInteractions();
  updateSparks(dt);

  const energy = audioState.smoothRms;
  const highPeak = audioState.smoothHigh + audioState.onset * 0.5;

  floor.material.emissiveIntensity = THREE.MathUtils.clamp(0.08 + energy * 0.17, 0.07, 0.28);

  bloomPass.strength = THREE.MathUtils.clamp((0.42 + energy * 0.45 + highPeak * 0.16) * config.bloomStrength, 0.2, 1.25);
  bloomPass.radius = THREE.MathUtils.lerp(0.2, 0.42, energy + audioState.smoothMid * 0.4);
  bloomPass.threshold = THREE.MathUtils.lerp(0.56, 0.36, THREE.MathUtils.clamp(highPeak, 0, 1));

  chromaPass.uniforms.amount.value = THREE.MathUtils.lerp(chromaPass.uniforms.amount.value, audioState.onset * 0.22, 0.14);

  renderer.toneMappingExposure = THREE.MathUtils.clamp(0.84 + energy * 0.16, 0.78, 1.08);

  const camTargetX = Math.sin(visualTime * 0.22) * (0.08 + energy * 0.18);
  const camTargetY = 8.35 + Math.sin(visualTime * 0.18) * (0.04 + audioState.smoothMid * 0.06);
  camera.position.x = THREE.MathUtils.lerp(camera.position.x, camTargetX, 0.03);
  camera.position.y = THREE.MathUtils.lerp(camera.position.y, camTargetY, 0.03);
  camera.lookAt(0, 4.95, 0);
}

function setUiHiddenForIdle(hidden) {
  if (uiHiddenForIdle === hidden) return;
  uiHiddenForIdle = hidden;
  ui.panel.style.opacity = hidden ? '0' : '1';
  ui.panel.style.pointerEvents = hidden ? 'none' : 'auto';
  document.body.style.cursor = hidden ? 'none' : '';
}

function updateFullscreenIdle(nowMs) {
  if (!isFullscreen) {
    setUiHiddenForIdle(false);
    return;
  }
  const inactive = nowMs - lastMouseMoveMs > 1500;
  setUiHiddenForIdle(inactive);
}

function updateHud() {
  ui.hud.style.display = config.showHud ? 'block' : 'none';
  ui.bassMeter.style.width = `${Math.round(audioState.smoothBass * 100)}%`;
  ui.midMeter.style.width = `${Math.round(audioState.smoothMid * 100)}%`;
  ui.highMeter.style.width = `${Math.round(audioState.smoothHigh * 100)}%`;
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  const elapsed = clock.elapsedTime;

  analyzeAudio(dt);
  updateStateDirector(dt);
  applyVisualDirection(dt, elapsed);
  updateFullscreenIdle(performance.now());
  updateHud();

  composer.render();
}
animate();

function bindRange(el, key, parse = parseFloat) {
  el.addEventListener('input', () => {
    config[key] = parse(el.value);
  });
}

bindRange(ui.masterIntensity, 'masterIntensity');
bindRange(ui.bloomStrength, 'bloomStrength');
bindRange(ui.discoEnergy, 'discoEnergy');
bindRange(ui.laserAmount, 'laserAmount');
bindRange(ui.spotBrightness, 'spotlightBrightness');
bindRange(ui.extreme, 'extreme');

ui.cinematicMode.addEventListener('change', () => {
  config.cinematicMode = ui.cinematicMode.checked;
  if (config.cinematicMode) {
    ui.clubMode.checked = false;
    config.clubMode = false;
  }
});

ui.clubMode.addEventListener('change', () => {
  config.clubMode = ui.clubMode.checked;
  if (config.clubMode) {
    ui.cinematicMode.checked = false;
    config.cinematicMode = false;
  }
});

ui.showHud.addEventListener('change', () => {
  config.showHud = ui.showHud.checked;
});

function setDropVisible(visible) {
  ui.dropZone.classList.toggle('visible', visible);
}

function onDragEnter(e) {
  e.preventDefault();
  e.stopPropagation();

  if (!e.dataTransfer) return;
  if (!Array.from(e.dataTransfer.types).includes('Files')) return;

  ui.dropZone.classList.add('visible');
}

function onDragOver(e) {
  e.preventDefault();
  e.stopPropagation();

  if (!e.dataTransfer) return;
  if (!Array.from(e.dataTransfer.types).includes('Files')) return;

  ui.dropZone.classList.add('visible');
}

function onDragLeave(e) {
  if (
    e.clientX === 0 || e.clientY === 0 ||
    e.clientX >= window.innerWidth ||
    e.clientY >= window.innerHeight
  ) {
    ui.dropZone.classList.remove('visible');
  }
}

function onDrop(e) {
  e.preventDefault();
  e.stopPropagation();

  ui.dropZone.classList.remove('visible');

  let file = null;

  if (e.dataTransfer.items) {
    for (const item of e.dataTransfer.items) {
      if (item.kind === 'file') {
        file = item.getAsFile();
        break;
      }
    }
  } else {
    file = e.dataTransfer.files[0];
  }

  if (!file) return;
  if (!file.type || !file.type.startsWith('audio/')) {
    setStatus('Not an audio file');
    return;
  }

  loadAudioFile(file);
}

window.addEventListener('dragenter', onDragEnter);
window.addEventListener('dragover', onDragOver);
window.addEventListener('dragleave', onDragLeave);
window.addEventListener('drop', onDrop);

window.addEventListener('mousemove', () => {
  lastMouseMoveMs = performance.now();
  if (isFullscreen) setUiHiddenForIdle(false);
});

window.addEventListener('keydown', async (e) => {
  if (e.repeat) return;
  if (e.key === 'f' || e.key === 'F') {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      setStatus(`Fullscreen error: ${err.message}`);
    }
  }

  if (e.key === 'r' || e.key === 'R') {
    if (!audio.src) {
      setStatus('Load audio before restarting.');
      return;
    }
    audio.currentTime = 0;
    resetVisualTiming();
    setStatus('Restarted song');
    if (!audio.paused) {
      try {
        await audio.play();
      } catch (err) {
        setStatus(`Restart error: ${err.message}`);
      }
    }
  }
});

document.addEventListener('fullscreenchange', () => {
  isFullscreen = Boolean(document.fullscreenElement);
  lastMouseMoveMs = performance.now();
  if (!isFullscreen) setUiHiddenForIdle(false);
});

// Beginner-friendly default: show loader until audio is loaded.
ui.dropZone.classList.add('visible');
ui.dropZone.addEventListener('click', () => ui.fileInput.click());
ui.fileInput.addEventListener('change', () => {
  const file = ui.fileInput.files?.[0];
  loadAudioFile(file);
});

audio.addEventListener('canplay', () => {
  ui.playBtn.disabled = false;
});

audio.addEventListener('error', () => {
  setStatus('Audio load failed. Please try another file (mp3/wav/ogg/m4a).');
  ui.playBtn.disabled = true;
});

ui.playBtn.addEventListener('click', async () => {
  try {
    if (!audio.src) {
      setStatus('Drop or select an audio file first.');
      return;
    }
    setupAudioContext();
    if (audioCtx.state === 'suspended') await audioCtx.resume();
    await audio.play();
    resetVisualTiming();
    setStatus('Playing');
  } catch (err) {
    setStatus(`Play error: ${err.message}`);
  }
});

ui.pauseBtn.addEventListener('click', () => {
  audio.pause();
  setStatus('Paused');
});

ui.recordStartBtn.addEventListener('click', () => {
  try {
    const stream = renderer.domElement.captureStream(60);
    recordedChunks = [];
    recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) recordedChunks.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `japanese_disco_lightshow_${Date.now()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus('Recording saved (WebM).');
    };
    recorder.start();
    setStatus('Recording started...');
  } catch (err) {
    setStatus(`Recording error: ${err.message}`);
  }
});

ui.recordStopBtn.addEventListener('click', () => {
  if (recorder && recorder.state !== 'inactive') {
    recorder.stop();
    setStatus('Recording stopped. Downloading...');
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  dotsMat.uniforms.uPixelRatio.value = renderer.getPixelRatio();
  sparksMat.uniforms.uPixelRatio.value = renderer.getPixelRatio();
});
