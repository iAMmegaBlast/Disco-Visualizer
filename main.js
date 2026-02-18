import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

const app = document.getElementById('app');

const ui = {
  loadBtn: document.getElementById('loadBtn'),
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
camera.position.set(0, 8.5, 19);
camera.lookAt(0, 5, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
app.appendChild(renderer.domElement);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.15, 0.5, 0.55);
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
      vec2 shift = amount * vec2(0.004, 0.003);
      float r = texture2D(tDiffuse, vUv + shift).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - shift).b;
      gl_FragColor = vec4(r, g, b, 1.0);
    }
  `
});
composer.addPass(chromaPass);

const ambient = new THREE.AmbientLight(0x3a2a45, 0.35);
scene.add(ambient);

const hazeGeo = new THREE.SphereGeometry(52, 32, 16);
const hazeMat = new THREE.MeshBasicMaterial({
  color: 0x531f77,
  transparent: true,
  opacity: 0.07,
  side: THREE.BackSide,
  depthWrite: false
});
const haze = new THREE.Mesh(hazeGeo, hazeMat);
scene.add(haze);

const textureLoader = new THREE.TextureLoader();
const bgTexture = textureLoader.load('./dancefloor_daimyo_bg_upscaled_1920x1080.png');
bgTexture.colorSpace = THREE.SRGBColorSpace;
const bgPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(42, 23.625),
  new THREE.MeshBasicMaterial({ map: bgTexture, toneMapped: false })
);
bgPlane.position.set(0, 8.8, -22);
scene.add(bgPlane);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(50, 36, 1, 1),
  new THREE.MeshPhysicalMaterial({
    color: 0x221126,
    metalness: 0.55,
    roughness: 0.22,
    clearcoat: 1.0,
    clearcoatRoughness: 0.18,
    emissive: 0x12070e,
    emissiveIntensity: 0.35
  })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -1.15;
scene.add(floor);

const discoGroup = new THREE.Group();
discoGroup.position.set(-7.5, 10.8, -3.0);
scene.add(discoGroup);

const discoBall = new THREE.Mesh(
  new THREE.SphereGeometry(2.35, 64, 64),
  new THREE.MeshStandardMaterial({
    color: 0xffe2b4,
    metalness: 0.95,
    roughness: 0.12,
    envMapIntensity: 1.6,
    emissive: 0x4d1e44,
    emissiveIntensity: 0.08
  })
);
discoGroup.add(discoBall);

const discoCoreLight = new THREE.PointLight(0xffddaa, 1.2, 28, 2);
discoCoreLight.position.set(0, 0, 0);
discoGroup.add(discoCoreLight);

const sparkleCount = 260;
const sparkleGeo = new THREE.BufferGeometry();
const sparklePositions = new Float32Array(sparkleCount * 3);
const sparkleSizes = new Float32Array(sparkleCount);
for (let i = 0; i < sparkleCount; i++) {
  const r = 3.2 + Math.random() * 8.8;
  const a = Math.random() * Math.PI * 2;
  const h = (Math.random() - 0.5) * 7.5;
  sparklePositions[i * 3 + 0] = Math.cos(a) * r;
  sparklePositions[i * 3 + 1] = h;
  sparklePositions[i * 3 + 2] = Math.sin(a) * r;
  sparkleSizes[i] = 2 + Math.random() * 5;
}
sparkleGeo.setAttribute('position', new THREE.BufferAttribute(sparklePositions, 3));
sparkleGeo.setAttribute('size', new THREE.BufferAttribute(sparkleSizes, 1));

const sparkleMat = new THREE.PointsMaterial({
  color: 0xff8ce3,
  size: 0.17,
  transparent: true,
  opacity: 0.66,
  blending: THREE.AdditiveBlending,
  depthWrite: false
});
const glitter = new THREE.Points(sparkleGeo, sparkleMat);
glitter.position.set(0, 5, 0);
scene.add(glitter);

const laserGroup = new THREE.Group();
scene.add(laserGroup);
const lasers = [];
for (let i = 0; i < 8; i++) {
  const mat = new THREE.MeshBasicMaterial({ color: i % 2 ? 0xff3fae : 0x66a9ff, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 24, 10, 1, true), mat);
  mesh.position.set((i - 4) * 2.0, 7.5, -5 + i * 0.7);
  mesh.rotation.z = Math.PI / 2;
  laserGroup.add(mesh);
  lasers.push(mesh);
}

const spotlightRig = new THREE.Group();
scene.add(spotlightRig);
const movingHeads = [];
function makeMovingHead(x, z, color) {
  const g = new THREE.Group();
  g.position.set(x, 8.0, z);

  const spot = new THREE.SpotLight(color, 1.3, 65, Math.PI / 8, 0.42, 1.2);
  spot.position.set(0, 0, 0);
  spot.target.position.set(0, -6.5, -9);
  g.add(spot);
  g.add(spot.target);

  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(1.7, 16.5, 24, 1, true),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    })
  );
  cone.rotation.x = Math.PI;
  cone.position.y = -8.2;
  g.add(cone);

  spotlightRig.add(g);
  movingHeads.push({ group: g, spot, cone, baseX: x, baseZ: z });
}

makeMovingHead(-10, 5, 0xffb176);
makeMovingHead(-4, 7, 0xff5ad7);
makeMovingHead(4, 7, 0x74a5ff);
makeMovingHead(10, 5, 0xff7eb7);

const taikoHitLight = new THREE.PointLight(0xffa866, 0.0, 42, 2);
taikoHitLight.position.set(0, 3.2, 4.8);
scene.add(taikoHitLight);

const clock = new THREE.Clock();

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
let recordStream = null;

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
  mode: { intro: 1, groove: 0, build: 0, climax: 0 },
  modeDisplay: 'INTRO'
};

function setStatus(text) {
  ui.status.textContent = text;
}

function setupAudioContext() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.70;
  freqData = new Uint8Array(analyser.frequencyBinCount);

  sourceNode = audioCtx.createMediaElementSource(audio);
  sourceNode.connect(analyser);
  analyser.connect(audioCtx.destination);
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
    audioState.onset *= 0.9;
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
  audioState.onset = THREE.MathUtils.lerp(audioState.onset, Math.min(1, rise * 7.5 + high * 0.25), 0.22);

  const agcTarget = 0.44;
  const gainNow = THREE.MathUtils.clamp(agcTarget / Math.max(0.08, rms), 0.55, 1.85);
  audioState.agc = THREE.MathUtils.lerp(audioState.agc, gainNow, 0.08);
  const rmsAgc = THREE.MathUtils.clamp(rms * audioState.agc, 0, 2);
  audioState.compressed = rmsAgc / (rmsAgc + 0.85);

  const smoothA = 1 - Math.exp(-dt / 0.13);
  audioState.smoothBass += (bass - audioState.smoothBass) * smoothA;
  audioState.smoothMid += (mid - audioState.smoothMid) * smoothA;
  audioState.smoothHigh += (high - audioState.smoothHigh) * smoothA;
  audioState.smoothRms += (audioState.compressed - audioState.smoothRms) * (1 - Math.exp(-dt / 0.18));

  audioState.bass = bass;
  audioState.mid = mid;
  audioState.high = high;
  audioState.rms = rms;
}

function updateStateDirector(dt) {
  const t = audio.duration > 0 ? (audio.currentTime / audio.duration) : 0;
  const energy = audioState.smoothRms;
  const rhythm = 0.55 * audioState.smoothMid + 0.45 * audioState.smoothBass;

  const introTarget = THREE.MathUtils.clamp((0.16 - t) / 0.16, 0, 1) * THREE.MathUtils.clamp((0.60 - energy) / 0.60, 0, 1);
  const buildTarget = THREE.MathUtils.clamp((energy - 0.42) / 0.38, 0, 1) * THREE.MathUtils.clamp((audioState.onset + audioState.smoothMid) * 0.9, 0, 1);
  const climaxTarget = THREE.MathUtils.clamp((t - 0.73) / 0.2, 0, 1) * THREE.MathUtils.clamp((energy - 0.46) / 0.35, 0, 1);
  const grooveTarget = THREE.MathUtils.clamp((1.0 - introTarget) * (0.4 + rhythm) * (1.0 - 0.6 * climaxTarget), 0, 1);

  const targets = { intro: introTarget, groove: grooveTarget, build: buildTarget, climax: climaxTarget };
  const blend = 1 - Math.exp(-dt / THREE.MathUtils.lerp(1.2, 0.55, config.extreme));

  for (const k of Object.keys(audioState.mode)) {
    audioState.mode[k] += (targets[k] - audioState.mode[k]) * blend;
  }

  const sum = Object.values(audioState.mode).reduce((a, b) => a + b, 0) || 1;
  for (const k of Object.keys(audioState.mode)) audioState.mode[k] /= sum;

  const dominant = Object.entries(audioState.mode).sort((a, b) => b[1] - a[1])[0][0];
  audioState.modeDisplay = dominant.toUpperCase();
  ui.stateText.textContent = `State: ${audioState.modeDisplay}`;
}

function applyLightingDirection(dt, elapsed) {
  const mode = audioState.mode;
  const groovePulse = 0.5 + 0.5 * Math.sin(elapsed * THREE.MathUtils.lerp(2.4, 5.2, config.extreme));
  const directorEnergy = THREE.MathUtils.clamp(
    (0.28 + 0.7 * audioState.smoothRms + mode.build * 0.2 + mode.climax * 0.25) * config.masterIntensity,
    0.18,
    1.25
  );

  const discoSpeed = THREE.MathUtils.lerp(0.25, 1.35, mode.climax * 0.8 + mode.build * 0.5 + config.extreme * 0.4);
  discoGroup.rotation.y += dt * discoSpeed;
  discoBall.rotation.x += dt * 0.17;

  const discoSparkle = (0.15 + audioState.smoothHigh * 1.2 + mode.build * 0.35 + mode.climax * 0.5) * config.discoEnergy;
  discoCoreLight.intensity = THREE.MathUtils.clamp(0.5 + discoSparkle * 1.3, 0.4, 2.6);
  discoCoreLight.color.setRGB(1.0, 0.75 + 0.12 * mode.groove, 0.45 + 0.35 * mode.build);

  glitter.rotation.y += dt * THREE.MathUtils.lerp(0.08, 0.6, mode.groove + mode.climax * 0.3 + config.extreme * 0.2);
  glitter.material.opacity = THREE.MathUtils.clamp(0.12 + audioState.smoothHigh * 0.5 + mode.build * 0.2 + mode.climax * 0.18, 0.08, 0.75);
  glitter.material.color.setHSL(0.88 - mode.climax * 0.06, 0.82, 0.62);

  const taiko = THREE.MathUtils.clamp(audioState.onset * 1.8 + audioState.smoothBass * 0.6, 0, 1.2);
  taikoHitLight.intensity = THREE.MathUtils.lerp(taikoHitLight.intensity, taiko * 2.1, 0.15);

  movingHeads.forEach((h, i) => {
    const speed = THREE.MathUtils.lerp(0.22, 1.8, mode.groove * 0.4 + mode.build * 0.6 + mode.climax * 1.0 + config.extreme * 0.6);
    const phase = elapsed * speed + i * 1.4;
    const arc = THREE.MathUtils.lerp(0.24, 0.84, mode.build * 0.6 + mode.climax + config.extreme * 0.35);
    h.group.rotation.y = Math.sin(phase) * arc;
    h.group.rotation.x = -0.12 + Math.cos(phase * 0.9) * 0.13;

    const coneWiden = 0.7 + taiko * 0.25;
    h.spot.angle = THREE.MathUtils.clamp((0.14 + mode.climax * 0.07 + mode.build * 0.05) * coneWiden, 0.12, 0.34);
    const spotInt = (0.32 + directorEnergy * (0.8 + mode.climax * 0.5 + mode.build * 0.3) + groovePulse * 0.25 * mode.groove) * config.spotlightBrightness;
    h.spot.intensity = THREE.MathUtils.clamp(spotInt, 0.15, 2.9);
    h.cone.material.opacity = THREE.MathUtils.clamp(0.05 + h.spot.intensity * 0.08, 0.04, 0.30);
  });

  lasers.forEach((l, i) => {
    const active = mode.build * 0.55 + mode.climax * 1.0 + mode.groove * 0.28;
    const pulse = 0.4 + 0.6 * Math.sin(elapsed * 3.5 + i * 0.8);
    const amount = active * pulse * config.laserAmount;
    l.material.opacity = THREE.MathUtils.clamp(amount * (0.12 + 0.28 * directorEnergy), 0.0, 0.48);
    l.rotation.y = Math.sin(elapsed * (0.4 + mode.climax * 1.2) + i) * 0.9;
    l.rotation.z = Math.PI / 2 + Math.cos(elapsed * (0.7 + mode.groove * 1.1) + i * 1.2) * 0.4;
  });

  const floorGlow = THREE.MathUtils.clamp(0.07 + directorEnergy * (0.14 + mode.groove * 0.09 + mode.climax * 0.06), 0.05, 0.33);
  floor.material.emissiveIntensity = floorGlow;

  bloomPass.strength = THREE.MathUtils.clamp((0.45 + directorEnergy * 0.65 + mode.climax * 0.22) * config.bloomStrength * (config.cinematicMode ? 0.9 : 1.05), 0.2, 2.2);
  bloomPass.radius = THREE.MathUtils.lerp(0.18, 0.45, mode.build + mode.climax * 0.9 + config.extreme * 0.6);
  bloomPass.threshold = THREE.MathUtils.lerp(0.47, 0.24, mode.climax * 0.7 + config.clubMode * 0.4);

  const hit = THREE.MathUtils.clamp(audioState.onset * 1.2 + mode.climax * 0.25, 0, 1);
  chromaPass.uniforms.amount.value = THREE.MathUtils.lerp(chromaPass.uniforms.amount.value, hit * 0.6, 0.16);

  renderer.toneMappingExposure = THREE.MathUtils.clamp(0.86 + directorEnergy * 0.24 - mode.intro * 0.08, 0.72, 1.22);

  const camTargetX = Math.sin(elapsed * 0.23) * (0.4 + mode.build * 0.5 + mode.climax * 0.7);
  const camTargetY = 8.5 + Math.sin(elapsed * 0.31) * (0.16 + mode.groove * 0.22 + config.extreme * 0.25);
  camera.position.x = THREE.MathUtils.lerp(camera.position.x, camTargetX, 0.03);
  camera.position.y = THREE.MathUtils.lerp(camera.position.y, camTargetY, 0.03);
  camera.lookAt(0, 4.9 + mode.build * 0.4, 0);
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
  applyLightingDirection(dt, elapsed);
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

ui.loadBtn.addEventListener('click', async () => {
  try {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      audio.src = url;
      setStatus(`Loaded: ${file.name}`);
    };
    input.click();
  } catch (err) {
    setStatus(`Load error: ${err.message}`);
  }
});

ui.playBtn.addEventListener('click', async () => {
  try {
    setupAudioContext();
    if (audioCtx.state === 'suspended') await audioCtx.resume();
    await audio.play();
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
    recordStream = renderer.domElement.captureStream(60);
    recordedChunks = [];
    recorder = new MediaRecorder(recordStream, { mimeType: 'video/webm;codecs=vp9' });
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
});
