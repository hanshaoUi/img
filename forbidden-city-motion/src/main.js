import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { makeMaterials, buildWorld } from './world.js';
import { buildLines } from './blueprint.js';
import { buildParticles } from './particles.js';
import { buildHUD, updateHUD } from './hud.js';
import { textPlane, LATIN, HAN } from './type3d.js';
import { buildTimeline } from './timeline.js';

const W = 1920, H = 1080, DUR = 44;
const params = new URLSearchParams(location.search);
const RENDER = params.has('render');

const stage = document.getElementById('stage');
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, W / H, .1, 5000);
scene.fog = new THREE.FogExp2(0x0c1428, .0005);

// sky dome: ink blue zenith, a warm band at the horizon towards the key light
const sky = new THREE.Mesh(new THREE.SphereGeometry(2400, 48, 24), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { uWarm: { value: 0 } },
  vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform float uWarm; varying vec3 vD;
    void main(){ float h = vD.y; vec3 zen = vec3(.0012,.0022,.0065), mid = vec3(.003,.0055,.016), hor = vec3(.0045,.0075,.02);
      vec3 c = mix(hor, mid, smoothstep(0.0,.12,h)); c = mix(c, zen, smoothstep(.12,.55,h));
      float sun = pow(max(0., dot(vD, normalize(vec3(-.55,.1,.83)))), 5.0);
      c += vec3(.16,.07,.018) * sun * (.5 + 1.6 * uWarm) * smoothstep(-.05,.25,h + .05);
      float north = pow(max(0., -vD.z), 6.0) * smoothstep(0.0, .06, h) * exp(-max(h - .05, 0.) * 9.0);
      c += vec3(.09,.045,.015) * north * uWarm;
      gl_FragColor = vec4(c, 1.0); }`,
}));
scene.add(sky);

// light
const hemi = new THREE.HemisphereLight(0x2c3f70, 0x140a06, .55); scene.add(hemi);
const key = new THREE.DirectionalLight(0xffc48a, 3.4); key.position.set(-130, 120, 150); key.target.position.set(0, 0, -115);
key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -.0004; key.shadow.normalBias = .4;
Object.assign(key.shadow.camera, { left: -210, right: 210, top: 210, bottom: -210, near: 10, far: 700 });
scene.add(key, key.target);
const rim = new THREE.DirectionalLight(0x6d8cff, .45); rim.position.set(120, 80, -320); scene.add(rim);

// light shafts for the final shot
const shaftTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(255,200,130,0)'); gr.addColorStop(.35, 'rgba(255,200,130,.5)'); gr.addColorStop(1, 'rgba(255,200,130,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 256); const g2 = g.createLinearGradient(0, 0, 64, 0); return new THREE.CanvasTexture(c); })();
const shafts = new THREE.Group();
{ // one soft warm glow low on the northern horizon — atmosphere without geometry
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,170,90,.55)'); gr.addColorStop(.4, 'rgba(255,140,70,.16)'); gr.addColorStop(1, 'rgba(255,120,60,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(900, 260), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  m.position.set(0, 40, -420); m.visible = false; shafts.add(m);
}
scene.add(shafts);

// world
const M = makeMaterials();
const world = buildWorld(scene, M);
const lines = buildLines(world);
scene.add(lines.grid, lines.plan, lines.vert);
const particles = buildParticles(scene, world);

// final axis light: the first line of the film returns at the end
const axisGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, .25, 62), new THREE.Vector3(0, .25, -300)]);
const axisLine = new THREE.Line(axisGeo, new THREE.LineBasicMaterial({ color: new THREE.Color(1, .72, .35).multiplyScalar(3), toneMapped: false, transparent: true, opacity: 0 }));
scene.add(axisLine);

// post
const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.setPixelRatio(1); composer.setSize(W, H);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), .9, .55, .82); composer.addPass(bloom);
composer.addPass(new OutputPass());
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uGrain: { value: .05 }, uVig: { value: .9 }, uCA: { value: .0015 }, uFade: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uGrain, uVig, uCA, uFade; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){ vec2 d = vUv - .5; float r = dot(d,d);
      vec3 c = vec3(texture2D(tDiffuse, vUv - d * uCA).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv + d * uCA).b);
      c *= 1.0 - uVig * smoothstep(.08, .7, r * 1.5);
      c += (h(vUv * vec2(1920., 1080.) + fract(uTime * 7.13) * 91.7) - .5) * uGrain;
      gl_FragColor = vec4(c * (1.0 - uFade), 1.0); }`,
});
composer.addPass(grade);

// 3D typography
const type3d = { forbidden: [], chars: [] };
async function buildType() {
  await Promise.all(['200', '300', '500', '700'].map(w => document.fonts.load(`${w} 40px Inter`)).concat(['300', '700', '900'].map(w => document.fonts.load(`${w} 40px "Noto Sans SC"`, '紫禁城午门太和殿'))));
  'FORBIDDEN'.split('').forEach((ch, i) => {
    const p = textPlane(ch, { font: LATIN, weight: 700, px: 260, height: 9, color: '#f3e9d6', glow: 1.7, pad: .05 });
    p.userData.home = new THREE.Vector3(-38.4 + i * 9.6, 31, -17); p.position.copy(p.userData.home); scene.add(p); type3d.forbidden.push(p);
  });
  [['紫', -12, 3.1, 3.3], ['禁', 0, 3.5, 4.3], ['城', 12, 3.1, 3.3]].forEach(([ch, x, y, h]) => {
    const p = textPlane(ch, { font: HAN, weight: 900, px: 300, height: h, color: '#ffc15a', glow: 1.6, pad: .02 });
    p.userData.home = new THREE.Vector3(x, y, -5); p.position.copy(p.userData.home); scene.add(p); type3d.chars.push(p);
  });
  type3d.wall = textPlane('MERIDIAN GATE   ·   1420   ·   39.9127° N  116.3913° E', { font: LATIN, weight: 500, px: 90, height: .85, color: '#f1dcb0', glow: 1.4, align: 'left', spacing: 14 });
  type3d.wall.position.set(-type3d.wall.userData.width / 2, 9.3, 7.08); scene.add(type3d.wall);
  const info = [['午门 · MERIDIAN GATE', -9.5, 6.5, 22, 'left'], ['太和门 · GATE OF SUPREME HARMONY', 7, 9.5, -18, 'left'], ['72 HA   ·   980 BUILDINGS', -15, 11, -58, 'left'], ['1406 — 1420', 12, 15, -70, 'left']];
  type3d.info = info.map(([s, x, y, z, a]) => { const p = textPlane(s, { font: LATIN, weight: 300, px: 110, height: 1.6, color: '#efe6d2', glow: 1.3, align: a, spacing: 18 }); p.position.set(x, y, z); if (x > 0) p.position.x -= p.userData.width; scene.add(p); return p; });
}

const H_ = buildHUD(stage);
const ctx = { THREE, DUR, scene, camera, renderer, composer, bloom, grade, key, hemi, sky, shafts, M, world, lines, particles, type3d, H: H_, axisLine };

await buildType();
const TL = buildTimeline(ctx);
const { tl, ptl, apply } = TL;

function renderAt(t) {
  t = Math.max(0, Math.min(DUR - 1e-4, t));
  // the particle timeline is sampled twice: once for the trail tails, once for the heads
  ptl.seek(Math.max(0, t - .12), false); TL.captureParticlePrev();
  ptl.seek(t, false);
  tl.seek(t, false);
  apply(t);
  updateHUD(H_, t, camera, ctx);
  composer.render();
}
window.renderAt = renderAt;
window.__ctx = ctx;
window.DUR = DUR;

// fit the 1920×1080 stage to the window
function fit() { const s = Math.min((innerWidth - 32) / W, (innerHeight - 32) / H); stage.style.transform = `translate(-50%,-50%) scale(${s})`; }
if (!RENDER) { addEventListener('resize', fit); fit(); } else document.body.classList.add('render');

if (RENDER) { renderAt(0); window.__ready = true; }
else {
  const audio = document.getElementById('score'), gate = document.getElementById('gate');
  let start = null;
  const loop = () => { const t = audio && !audio.paused ? audio.currentTime : start ? (performance.now() - start) / 1000 % DUR : 0; renderAt(t); requestAnimationFrame(loop); };
  gate.addEventListener('click', () => { gate.classList.add('gone'); audio.currentTime = 0; audio.play().catch(() => { start = performance.now(); }); });
  audio?.addEventListener('ended', () => { audio.currentTime = 0; audio.play(); });
  renderAt(41.9); // poster frame until the viewer presses play
  gate.addEventListener('click', () => requestAnimationFrame(loop), { once: true });
}
