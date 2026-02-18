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
  fullscreenBtn: document.getElementById('fullscreenBtn'),
  recordStartBtn: document.getElementById('recordStartBtn'),
  recordStopBtn: document.getElementById('recordStopBtn'),
  masterIntensity: document.getElementById('masterIntensity'),
  bloomStrength: document.getElementById('bloomStrength'),
  discoEnergy: document.getElementById('discoEnergy'),
  laserAmount: document.getElementById('laserAmount'),
  interactionGlow: document.getElementById('spotBrightness'),
  dotColorShift: document.getElementById('dotColorShift'),
  laserColorShift: document.getElementById('laserColorShift'),
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
  bloomStrength: 1.0,
  discoEnergy: 1.0,
  laserAmount: 0.9,
  interactionGlow: 0.65,
  dotColorShift: 0,
  laserColorShift: 0,
  extreme: 0.35,
  cinematicMode: true,
  clubMode: false,
  showHud: true,
  dotCount: 420
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
scene.fog = new THREE.Fog(0x050209, 22, 82);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 240);
camera.position.set(0, 8.4, 19);
camera.lookAt(0, 5, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.86;
app.appendChild(renderer.domElement);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.74, 0.42, 0.68);
composer.addPass(bloomPass);

const chromaPass = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, amount: { value: 0.0 } },
  vertexShader: `varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float amount;
    varying vec2 vUv;
    void main(){
      vec2 shift=amount*vec2(0.0024,0.0017);
      float r=texture2D(tDiffuse,vUv+shift).r;
      float g=texture2D(tDiffuse,vUv).g;
      float b=texture2D(tDiffuse,vUv-shift).b;
      gl_FragColor=vec4(r,g,b,1.0);
    }
  `
});
composer.addPass(chromaPass);

const finalClampPass = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, maxChannel: { value: 245 / 255 } },
  vertexShader: `varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float maxChannel;
    varying vec2 vUv;
    void main(){
      vec3 col = texture2D(tDiffuse, vUv).rgb;
      col = col / (1.0 + col * 0.45);
      col = min(col, vec3(maxChannel));
      gl_FragColor = vec4(col, 1.0);
    }
  `
});
composer.addPass(finalClampPass);


const dotCount = config.dotCount;
const dotsGeo = new THREE.BufferGeometry();
const dotPositions = new Float32Array(dotCount * 3);
const dotColors = new Float32Array(dotCount * 3);
const dotSizes = new Float32Array(dotCount);
const dotTwinkles = new Float32Array(dotCount);

const dotRadius = new Float32Array(dotCount);
const dotAngle = new Float32Array(dotCount);
const dotHeight = new Float32Array(dotCount);
const dotSeed = new Float32Array(dotCount);
const dotPop = new Float32Array(dotCount);
const dotCooldown = new Float32Array(dotCount);
const dotColorMix = new Float32Array(dotCount);

for (let i = 0; i < dotCount; i++) {
  dotRadius[i] = 2.4 + Math.pow(Math.random(), 0.76) * 14.8;
  dotAngle[i] = Math.random() * Math.PI * 2;
  dotHeight[i] = -1.3 + (Math.random() - 0.5) * 11.2;
  dotSeed[i] = Math.random();
  dotSizes[i] = 10 + Math.random() * 18;
  dotTwinkles[i] = 0.35;

  dotColorMix[i] = 0.38 + Math.random() * 0.5;
  dotColors[i * 3] = 0.6;
  dotColors[i * 3 + 1] = 0.3;
  dotColors[i * 3 + 2] = 0.55;
}

dotsGeo.setAttribute('position', new THREE.BufferAttribute(dotPositions, 3));
dotsGeo.setAttribute('aColor', new THREE.BufferAttribute(dotColors, 3));
dotsGeo.setAttribute('aSize', new THREE.BufferAttribute(dotSizes, 1));
dotsGeo.setAttribute('aTwinkle', new THREE.BufferAttribute(dotTwinkles, 1));

const pointVs = `
attribute vec3 aColor;
attribute float aSize;
attribute float aTwinkle;
varying vec3 vColor;
varying float vTwinkle;
uniform float uPixelRatio;
void main(){
  vec4 mvPosition = modelViewMatrix * vec4(position,1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = aSize * uPixelRatio * (145.0 / -mvPosition.z);
  vColor = aColor;
  vTwinkle = aTwinkle;
}`;

const pointFs = `
uniform float uIntensity;
varying vec3 vColor;
varying float vTwinkle;
void main(){
  vec2 p = gl_PointCoord - vec2(0.5);
  float d = length(p) * 2.0;
  float body = smoothstep(1.0, 0.0, d);
  float core = smoothstep(0.42, 0.0, d);
  float alpha = body * (0.16 + 0.6 * vTwinkle);
  vec3 col = vColor * (0.48 + core * 0.62 + vTwinkle * 0.34) * uIntensity;
  col = min(col, vec3(0.94));
  gl_FragColor = vec4(col, alpha);
}`;

const dotsMat = new THREE.ShaderMaterial({
  uniforms: {
    uPixelRatio: { value: renderer.getPixelRatio() },
    uIntensity: { value: 0.88 }
  },
  vertexShader: pointVs,
  fragmentShader: pointFs,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending
});

const dotPoints = new THREE.Points(dotsGeo, dotsMat);
dotPoints.position.set(0, 6.2, -4.5);
scene.add(dotPoints);

const sparkMax = 1100;
const sparkGeo = new THREE.BufferGeometry();
const sparkPos = new Float32Array(sparkMax * 3);
const sparkCol = new Float32Array(sparkMax * 3);
const sparkSize = new Float32Array(sparkMax);
const sparkTwinkle = new Float32Array(sparkMax);
const sparkVel = new Float32Array(sparkMax * 3);
const sparkLife = new Float32Array(sparkMax);
let sparkWrite = 0;

sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
sparkGeo.setAttribute('aColor', new THREE.BufferAttribute(sparkCol, 3));
sparkGeo.setAttribute('aSize', new THREE.BufferAttribute(sparkSize, 1));
sparkGeo.setAttribute('aTwinkle', new THREE.BufferAttribute(sparkTwinkle, 1));

const sparksMat = dotsMat.clone();
sparksMat.uniforms = {
  uPixelRatio: { value: renderer.getPixelRatio() },
  uIntensity: { value: 0.78 }
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

const laserBaseHueOffsets = [0.0, -0.07, 0.05, -0.03, 0.03, -0.1, 0.01, 0.08];
for (let i = 0; i < laserMax; i++) {
  const mat = new THREE.MeshBasicMaterial({
    color: 0xff69be,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.09), mat);
  laserGroup.add(mesh);
  laserMeshes.push(mesh);
}

const intersectionMax = 28;
const intersectionGeo = new THREE.BufferGeometry();
const ixPos = new Float32Array(intersectionMax * 3);
const ixCol = new Float32Array(intersectionMax * 3);
const ixSize = new Float32Array(intersectionMax);
const ixTw = new Float32Array(intersectionMax);
intersectionGeo.setAttribute('position', new THREE.BufferAttribute(ixPos, 3));
intersectionGeo.setAttribute('aColor', new THREE.BufferAttribute(ixCol, 3));
intersectionGeo.setAttribute('aSize', new THREE.BufferAttribute(ixSize, 1));
intersectionGeo.setAttribute('aTwinkle', new THREE.BufferAttribute(ixTw, 1));

const intersectionMat = dotsMat.clone();
intersectionMat.uniforms = {
  uPixelRatio: { value: renderer.getPixelRatio() },
  uIntensity: { value: 0.62 }
};
const intersectionPoints = new THREE.Points(intersectionGeo, intersectionMat);
intersectionPoints.position.set(0, 0, -5.2);
scene.add(intersectionPoints);

updateDotPalette();
updateLaserPalette();


const tempColor = new THREE.Color();
const temp2A = new THREE.Vector2();
const temp2B = new THREE.Vector2();
const clock = new THREE.Clock();

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
  modeDisplay: 'CALM'
};

let isFullscreen = false;
let hideUiTimer = null;

function setStatus(text) {
  ui.status.textContent = text;
}

function scheduleUiHide() {
  if (!isFullscreen) return;
  clearTimeout(hideUiTimer);
  hideUiTimer = setTimeout(() => {
    ui.panel.classList.add('uiHidden');
    renderer.domElement.style.cursor = 'none';
  }, 1500);
}

function showUiImmediate() {
  ui.panel.classList.remove('uiHidden');
  renderer.domElement.style.cursor = '';
}

function updateDotPalette() {
  const warmBase = 0.115 + config.dotColorShift;
  const magentaBase = 0.89 + config.dotColorShift;
  for (let i = 0; i < dotCount; i++) {
    const warm = tempColor.setHSL((warmBase + dotSeed[i] * 0.05 + 1) % 1, 0.88, 0.52).clone();
    const magenta = new THREE.Color().setHSL((magentaBase + dotSeed[i] * 0.05 + 1) % 1, 0.74, 0.5);
    const color = warm.lerp(magenta, dotColorMix[i]);
    dotColors[i * 3] = color.r;
    dotColors[i * 3 + 1] = color.g;
    dotColors[i * 3 + 2] = color.b;
  }
  dotsGeo.attributes.aColor.needsUpdate = true;
}

function updateLaserPalette() {
  for (let i = 0; i < laserMax; i++) {
    const hue = (0.9 + config.laserColorShift + laserBaseHueOffsets[i] + 1) % 1;
    tempColor.setHSL(hue, 0.72, 0.56);
    laserMeshes[i].material.color.copy(tempColor);
  }
}



async function toggleFullscreen() {
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
  audioState.onset = THREE.MathUtils.lerp(audioState.onset, Math.min(1, rise * 8.0 + high * 0.22), 0.22);

  const agcTarget = 0.43;
  const gainNow = THREE.MathUtils.clamp(agcTarget / Math.max(0.08, rms), 0.55, 1.9);
  audioState.agc = THREE.MathUtils.lerp(audioState.agc, gainNow, 0.1);
  const rmsAgc = THREE.MathUtils.clamp(rms * audioState.agc, 0, 2);
  audioState.compressed = rmsAgc / (rmsAgc + 0.82);

  const smoothA = 1 - Math.exp(-dt / 0.13);
  audioState.bass = bass;
  audioState.mid = mid;
  audioState.high = high;
  audioState.rms = rms;
  audioState.smoothBass += (bass - audioState.smoothBass) * smoothA;
  audioState.smoothMid += (mid - audioState.smoothMid) * smoothA;
  audioState.smoothHigh += (high - audioState.smoothHigh) * smoothA;
  audioState.smoothRms += (audioState.compressed - audioState.smoothRms) * (1 - Math.exp(-dt / 0.18));

  const e = audioState.smoothRms;
  audioState.modeDisplay = e < 0.3 ? 'CALM' : e < 0.58 ? 'DRIVE' : 'SURGE';
  ui.stateText.textContent = `State: ${audioState.modeDisplay}`;
}

function emitSparkBurst(x, y, z, baseColor, amount) {
  for (let s = 0; s < amount; s++) {
    const idx = sparkWrite;
    sparkWrite = (sparkWrite + 1) % sparkMax;
    const ang = Math.random() * Math.PI * 2;
    const spd = 0.6 + Math.random() * 1.8;

    sparkPos[idx * 3] = x;
    sparkPos[idx * 3 + 1] = y;
    sparkPos[idx * 3 + 2] = z;
    sparkVel[idx * 3] = Math.cos(ang) * spd;
    sparkVel[idx * 3 + 1] = Math.sin(ang) * spd;
    sparkVel[idx * 3 + 2] = (Math.random() - 0.5) * 0.35;
    sparkLife[idx] = 0.12 + Math.random() * 0.2;
    sparkSize[idx] = 5 + Math.random() * 8;
    sparkTwinkle[idx] = 0.5 + Math.random() * 0.35;

    tempColor.copy(baseColor).offsetHSL((Math.random() - 0.5) * 0.03, 0.04, 0.05);
    sparkCol[idx * 3] = tempColor.r;
    sparkCol[idx * 3 + 1] = tempColor.g;
    sparkCol[idx * 3 + 2] = tempColor.b;
  }
}

function updateSwirlDots(dt, t) {
  const bassPush = 0.66 + audioState.smoothBass * 1.05;
  const swirlSpeed = 0.22 + audioState.smoothMid * 1.6;
  const highTwinkleBoost = 0.22 + audioState.smoothHigh * 1.0;
  const sizePulse = 1 + audioState.smoothHigh * 0.16 + audioState.onset * 0.1;

  for (let i = 0; i < dotCount; i++) {
    dotAngle[i] += dt * swirlSpeed * (0.55 + dotSeed[i] * 1.0);
    const wobble = 1 + 0.14 * Math.sin(t * (0.35 + dotSeed[i] * 1.1) + dotSeed[i] * 12.0);
    const radius = dotRadius[i] * bassPush * wobble;

    const flowAngle = dotAngle[i] + Math.sin(t * 0.25 + dotSeed[i] * 8.0) * 0.3;
    dotPositions[i * 3] = Math.cos(flowAngle) * radius;
    dotPositions[i * 3 + 1] = dotHeight[i] + Math.sin(flowAngle * 1.7 + t * 0.52 + dotSeed[i] * 6.0) * 0.7;
    dotPositions[i * 3 + 2] = Math.sin(flowAngle * 0.8 + t * 0.3) * 1.8;

    dotCooldown[i] = Math.max(0, dotCooldown[i] - dt);
    dotPop[i] = Math.max(0, dotPop[i] - dt * 4.8);
    dotTwinkles[i] = 0.28 + highTwinkleBoost * (0.22 + 0.58 * Math.abs(Math.sin(t * (4 + dotSeed[i] * 5.5) + dotSeed[i] * 18.0)));
    dotSizes[i] = (9 + dotRadius[i] * 0.92) * sizePulse * (1 + dotPop[i] * 0.8);
  }

  dotsGeo.attributes.position.needsUpdate = true;
  dotsGeo.attributes.aSize.needsUpdate = true;
  dotsGeo.attributes.aTwinkle.needsUpdate = true;
  dotsMat.uniforms.uIntensity.value = THREE.MathUtils.clamp(0.7 + audioState.smoothRms * 0.55, 0.6, 0.98);
}

function worldScreenBoundsAtZ(zPlane) {
  const depth = Math.abs(camera.position.z - zPlane);
  const h = 2 * Math.tan((camera.fov * Math.PI / 180) / 2) * depth;
  const w = h * camera.aspect;
  return { w, h, diagonal: Math.sqrt(w * w + h * h) };
}

function lineIntersection(a1, a2, b1, b2) {
  const s1x = a2.x - a1.x;
  const s1y = a2.y - a1.y;
  const s2x = b2.x - b1.x;
  const s2y = b2.y - b1.y;
  const denom = (-s2x * s1y + s1x * s2y);
  if (Math.abs(denom) < 1e-5) return null;
  const s = (-s1y * (a1.x - b1.x) + s1x * (a1.y - b1.y)) / denom;
  const t = (s2x * (a1.y - b1.y) - s2y * (a1.x - b1.x)) / denom;
  if (s >= 0 && s <= 1 && t >= 0 && t <= 1) return new THREE.Vector2(a1.x + (t * s1x), a1.y + (t * s1y));
  return null;
}

function updateLasers(dt, t) {
  laserModeTime += dt;
  if (laserModeTime >= laserModeDuration) {
    laserModeTime = 0;
    laserModeDuration = 6 + Math.random() * 6;
    currentLaserMode = (currentLaserMode + 1) % LASER_MODES.length;
  }

  const bounds = worldScreenBoundsAtZ(-5.3);
  const screenSpan = bounds.diagonal * 3.0; // always edge-to-edge and beyond

  const mode = LASER_MODES[currentLaserMode];
  const activeCount = THREE.MathUtils.clamp(Math.round(3 + audioState.smoothMid * 4 + audioState.smoothRms * 2), 3, laserMax);
  const speed = 0.2 + audioState.smoothMid * 1.25 + config.extreme * 0.45;
  const onsetSnap = audioState.onset > 0.34 ? (Math.random() - 0.5) * 0.07 : 0;

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
      angle = THREE.MathUtils.lerp(-0.95, 0.95, n) + Math.sin((t + i * 0.1) * (0.58 + speed)) * 0.2;
    } else if (mode === 'crisscross') {
      const dir = i % 2 ? 1 : -1;
      angle = dir * (0.44 + 0.35 * Math.sin(t * (0.72 + speed * 0.7) + n * 8.0));
    } else if (mode === 'triangle') {
      angle = (t * (0.34 + speed * 0.26) + (i % 3) * (Math.PI / 3)) % (Math.PI * 2);
    } else {
      angle = Math.sin(t * (0.42 + speed * 0.3) + n * 9.0) * 1.02;
    }
    angle += onsetSnap;

    const cx = Math.sin(t * 0.2 + i * 0.8) * (bounds.w * 0.16);
    const cy = THREE.MathUtils.lerp(-bounds.h * 0.35, bounds.h * 0.35, n) + Math.sin(t * 0.4 + i * 1.2) * 0.3;

    const bassPunch = 1 + audioState.smoothBass * 1.1 + audioState.onset * 0.7;
    const thickness = (0.05 + 0.05 * bassPunch) * config.laserAmount;
    const highShimmer = 0.88 + 0.2 * audioState.smoothHigh * Math.sin(t * (19 + i * 2.3));
    const bright = THREE.MathUtils.clamp((0.12 + audioState.smoothRms * 0.35 + audioState.smoothMid * 0.22) * highShimmer * config.masterIntensity, 0.07, 0.42);

    mesh.position.set(cx, cy, -5.3 + i * 0.01);
    mesh.rotation.z = angle;
    mesh.scale.set(screenSpan / 2, thickness / 0.09, 1);
    mesh.material.opacity = bright;

    const dx = Math.cos(angle) * screenSpan * 0.5;
    const dy = Math.sin(angle) * screenSpan * 0.5;
    seg.active = true;
    seg.intensity = bright;
    seg.a.set(cx - dx, cy - dy);
    seg.b.set(cx + dx, cy + dy);
  }
}

function distancePointToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const lenSq = Math.max(1e-6, abx * abx + aby * aby);
  const t = THREE.MathUtils.clamp(((px - ax) * abx + (py - ay) * aby) / lenSq, 0, 1);
  const qx = ax + abx * t;
  const qy = ay + aby * t;
  const dx = px - qx;
  const dy = py - qy;
  return Math.sqrt(dx * dx + dy * dy);
}

function updateLaserDotInteractions() {
  for (let i = 0; i < dotCount; i++) {
    if (dotCooldown[i] > 0) continue;
    const px = dotPositions[i * 3];
    const py = dotPositions[i * 3 + 1] + dotPoints.position.y;

    for (let l = 0; l < laserMax; l++) {
      const seg = laserSegments[l];
      if (!seg.active || seg.intensity < 0.06) continue;
      const d = distancePointToSegment(px, py, seg.a.x, seg.a.y, seg.b.x, seg.b.y);
      if (d < 0.2 + seg.intensity * 0.7) {
        dotPop[i] = Math.min(1, dotPop[i] + 0.9);
        dotCooldown[i] = 0.15 + Math.random() * 0.15;

        tempColor.setRGB(dotColors[i * 3], dotColors[i * 3 + 1], dotColors[i * 3 + 2]);
        emitSparkBurst(dotPositions[i * 3], dotPositions[i * 3 + 1], dotPositions[i * 3 + 2], tempColor, 2 + Math.floor(Math.random() * 4));
        break;
      }
    }
  }
}

function updateLaserIntersectionGlow() {
  let write = 0;
  for (let i = 0; i < laserMax; i++) {
    const a = laserSegments[i];
    if (!a.active) continue;
    for (let j = i + 1; j < laserMax; j++) {
      const b = laserSegments[j];
      if (!b.active) continue;
      const p = lineIntersection(a.a, a.b, b.a, b.b);
      if (!p || write >= intersectionMax) continue;

      const intensity = THREE.MathUtils.clamp((a.intensity + b.intensity) * 0.16 * config.interactionGlow, 0.02, 0.14); // toned down 60-80%
      ixPos[write * 3] = p.x;
      ixPos[write * 3 + 1] = p.y;
      ixPos[write * 3 + 2] = 0;
      ixSize[write] = THREE.MathUtils.clamp(12 + intensity * 30, 10, 20); // smaller radius
      ixTw[write] = 0.35 + intensity * 0.9;

      // tinted only, no white
      tempColor.setHSL((0.92 + config.laserColorShift - (write % 3) * 0.03 + 1) % 1, 0.7, 0.52);
      ixCol[write * 3] = tempColor.r;
      ixCol[write * 3 + 1] = tempColor.g;
      ixCol[write * 3 + 2] = tempColor.b;
      write += 1;
    }
  }

  for (let k = write; k < intersectionMax; k++) {
    ixSize[k] = 0;
    ixTw[k] = 0;
  }

  intersectionGeo.attributes.position.needsUpdate = true;
  intersectionGeo.attributes.aSize.needsUpdate = true;
  intersectionGeo.attributes.aTwinkle.needsUpdate = true;
  intersectionGeo.attributes.aColor.needsUpdate = true;
  intersectionMat.uniforms.uIntensity.value = 0.46;
}

function updateSparks(dt) {
  for (let i = 0; i < sparkMax; i++) {
    if (sparkLife[i] <= 0) {
      sparkSize[i] = 0;
      continue;
    }
    sparkLife[i] -= dt;
    if (sparkLife[i] <= 0) {
      sparkSize[i] = 0;
      continue;
    }

    sparkPos[i * 3] += sparkVel[i * 3] * dt;
    sparkPos[i * 3 + 1] += sparkVel[i * 3 + 1] * dt;
    sparkPos[i * 3 + 2] += sparkVel[i * 3 + 2] * dt;
    sparkVel[i * 3 + 2] *= 0.98;

    const lifeNorm = THREE.MathUtils.clamp(sparkLife[i] / 0.28, 0, 1);
    sparkTwinkle[i] = 0.2 + lifeNorm;
    sparkSize[i] *= 0.95;
  }

  sparkGeo.attributes.position.needsUpdate = true;
  sparkGeo.attributes.aSize.needsUpdate = true;
  sparkGeo.attributes.aTwinkle.needsUpdate = true;
  sparksMat.uniforms.uIntensity.value = 0.72;
}

function applyVisualDirection(dt, elapsed) {
  const t = audio.paused ? elapsed - visualSyncStart : audio.currentTime;
  updateSwirlDots(dt, t);
  updateLasers(dt, t);
  updateLaserDotInteractions();
  updateLaserIntersectionGlow();
  updateSparks(dt);

  bloomPass.strength = THREE.MathUtils.clamp((0.32 + audioState.smoothRms * 0.3 + audioState.smoothHigh * 0.1) * config.bloomStrength, 0.2, 0.72);
  bloomPass.radius = THREE.MathUtils.lerp(0.16, 0.32, audioState.smoothRms + audioState.smoothMid * 0.2);
  bloomPass.threshold = THREE.MathUtils.lerp(0.62, 0.47, THREE.MathUtils.clamp(audioState.smoothHigh, 0, 1));
  chromaPass.uniforms.amount.value = THREE.MathUtils.lerp(chromaPass.uniforms.amount.value, audioState.onset * 0.14, 0.12);
  renderer.toneMappingExposure = THREE.MathUtils.clamp(0.8 + audioState.smoothRms * 0.08, 0.76, 0.9);

  const camTargetX = Math.sin(t * 0.2) * (0.06 + audioState.smoothRms * 0.12);
  const camTargetY = 8.35 + Math.sin(t * 0.16) * (0.03 + audioState.smoothMid * 0.05);
  camera.position.x = THREE.MathUtils.lerp(camera.position.x, camTargetX, 0.03);
  camera.position.y = THREE.MathUtils.lerp(camera.position.y, camTargetY, 0.03);
  camera.lookAt(0, 4.95, 0);
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
  applyVisualDirection(dt, elapsed);
  updateHud();
  composer.render();
}
animate();

function bindRange(el, key, parse = parseFloat) {
  el.addEventListener('input', () => {
    config[key] = parse(el.value);
    if (key === 'dotColorShift') updateDotPalette();
    if (key === 'laserColorShift') updateLaserPalette();
  });
}

bindRange(ui.masterIntensity, 'masterIntensity');
bindRange(ui.bloomStrength, 'bloomStrength');
bindRange(ui.discoEnergy, 'discoEnergy');
bindRange(ui.laserAmount, 'laserAmount');
bindRange(ui.interactionGlow, 'interactionGlow');
bindRange(ui.dotColorShift, 'dotColorShift');
bindRange(ui.laserColorShift, 'laserColorShift');
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


window.addEventListener('dragenter', (e) => console.log('WIN dragenter'), true);
window.addEventListener('dragover', (e) => console.log('WIN dragover'), true);
window.addEventListener('drop', (e) => console.log('WIN drop'), true);
document.addEventListener('dragenter', (e) => console.log('DOC dragenter'), true);
document.addEventListener('dragover', (e) => console.log('DOC dragover'), true);
document.addEventListener('drop', (e) => console.log('DOC drop'), true);

function onDragEnter(e) {
  e.preventDefault();
  e.stopPropagation();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  setStatus('dragenter');
  if (!e.dataTransfer) return;
  if (!Array.from(e.dataTransfer.types).includes('Files')) return;
  ui.dropZone.classList.add('visible');
}

function onDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  setStatus('dragover');
  if (!e.dataTransfer) return;
  if (!Array.from(e.dataTransfer.types).includes('Files')) return;
  ui.dropZone.classList.add('visible');
}

function onDragLeave(e) {
  if (e.clientX === 0 || e.clientY === 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
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
document.addEventListener('dragenter', onDragEnter, { capture: true });
document.addEventListener('dragover', onDragOver, { capture: true });
document.addEventListener('dragleave', onDragLeave, { capture: true });
document.addEventListener('drop', onDrop, { capture: true });

window.addEventListener('mousemove', () => {
  if (!isFullscreen) return;
  showUiImmediate();
  scheduleUiHide();
});

window.addEventListener('dblclick', () => {
  toggleFullscreen();
});

window.addEventListener('keydown', async (e) => {
  if (e.repeat) return;

  if (e.key === 'f' || e.key === 'F') {
    await toggleFullscreen();
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

ui.fullscreenBtn?.addEventListener('click', () => {
  toggleFullscreen();
});

document.addEventListener('fullscreenchange', () => {
  isFullscreen = Boolean(document.fullscreenElement);
  clearTimeout(hideUiTimer);
  if (isFullscreen) {
    showUiImmediate();
    scheduleUiHide();
  } else {
    showUiImmediate();
  }
});

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
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) recordedChunks.push(event.data);
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
  intersectionMat.uniforms.uPixelRatio.value = renderer.getPixelRatio();
});
