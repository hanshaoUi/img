// Screen-space layers: the editorial HUD frame, 3D-anchored labels and interface rings,
// the abstract geometry composition (sequence 05), the letter mask (06) and the final title.
import * as THREE from 'three';

const NS = 'http://www.w3.org/2000/svg';
export function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e); return e;
}
function div(cls, html, parent) { const d = document.createElement('div'); d.className = cls; if (html != null) d.innerHTML = html; parent.appendChild(d); return d; }
const circlePath = (cx, cy, r) => `M${cx - r},${cy} A${r},${r} 0 1,1 ${cx + r},${cy} A${r},${r} 0 1,1 ${cx - r},${cy} Z`;

export const SEQS = [
  [0, 'ORIGIN', '起'], [6.4, 'ASSEMBLY', '构'], [11.4, 'AXIS', '轴'], [16.4, 'EXPLODED', '解'],
  [21.8, 'GEOMETRY', '形'], [26.2, 'TYPE', '字'], [31, 'PARTICLE', '散'], [38, 'MONUMENT', '成'],
];

export function buildHUD(root) {
  const H = {};
  const svg = root.querySelector('#hud'), type = root.querySelector('#type');
  // ---------------------------------------------------------------- frame
  const frame = el('g', { class: 'frame' }, svg); H.frame = frame;
  for (const [x, y, sx, sy] of [[56, 56, 1, 1], [1864, 56, -1, 1], [56, 1024, 1, -1], [1864, 1024, -1, -1]])
    el('path', { d: `M${x},${y + sy * 26} L${x},${y} L${x + sx * 26},${y}`, class: 'hair' }, frame);
  el('line', { x1: 56, y1: 1040, x2: 1864, y2: 1040, class: 'hair dim' }, frame);
  H.progress = el('line', { x1: 56, y1: 1040, x2: 56, y2: 1040, class: 'hair gold' }, frame);
  H.frameText = div('frametext', `
    <div class="tl"><b>紫禁城</b><span>FORBIDDEN CITY — A PROCEDURAL STUDY</span></div>
    <div class="tr"><span class="seqnum"></span><span class="seqname"></span></div>
    <div class="bl"><span class="coord"></span></div>
    <div class="br"><span class="tc"></span></div>`, type);
  H.seqnum = H.frameText.querySelector('.seqnum'); H.seqname = H.frameText.querySelector('.seqname');
  H.coord = H.frameText.querySelector('.coord'); H.tc = H.frameText.querySelector('.tc');
  // ---------------------------------------------------------------- blueprint overlays (seq 01)
  const bp = el('g', { class: 'bp', opacity: 0 }, svg); H.bp = bp;
  el('line', { x1: 940, y1: 540, x2: 980, y2: 540, class: 'hair' }, bp); el('line', { x1: 960, y1: 520, x2: 960, y2: 560, class: 'hair' }, bp);
  H.bpCircle = el('circle', { cx: 960, cy: 540, r: 90, class: 'hair dash' }, bp);
  H.scalebar = el('g', {}, bp);
  el('line', { x1: 1560, y1: 960, x2: 1760, y2: 960, class: 'hair' }, H.scalebar);
  for (let i = 0; i <= 4; i++) el('line', { x1: 1560 + i * 50, y1: 954, x2: 1560 + i * 50, y2: i % 2 ? 960 : 966, class: 'hair' }, H.scalebar);
  H.bpText = div('bptext', `<div class="k">AXIS</div><div class="v"><span class="axisnum">0.0</span> KM</div><div class="k">N 39°54′57″ · E 116°23′50″</div>`, type);
  H.axisnum = H.bpText.querySelector('.axisnum');
  H.scaleText = div('scaletext', '0 &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; 300 M', type);
  // ---------------------------------------------------------------- anchored labels (plan + fly-through + exploded)
  H.anchors = [];
  const anchor = (world, html, cls = '') => {
    const wrap = div('anchor ' + cls, null, type), inner = div('inner', html, wrap);
    const a = { wrap, inner, world, visible: true }; H.anchors.push(a); return a;
  };
  H.planLabels = [
    anchor(new THREE.Vector3(0, 0, 8), '<i>01</i>午门<em>MERIDIAN GATE</em>', 'plan'),
    anchor(new THREE.Vector3(0, 0, -32), '<i>02</i>太和门<em>GATE OF SUPREME HARMONY</em>', 'plan'),
    anchor(new THREE.Vector3(0, 0, -100), '<i>03</i>太和殿<em>HALL OF SUPREME HARMONY</em>', 'plan'),
    anchor(new THREE.Vector3(0, 0, -124), '<i>04</i>中和殿<em>HALL OF CENTRAL HARMONY</em>', 'plan'),
    anchor(new THREE.Vector3(0, 0, -146), '<i>05</i>保和殿<em>HALL OF PRESERVING HARMONY</em>', 'plan'),
    anchor(new THREE.Vector3(0, 0, -212), '<i>06</i>乾清宫<em>PALACE OF HEAVENLY PURITY</em>', 'plan'),
  ];
  // rotating interface rings attached to architecture during the fly-through
  H.rings = [];
  const ringDefs = [[new THREE.Vector3(0, 21, 0), '午门', 'MERIDIAN GATE', '39.9127° N'], [new THREE.Vector3(0, 12, -32), '太和门', 'GATE OF SUPREME HARMONY', 'EST. 1420'], [new THREE.Vector3(0, 26, -100), '太和殿', 'HALL OF SUPREME HARMONY', '35.05 M']];
  for (const [w, zh, en, meta] of ringDefs) {
    const g = el('g', { class: 'ring', opacity: 0 }, svg);
    const spin = el('g', {}, g);
    el('circle', { cx: 0, cy: 0, r: 70, class: 'hair gold dash' }, spin);
    el('circle', { cx: 0, cy: 0, r: 86, class: 'hair dim' }, g);
    for (let i = 0; i < 36; i++) { const a = i / 36 * Math.PI * 2, r0 = 92, r1 = i % 9 ? 96 : 104; el('line', { x1: Math.cos(a) * r0, y1: Math.sin(a) * r0, x2: Math.cos(a) * r1, y2: Math.sin(a) * r1, class: 'hair' }, spin); }
    el('line', { x1: 86, y1: 0, x2: 160, y2: -60, class: 'hair' }, g); el('line', { x1: 160, y1: -60, x2: 330, y2: -60, class: 'hair' }, g);
    const lab = anchor(w, `<b>${zh}</b><em>${en}</em><span>${meta}</span>`, 'ringlabel');
    H.rings.push({ g, spin, world: w, label: lab });
  }
  // exploded-axonometric labels
  H.explode = el('g', { class: 'explode', opacity: 0 }, svg);
  H.xLabels = [];
  const xl = [['01', '重檐庑殿顶', 'UPPER EAVE · HIP ROOF'], ['02', '下檐', 'LOWER EAVE'], ['03', '斗拱 · 额枋', 'BRACKET & BEAM BAND'],
              ['04', '柱网 11 × 5', 'COLUMN GRID · 72 PILLARS'], ['05', '槅扇门', 'LATTICE DOOR WALLS'], ['06', '三台 · 须弥座', 'TRIPLE MARBLE TERRACE · 8.13 M']];
  for (const [n, zh, en] of xl) {
    const a = anchor(new THREE.Vector3(), `<i>${n}</i><b>${zh}</b><em>${en}</em><span class="xyz"></span>`, 'xlabel');
    const line = el('line', { class: 'hair' }, H.explode), dot = el('circle', { r: 3.5, class: 'dot' }, H.explode);
    H.xLabels.push({ a, line, dot, xyz: a.inner.querySelector('.xyz') });
  }
  // ---------------------------------------------------------------- 05 · abstract geometry
  const ab = root.querySelector('#abstract'); H.abstract = ab;
  H.abBg = el('rect', { x: 0, y: 0, width: 1920, height: 1080, fill: '#05080f', opacity: 0 }, ab);
  H.abGrid = el('g', { opacity: 0 }, ab); H.gridV = []; H.gridH = [];
  for (let i = 1; i < 9; i++) H.gridV.push(el('line', { x1: i * 1920 / 9, y1: 0, x2: i * 1920 / 9, y2: 1080, class: 'hair blue' }, H.abGrid));
  for (let i = 1; i < 5; i++) H.gridH.push(el('line', { x1: 0, y1: i * 216, x2: 1920, y2: i * 216, class: 'hair blue' }, H.abGrid));
  H.abCurves = [];
  for (let k = 0; k < 5; k++) {
    let d = ''; for (let i = 0; i <= 96; i++) { const x = i * 20, y = 540 + Math.sin(i / 96 * Math.PI * (2 + k * .5) + k) * (120 + k * 55) * Math.sin(i / 96 * Math.PI); d += (i ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1); }
    H.abCurves.push(el('path', { d, class: 'hair ivory', opacity: .5 - k * .07 }, ab));
  }
  H.abRadials = el('g', {}, ab);
  for (let i = 0; i < 72; i++) { const a = i / 72 * Math.PI * 2, r0 = 70, r1 = i % 9 ? 470 : 640; el('line', { x1: 960 + Math.cos(a) * r0, y1: 540 + Math.sin(a) * r0, x2: 960 + Math.cos(a) * r1, y2: 540 + Math.sin(a) * r1, class: 'hair gold', opacity: i % 9 ? .35 : .8 }, H.abRadials); }
  H.abRings = [];
  for (let k = 0; k < 9; k++) { const r = 60 * Math.pow(1.8, k / 2); H.abRings.push(el('path', { d: circlePath(960, 540, r), class: 'hair gold' + (k % 3 === 1 ? ' dash' : ''), 'data-r': r }, ab)); }
  H.abDots = el('g', {}, ab); H.dots = [];
  for (let i = 0; i < 180; i++) H.dots.push(el('circle', { r: i % 7 ? 1.6 : 2.6, fill: i % 5 ? '#f1d9a4' : '#ffffff' }, H.abDots));
  H.abDisc = el('circle', { cx: 960, cy: 540, r: 1300, fill: '#ffc45a', opacity: 0 }, ab);
  H.abText = div('abtext', `<div class="ratio">9<span>:</span>5</div><div class="cap">九五 · THE IMPERIAL RATIO</div>`, type);
  H.abFacts = [['72', 'HECTARES', 640, 250], ['980', 'BUILDINGS', 1330, 300], ['1420', 'COMPLETED', 600, 820], ['7.8', 'KM CENTRAL AXIS', 1350, 800]]
    .map(([n, l, x, y]) => { const d = div('fact', `<b>${n}</b><span>${l}</span>`, type); d.style.left = x + 'px'; d.style.top = y + 'px'; return d; });
  H.abReveal = div('reveal', 'EVERY FORM · DERIVED FROM THE PLAN', type);
  // ---------------------------------------------------------------- 06 · letters as masks
  const mk = root.querySelector('#mask');
  const defs = el('defs', {}, mk), m = el('mask', { id: 'lettermask', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: 1920, height: 1080 }, defs);
  el('rect', { x: 0, y: 0, width: 1920, height: 1080, fill: 'white' }, m);
  H.maskChars = []; H.outlineChars = [];
  H.maskRect = el('rect', { x: 0, y: 0, width: 1920, height: 1080, fill: '#04070e', mask: 'url(#lettermask)', opacity: 0 }, mk);
  const outline = el('g', { opacity: 0 }, mk); H.maskOutline = outline;
  '紫禁城'.split('').forEach((ch, i) => {
    const x = 960 + (i - 1) * 520;
    H.maskChars.push(el('text', { x, y: 560, 'text-anchor': 'middle', 'dominant-baseline': 'central', class: 'maskchar', fill: 'black' }, m));
    H.outlineChars.push(el('text', { x, y: 560, 'text-anchor': 'middle', 'dominant-baseline': 'central', class: 'maskchar outline' }, outline));
    H.maskChars[i].textContent = ch; H.outlineChars[i].textContent = ch;
  });
  H.maskCaption = div('maskcap', '<span>THE</span><span>PURPLE</span><span>FORBIDDEN</span><span>CITY</span>', type);
  // ---------------------------------------------------------------- 08 · title
  H.title = div('title', `<div class="zh">紫禁城</div><div class="rule"></div><div class="en">THE FORBIDDEN CITY</div><div class="meta">BEIJING &nbsp;·&nbsp; 1420</div>`, type);
  H.flash = div('flash', '', type);
  return H;
}

// per-frame: project 3D anchors, counters, frame text
const v = new THREE.Vector3();
export function project(world, camera) {
  v.copy(world).project(camera);
  return { x: (v.x * .5 + .5) * 1920, y: (-v.y * .5 + .5) * 1080, on: v.z < 1 && v.z > -1 };
}
export function updateHUD(H, t, camera, ctx) {
  for (const a of H.anchors) {
    if (a.manual) continue;
    const p = project(a.world, camera);
    a.wrap.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
    a.wrap.style.display = p.on ? '' : 'none';
  }
  H.rings.forEach((r, i) => {
    const p = project(r.world, camera);
    const d = camera.position.distanceTo(r.world), s = THREE.MathUtils.clamp(60 / d, .35, 1.6);
    r.g.setAttribute('transform', `translate(${p.x.toFixed(1)},${p.y.toFixed(1)}) scale(${s.toFixed(3)})`);
    r.spin.setAttribute('transform', `rotate(${(t * 40 * (i % 2 ? -1 : 1)) % 360})`);
    r.label.wrap.style.transform = `translate(${(p.x + 330 * s).toFixed(1)}px, ${(p.y - 60 * s).toFixed(1)}px)`;
    r.label.wrap.style.display = p.on ? '' : 'none';
  });
  // frame text
  const s = SEQS.reduce((acc, q, i) => t >= q[0] ? i : acc, 0);
  H.seqnum.textContent = `${String(s + 1).padStart(2, '0')} / 08`;
  H.seqname.textContent = `${SEQS[s][2]}  ${SEQS[s][1]}`;
  const f = Math.floor(t * 30);
  H.tc.textContent = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t) % 60).padStart(2, '0')}:${String(f % 30).padStart(2, '0')}`;
  const lat = 39.9163 + (-(camera.position.z + 100)) * 2.7e-5, lon = 116.3972 + camera.position.x * 3.5e-5;
  H.coord.textContent = `${lat.toFixed(4)}° N   ${lon.toFixed(4)}° E   EL ${(camera.position.y * 3).toFixed(1)} M`;
  H.progress.setAttribute('x2', (56 + 1808 * t / ctx.DUR).toFixed(1));
  H.axisnum.textContent = (7.8 * Math.min(1, Math.max(0, (t - .6) / 1.1))).toFixed(1);
  // orbiting dots in the abstract composition
  if (ctx.S.abDots > 0) H.dots.forEach((d, i) => {
    const ring = i % 9, r = 60 * Math.pow(1.8, ring / 2) * ctx.S.abDotR, a = i * 2.39996 + t * (.25 + (i % 5) * .06) * (ring % 2 ? 1 : -1);
    d.setAttribute('cx', (960 + Math.cos(a) * r).toFixed(1)); d.setAttribute('cy', (540 + Math.sin(a) * r).toFixed(1));
  });
  H.abDots.setAttribute('opacity', ctx.S.abDots);
}
export { circlePath };
