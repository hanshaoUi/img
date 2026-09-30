// Procedural Forbidden City.
// Everything here is generated from a handful of numbers: roofs are lofted surfaces with
// concave profiles and upturned corners, halls are assembled from platform / column grid /
// walls / beam band / roofs, and the whole complex is laid out along one north–south axis.
// 1 unit ≈ 3 m. The axis runs along -z (north), the Meridian Gate sits at z = 0.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const PAL = {
  red: 0x8a1a12, redDeep: 0x5e0f0a, gold: 0xd9a23a, ink: 0x060a14, midnight: 0x0b1530,
  jade: 0x2b6f62, ivory: 0xefe6d2, marble: 0xd6cdbd,
};

export function rng(seed) {
  return () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// ------------------------------------------------------------------ textures
function canvasTex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4; return t;
}
function tileTexture() { // glazed cylindrical tiles running down the slope
  return canvasTex(128, 128, (g, w, h) => {
    for (let i = 0; i < 4; i++) {
      const gr = g.createLinearGradient(i * 32, 0, i * 32 + 32, 0);
      gr.addColorStop(0, '#6b4310'); gr.addColorStop(.18, '#c98f2a'); gr.addColorStop(.45, '#ffd98a'); gr.addColorStop(.7, '#c58a25'); gr.addColorStop(1, '#5a3508');
      g.fillStyle = gr; g.fillRect(i * 32, 0, 32, h);
    }
    g.fillStyle = 'rgba(40,20,0,.35)'; for (let y = 0; y < h; y += 32) g.fillRect(0, y, w, 3);
  });
}
function latticeTexture(glow) { // door / window leaves; the glow version lights the lattice from inside
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = glow ? '#000' : '#6a130c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) {
      const x = i * 64 + 6, ww = 52;
      if (!glow) { g.strokeStyle = 'rgba(214,160,70,.55)'; g.lineWidth = 3; g.strokeRect(x, 14, ww, h - 28); }
      g.save(); g.beginPath(); g.rect(x + 5, 28, ww - 10, 120); g.clip();
      g.fillStyle = glow ? '#ffb257' : '#3a0905'; g.fillRect(x + 5, 28, ww - 10, 120);
      g.strokeStyle = glow ? '#000' : 'rgba(214,160,70,.8)'; g.lineWidth = glow ? 3 : 2;
      for (let k = -140; k < 140; k += 10) { g.beginPath(); g.moveTo(x + k, 28); g.lineTo(x + k + 120, 148); g.moveTo(x + k + 120, 28); g.lineTo(x + k, 148); g.stroke(); }
      g.restore();
      if (!glow) { g.fillStyle = 'rgba(214,160,70,.35)'; g.fillRect(x + 8, 170, ww - 16, 50); }
    }
  });
}

export function makeMaterials() {
  const tile = tileTexture();
  const lat = latticeTexture(false), latGlow = latticeTexture(true);
  const M = {
    roof: new THREE.MeshStandardMaterial({ color: 0xffc24e, map: tile, metalness: .15, roughness: .55, emissive: 0x7a4200, emissiveIntensity: .7, emissiveMap: tile, side: THREE.DoubleSide }),
    ridge: new THREE.MeshStandardMaterial({ color: 0xf0b848, metalness: .6, roughness: .3, emissive: 0x6a3a00, emissiveIntensity: 1 }),
    red: new THREE.MeshStandardMaterial({ color: PAL.red, roughness: .78 }),
    column: new THREE.MeshStandardMaterial({ color: 0x9a1d12, roughness: .55 }),
    door: new THREE.MeshStandardMaterial({ color: 0xffffff, map: lat, emissiveMap: latGlow, emissive: 0xffa040, emissiveIntensity: .0, roughness: .7 }),
    marble: new THREE.MeshStandardMaterial({ color: 0xcfc3ad, roughness: .85 }),
    jade: new THREE.MeshStandardMaterial({ color: PAL.jade, roughness: .45, emissive: 0x0b2a24, emissiveIntensity: 1 }),
    finial: new THREE.MeshStandardMaterial({ color: 0xffc657, metalness: .9, roughness: .18, emissive: 0x7a4400, emissiveIntensity: 1.2 }),
    ground: new THREE.MeshStandardMaterial({ color: 0x131822, roughness: .96 }),
    paving: new THREE.MeshStandardMaterial({ color: 0x3a3a3e, roughness: .9 }),
    path: new THREE.MeshStandardMaterial({ color: 0xbdb3a2, roughness: .85 }),
    water: new THREE.MeshStandardMaterial({ color: 0x06121c, roughness: .08, metalness: .9 }),
    tunnel: new THREE.MeshStandardMaterial({ color: 0x2a0806, roughness: 1 }),
    goldLine: new THREE.LineBasicMaterial({ color: new THREE.Color(1, .66, .26).multiplyScalar(1.8), toneMapped: false, transparent: true, opacity: 0, depthWrite: false }),
    jadeLine: new THREE.LineBasicMaterial({ color: new THREE.Color(.25, .95, .75).multiplyScalar(1.4), toneMapped: false, transparent: true, opacity: .8, depthWrite: false }),
  };
  for (const k in M) M[k].name = k;
  return M;
}

// ------------------------------------------------------------------ geometry helpers
function box(w, h, d, uvUnit = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (uvUnit) { // stretch door lattice so leaves keep their proportions
    const uv = g.attributes.uv;
    for (let f = 0; f < 6; f++) {
      const along = f < 2 ? d : w; // faces: +x,-x,+y,-y,+z,-z
      for (let i = 0; i < 4; i++) uv.setX(f * 4 + i, uv.getX(f * 4 + i) * Math.max(1, Math.round(along / uvUnit)));
    }
  }
  return g;
}
function mesh(g, m, cast = true) { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = true; return o; }

// Lofted hip roof (庑殿顶). s: 0 = eave ring, 1 = ridge.
// Concave profile y = H(0.28 s + 0.72 s²), corners lift and flare outwards near the eaves.
export function roofGeometry(W, D, H, o = {}) {
  const ov = o.overhang ?? (1.2 + D * .12), s0 = o.s0 ?? 0, s1 = o.s1 ?? 1;
  const rings = o.rings ?? 8, per = o.perSide ?? 14, lift = o.lift ?? (1 + D * .07), flare = o.flare ?? (.6 + D * .05);
  const A0 = W / 2 + ov, B0 = D / 2 + ov;
  const A1 = o.pyramid ? .02 : Math.max(.02, (W - D) / 2), B1 = .02;
  const unit = [];
  for (let side = 0; side < 4; side++) for (let i = 0; i < per; i++) {
    const q = -1 + 2 * i / per;
    unit.push(side === 0 ? [q, 1] : side === 1 ? [1, -q] : side === 2 ? [-q, -1] : [-1, q]);
  }
  const P = unit.length, pos = [], uv = [], idx = [];
  const at = (ux, uz, s) => {
    const A = THREE.MathUtils.lerp(A0, A1, s), B = THREE.MathUtils.lerp(B0, B1, s);
    const c = Math.pow(THREE.MathUtils.smoothstep(Math.min(Math.abs(ux), Math.abs(uz)), .45, 1), 2);
    const e = Math.pow(1 - s, 2.2);
    return [ux * A + Math.sign(ux) * flare * c * e, H * (.28 * s + .72 * s * s) + lift * c * e, uz * B + Math.sign(uz) * flare * c * e];
  };
  let per0 = [0]; for (let i = 1; i <= P; i++) { const a = at(...unit[i - 1], 0), b = at(...unit[i % P], 0); per0.push(per0[i - 1] + Math.hypot(a[0] - b[0], a[2] - b[2])); }
  for (let j = 0; j <= rings; j++) {
    const s = s0 + (s1 - s0) * j / rings;
    for (let i = 0; i <= P; i++) { const p = at(...unit[i % P], s); pos.push(...p); uv.push(per0[i] / 2.4, s * H / 1.6); }
  }
  for (let j = 0; j < rings; j++) for (let i = 0; i < P; i++) {
    const a = j * (P + 1) + i, b = a + 1, c = a + P + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  // gold edges: eave ring + four hip ridges + main ridge
  const lines = [];
  if (s0 === 0) for (let i = 0; i < P; i++) lines.push(...at(...unit[i], 0), ...at(...unit[(i + 1) % P], 0));
  for (const cu of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) for (let j = 0; j < rings; j++) {
    const sa = s0 + (s1 - s0) * j / rings, sb = s0 + (s1 - s0) * (j + 1) / rings;
    lines.push(...at(cu[0], cu[1], sa), ...at(cu[0], cu[1], sb));
  }
  if (s1 >= 1 && !o.pyramid) lines.push(-A1, H, 0, A1, H, 0);
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
  return { geometry: g, lines: lg, A1, top: H, eaveY: lift };
}

// A roof split into horizontal bands so it can assemble tile-row by tile-row.
function roof(M, W, D, H, o = {}) {
  const group = new THREE.Group(), bands = [];
  const n = o.bands ?? 1, s0 = o.s0 ?? 0, s1 = o.s1 ?? 1;
  let info;
  for (let b = 0; b < n; b++) {
    const r = roofGeometry(W, D, H, { ...o, s0: s0 + (s1 - s0) * b / n, s1: s0 + (s1 - s0) * (b + 1) / n, rings: Math.max(2, Math.round((o.rings ?? 8) / n)) });
    if (b === 0) info = r;
    const m = mesh(r.geometry, M.roof); group.add(m); bands.push(m);
  }
  const full = roofGeometry(W, D, H, o);
  const edges = new THREE.LineSegments(full.lines, M.goldLine); group.add(edges);
  let ridge = null;
  if (s1 >= 1) {
    ridge = new THREE.Group();
    if (!o.pyramid) {
      ridge.add(mesh(box(full.A1 * 2 + 1.4, 1.1, .9), M.ridge));
      for (const sx of [-1, 1]) { const e = mesh(box(.9, 2.6, 1.5), M.ridge); e.position.set(sx * (full.A1 + .7), 1, 0); ridge.add(e); }
    }
    ridge.position.y = H + .4; group.add(ridge);
  }
  return { group, bands, edges, ridge, top: H, info: full };
}

// ------------------------------------------------------------------ halls
// Returns a group whose origin is the centre of the hall's footprint on its base.
export function hall(M, o) {
  const { w, d, colH, double = false, pyramid = false, platformH = 1, pm = 2.2, open = false, doorGap = 0, finial = false, bands = 1 } = o;
  const bays = o.bays ?? Math.max(3, Math.round(w / 4.3));
  const g = new THREE.Group(), parts = { walls: [], lowerRoof: null, upperRoof: null };
  const plat = mesh(box(w + 2 * pm, platformH, d + 2 * pm), M.marble); plat.position.y = platformH / 2; g.add(plat); parts.platform = plat;
  const y0 = platformH;
  // column grid
  const r = .26 + colH * .028, cols = [];
  const xs = Array.from({ length: bays + 1 }, (_, i) => -w / 2 + .7 + (w - 1.4) * i / bays);
  const nz = Math.max(2, Math.round(d / 4.3));
  for (const x of xs) for (const z of [d / 2 - .7, -d / 2 + .7]) cols.push([x, z]);
  for (let k = 1; k < nz; k++) { const z = -d / 2 + .7 + (d - 1.4) * k / nz; cols.push([xs[0], z], [xs[bays], z]); }
  const colMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(r, r * 1.06, colH, 12), M.column, cols.length);
  colMesh.castShadow = true; colMesh.receiveShadow = true;
  const mtx = new THREE.Matrix4();
  cols.forEach(([x, z], i) => colMesh.setMatrixAt(i, mtx.makeTranslation(x, y0 + colH / 2, z)));
  colMesh.userData.base = cols.map(([x, z]) => new THREE.Vector3(x, y0 + colH / 2, z));
  g.add(colMesh); parts.columns = colMesh;
  // walls, set back behind the colonnade
  const ins = 2.4, wy = y0 + colH / 2;
  const addWall = (geo, mat, x, z, dir) => { const m = mesh(geo, mat); m.position.set(x, wy, z); m.userData.dir = dir; m.userData.home = m.position.clone(); g.add(m); parts.walls.push(m); };
  if (!open) addWall(box(w - 2 * ins, colH, .6, 3.2), M.door, 0, d / 2 - ins, new THREE.Vector3(0, 0, 1));
  if (doorGap > 0) {
    const half = (w - 2 * ins - doorGap) / 2;
    for (const sx of [-1, 1]) addWall(box(half, colH, .6, 3.2), M.door, sx * (doorGap / 2 + half / 2), open ? 0 : -(d / 2 - ins), new THREE.Vector3(sx, 0, 0));
  } else addWall(box(w - 2 * ins, colH, .6), M.red, 0, -(d / 2 - ins), new THREE.Vector3(0, 0, -1));
  for (const sx of [-1, 1]) addWall(box(.6, colH, d - 2 * ins), M.red, sx * (w / 2 - ins), 0, new THREE.Vector3(sx, 0, 0));
  // painted beam band (the jade accent)
  const beam = new THREE.Group(); // painted beam ring
  for (const [bw, bd, bx, bz] of [[w - .2, 1.2, 0, d / 2 - .7], [w - .2, 1.2, 0, -d / 2 + .7], [1.2, d - .2, w / 2 - .7, 0], [1.2, d - .2, -w / 2 + .7, 0]]) { const b = mesh(box(bw, 1.1, bd), M.jade); b.position.set(bx, 0, bz); beam.add(b); }
  beam.position.y = y0 + colH + .55; g.add(beam); parts.beam = beam;
  let y = y0 + colH + 1.1;
  if (double) {
    const lr = roof(M, w, d, d * .42, { s1: .5, bands });
    lr.group.position.y = y - .2; g.add(lr.group); parts.lowerRoof = lr;
    const drumH = d * .42 * .4 + 1.4;
    const drum = mesh(box(w * .74, drumH, d * .58, 3.2), M.door); drum.position.y = y + drumH / 2; g.add(drum); parts.drum = drum;
    y += drumH - .3;
    const W2 = w * .86, D2 = d * .72;
    const ur = roof(M, W2, D2, D2 * .47, { bands, pyramid }); ur.group.position.y = y; g.add(ur.group); parts.upperRoof = ur;
    y += ur.top;
  } else {
    const ur = roof(M, w, d, (pyramid ? w * .5 : d * .45), { bands, pyramid }); ur.group.position.y = y - .2; g.add(ur.group); parts.upperRoof = ur;
    y += ur.top - .2;
  }
  if (finial) {
    const f = new THREE.Group();
    const ball = mesh(new THREE.SphereGeometry(1.25, 32, 20), M.finial); ball.position.y = 1.7; f.add(ball);
    f.add(mesh(new THREE.CylinderGeometry(.5, 1.1, 1.2, 16), M.finial));
    f.position.y = y; g.add(f); parts.finial = f; parts.finialBall = ball;
  }
  g.userData = { parts, height: y + 2, w: w + 2 * pm, d: d + 2 * pm };
  return g;
}

// ------------------------------------------------------------------ batched background architecture
// Static buildings are merged into a few meshes; a per-vertex delay lets them rise in a wave.
class Batch {
  constructor() { this.geo = {}; this.lines = []; }
  add(key, geometry, matrix, baseY, delay) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    g.applyMatrix4(matrix);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    const n = g.attributes.position.count;
    g.setAttribute('aBase', new THREE.Float32BufferAttribute(new Float32Array(n).fill(baseY), 1));
    g.setAttribute('aDelay', new THREE.Float32BufferAttribute(new Float32Array(n).fill(delay), 1));
    (this.geo[key] ||= []).push(g);
  }
  addObject(obj, key, baseY, delay) { obj.updateMatrixWorld(true); obj.traverse(o => { if (o.isMesh && !o.isInstancedMesh) this.add(key(o), o.geometry, o.matrixWorld, baseY, delay); }); }
}
function risePatch(mat, U) {
  const m = mat.clone();
  m.onBeforeCompile = sh => {
    sh.uniforms.uRise = U.uRise;
    sh.vertexShader = 'attribute float aBase;\nattribute float aDelay;\nuniform float uRise;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float rk = clamp((uRise - aDelay) / 0.9, 0.0, 1.0); rk = 1.0 - pow(1.0 - rk, 3.0);
      transformed.y = rk <= 0.0 ? -6.0 : aBase + (transformed.y - aBase) * rk;`);
  };
  m.customProgramCacheKey = () => 'rise-' + mat.uuid;
  return m;
}

// ------------------------------------------------------------------ the complex
export function buildWorld(scene, M) {
  const W = { heroes: {}, footprints: [], verticals: [], anchors: {}, uniforms: { uRise: { value: 0 } } };
  const batch = new Batch(), R = rng(1420);
  const keyOf = o => o.material === M.roof ? 'roof' : o.material === M.ridge ? 'ridge' : o.material === M.marble ? 'marble' : o.material === M.jade ? 'jade' : o.material === M.door ? 'door' : 'red';
  const foot = (x, z, w, d, h, kind = 'hall', rot = 0) => {
    if (rot) [w, d] = [d, w];
    W.footprints.push({ x, z, w, d, h, kind });
  };
  // ground, courts and the imperial path
  const ground = mesh(new THREE.PlaneGeometry(5000, 5000), M.ground, false); ground.rotation.x = -Math.PI / 2; scene.add(ground);
  const court = (x, z, w, d, m = M.paving) => { const p = mesh(new THREE.PlaneGeometry(w, d), m, false); p.rotation.x = -Math.PI / 2; p.position.set(x, .02, z); scene.add(p); };
  court(0, -110, 232, 344);
  const path = mesh(box(3.2, .12, 380), M.path, false); path.position.set(0, .06, -110); scene.add(path);

  // Hero groups that animate part by part. rise = 0..1 scales them out of the ground.
  const hero = (name, obj, x, y, z, rot = 0) => { obj.position.set(x, y, z); obj.rotation.y = rot; scene.add(obj); W.heroes[name] = obj; obj.userData.home = obj.position.clone(); return obj; };

  // ---- Meridian Gate 午门: U-shaped red base with three real tunnels, tower + wings + pavilions
  const wu = new THREE.Group();
  const s = new THREE.Shape(); const BH = 11;
  s.moveTo(-33, 0);
  for (const [cx, aw, sh] of [[-12, 3.8, 4.6], [0, 5, 5], [12, 3.8, 4.6]]) { s.lineTo(cx - aw / 2, 0); s.lineTo(cx - aw / 2, sh); s.absarc(cx, sh, aw / 2, Math.PI, 0, true); s.lineTo(cx + aw / 2, 0); }
  s.lineTo(33, 0); s.lineTo(33, BH); s.lineTo(-33, BH); s.closePath();
  const baseGeo = new THREE.ExtrudeGeometry(s, { depth: 14, bevelEnabled: false, curveSegments: 24 }); baseGeo.translate(0, 0, -7);
  const base = mesh(baseGeo, [M.red, M.tunnel]); wu.add(base);
  for (const sx of [-1, 1]) { const wing = mesh(box(12, BH, 46), M.red); wing.position.set(sx * 27, BH / 2, 30); wu.add(wing); }
  const capGeo = box(66.6, .7, 14.6); const cap = mesh(capGeo, M.marble); cap.position.y = BH + .35; wu.add(cap);
  const tower = hall(M, { w: 40, d: 15, colH: 5.6, double: true, platformH: .8, pm: 1.6 }); tower.position.y = BH + .7; wu.add(tower);
  for (const sx of [-1, 1]) {
    const gal = hall(M, { w: 34, d: 7, colH: 3.2, platformH: .5, pm: .8 }); gal.rotation.y = Math.PI / 2; gal.position.set(sx * 27, BH, 30); wu.add(gal);
    for (const z of [9, 51]) { const pv = hall(M, { w: 9, d: 9, colH: 3.4, double: true, pyramid: true, platformH: .6, pm: .8 }); pv.position.set(sx * 27, BH, z); wu.add(pv); }
  }
  wu.userData.tower = tower; wu.userData.base = base;
  hero('meridian', wu, 0, 0, 0);
  foot(0, 0, 66, 14, 30, 'gate'); foot(-27, 30, 12, 46, 18); foot(27, 30, 12, 46, 18);
  W.anchors.meridianTower = new THREE.Vector3(0, BH + 18, 0);

  // ---- Golden Water River 金水河 with five bridges
  const riverPts = []; for (let i = 0; i <= 48; i++) { const x = -50 + 100 * i / 48; riverPts.push(new THREE.Vector3(x, .08, -15 - 7 * (1 - (x / 50) ** 2))); }
  const rc = new THREE.CatmullRomCurve3(riverPts);
  const rv = [], ri = [], jl = [];
  for (let i = 0; i <= 96; i++) { const p = rc.getPointAt(i / 96), t = rc.getTangentAt(i / 96), n = new THREE.Vector3(-t.z, 0, t.x).multiplyScalar(2.6); rv.push(p.x + n.x, .1, p.z + n.z, p.x - n.x, .1, p.z - n.z); if (i) { ri.push((i - 1) * 2, i * 2, (i - 1) * 2 + 1, (i - 1) * 2 + 1, i * 2, i * 2 + 1); jl.push(rv[(i - 1) * 6], .16, rv[(i - 1) * 6 + 2], p.x + n.x, .16, p.z + n.z, rv[(i - 1) * 6 + 3], .16, rv[(i - 1) * 6 + 5], p.x - n.x, .16, p.z - n.z); } }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(rv, 3)); rg.setIndex(ri); rg.computeVertexNormals();
  scene.add(mesh(rg, M.water, false));
  const jg = new THREE.BufferGeometry(); jg.setAttribute('position', new THREE.Float32BufferAttribute(jl, 3)); scene.add(new THREE.LineSegments(jg, M.jadeLine));
  for (const x of [-14, -7, 0, 7, 14]) { const b = mesh(box(x ? 3.4 : 4.4, .9, 9), M.marble); b.position.set(x, .45, -15 - 7 * (1 - (x / 50) ** 2)); scene.add(b); }
  W.river = riverPts;

  // ---- Gate of Supreme Harmony 太和门: open colonnade with a doorway on the axis
  const thm = new THREE.Group();
  const tp = mesh(box(54, 3, 24), M.marble); tp.position.y = 1.5; thm.add(tp);
  addStairs(thm, M, 0, 3, 12, 12, 7);
  const tmh = hall(M, { w: 40, d: 14, colH: 6.2, double: true, open: true, doorGap: 6, platformH: .01, pm: 0 }); tmh.position.y = 3; thm.add(tmh);
  hero('taihemen', thm, 0, 0, -32);
  foot(0, -32, 54, 24, 26, 'gate');
  W.anchors.taihemen = new THREE.Vector3(0, 16, -32);

  // ---- The three-tier terrace 三台 and the three great halls
  const terrace = new THREE.Group(), tiers = [];
  const TZ = [[-72, -172, 86], [-78.5, -169, 80], [-85, -166, 74]];
  TZ.forEach(([zf, zb, w], i) => {
    const t = new THREE.Group(); const d = zf - zb;
    const m = mesh(box(w, 2.4, d), M.marble); m.position.set(0, 1.2, 0); t.add(m);
    // balustrade: posts + rail
    const posts = [], per = [];
    for (let x = -w / 2; x <= w / 2 + .01; x += 2.2) posts.push([x, d / 2], [x, -d / 2]);
    for (let z = -d / 2 + 2.2; z < d / 2; z += 2.2) posts.push([w / 2, z], [-w / 2, z]);
    const pm = new THREE.InstancedMesh(box(.42, 1.1, .42), M.marble, posts.length);
    posts.forEach(([x, z], k) => pm.setMatrixAt(k, new THREE.Matrix4().makeTranslation(x, 2.95, z)));
    pm.userData.base = posts.map(([x, z]) => new THREE.Vector3(x, 2.95, z)); pm.castShadow = true;
    t.add(pm);
    for (const [rw, rd, rx, rz] of [[w, .25, 0, d / 2], [w, .25, 0, -d / 2], [.25, d, w / 2, 0], [.25, d, -w / 2, 0]]) { const rl = mesh(box(rw, .25, rd), M.marble); rl.position.set(rx, 3.2, rz); t.add(rl); per.push(rl); }
    t.position.set(0, i * 2.4, (zf + zb) / 2); t.userData = { posts: pm, rails: per, home: t.position.clone() };
    terrace.add(t); tiers.push(t);
    foot(0, (zf + zb) / 2, w, d, 2.4 * (i + 1), 'terrace');
  });
  const stairs = new THREE.Group();
  TZ.forEach(([zf], i) => { for (const [x, sw] of [[0, 12], [-15, 6], [15, 6]]) addStairs(stairs, M, x, 2.4 * i, zf, sw, 6, 2.4); });
  terrace.add(stairs); terrace.userData = { tiers, stairs };
  hero('terrace', terrace, 0, 0, 0);
  const TOP = 7.2;
  const taihe = hero('taihe', hall(M, { w: 46, d: 22, colH: 8.6, bays: 11, double: true, platformH: 1.2, bands: 5 }), 0, TOP, -100);
  const zhonghe = hero('zhonghe', hall(M, { w: 15, d: 15, colH: 6, pyramid: true, finial: true, platformH: 1, bands: 4 }), 0, TOP, -124);
  const baohe = hero('baohe', hall(M, { w: 40, d: 18, colH: 7.2, bays: 9, double: true, platformH: 1, bands: 5 }), 0, TOP, -146);
  foot(0, -100, 50, 26, 30, 'hall'); foot(0, -124, 19, 19, 24, 'hall'); foot(0, -146, 44, 22, 27, 'hall');
  scene.updateMatrixWorld(true);
  W.anchors.taihe = new THREE.Vector3(0, 22, -100);
  W.anchors.finial = zhonghe.userData.parts.finialBall.getWorldPosition(new THREE.Vector3());
  W.anchors.taiheRoof = new THREE.Vector3(0, TOP + taihe.userData.height - 2, -100);

  // ---- courtyard paving tiles (instanced, flip into place in the assembly sequence)
  const tilePos = [];
  for (let x = -45; x <= 45; x += 2.6) for (let z = -44; z >= -70; z -= 2.6) if (Math.abs(x) > 2.2) tilePos.push([x, z]);
  const tiles = new THREE.InstancedMesh(box(2.4, .16, 2.4), M.paving, tilePos.length); tiles.receiveShadow = true;
  tiles.userData.base = tilePos; scene.add(tiles); W.tiles = tiles;

  // ---- batched architecture: galleries, rear palaces, walls, towers, side palaces
  const delayFor = z => 4.1 + (40 - z) / 330 * 1.7; // rise wave from south to north (timeline seconds)
  const addHall = (opts, x, y, z, rot = 0, jitter = 0) => {
    const h = hall(M, opts); h.position.set(x, y, z); h.rotation.y = rot;
    const dl = delayFor(z) + jitter;
    batch.addObject(h, keyOf, y, dl);
    // columns are instanced: bake them in as well
    const cm = h.userData.parts.columns; h.updateMatrixWorld(true);
    const mm = new THREE.Matrix4();
    for (let i = 0; i < cm.count; i++) { cm.getMatrixAt(i, mm); batch.add('column', cm.geometry, mm.clone().premultiply(h.matrixWorld), y, dl); }
    h.traverse(o => { if (o.isLineSegments) { o.updateMatrixWorld(true); const lg = o.geometry.clone().applyMatrix4(o.matrixWorld); const n = lg.attributes.position.count; lg.setAttribute('aBase', new THREE.Float32BufferAttribute(new Float32Array(n).fill(y), 1)); lg.setAttribute('aDelay', new THREE.Float32BufferAttribute(new Float32Array(n).fill(dl), 1)); batch.lines.push(lg); } });
    foot(x, z, h.userData.w, h.userData.d, y + h.userData.height, 'hall', rot);
    W.verticals.push({ x, z, w: rot ? h.userData.d : h.userData.w, d: rot ? h.userData.w : h.userData.d, y0: y, h: h.userData.height, delay: dl - .5 });
    return h;
  };
  const addBox = (w, h, d, x, y, z, mat, key) => { const b = mesh(box(w, h, d), mat); b.position.set(x, y + h / 2, z); b.updateMatrixWorld(true); batch.add(key, b.geometry, b.matrixWorld, y, delayFor(z)); };
  // galleries 廊庑 around the great courtyard
  for (const sx of [-1, 1]) {
    for (const [z0, z1] of [[-38, -80], [-92, -130], [-134, -170]]) addHall({ w: z0 - z1, d: 8, colH: 4, platformH: .6, pm: .6 }, sx * 52, 0, (z0 + z1) / 2, Math.PI / 2);
    addHall({ w: 16, d: 11, colH: 5, double: true, platformH: 1.2, pm: 1 }, sx * 52, 0, -86, Math.PI / 2); // 体仁阁 / 弘义阁
    addHall({ w: 22, d: 8, colH: 4, platformH: .6, pm: .6 }, sx * 40, 0, -32);
    addBox(4, 7, 136, sx * 58, 0, -104, M.red, 'red');
  }
  // rear court 后三宫
  const rear = [[{ w: 30, d: 12, colH: 5, platformH: 2.2 }, -190], [{ w: 38, d: 16, colH: 6.5, double: true, platformH: 3.5 }, -212],
                [{ w: 12, d: 12, colH: 4.2, pyramid: true, platformH: 3.5 }, -230], [{ w: 36, d: 14, colH: 5.4, platformH: 3.5 }, -246]];
  for (const [o, z] of rear) addHall(o, 0, 0, z);
  for (const sx of [-1, 1]) addHall({ w: 60, d: 7, colH: 3.6, platformH: .5, pm: .5 }, sx * 34, 0, -228, Math.PI / 2);
  // northern gate 神武门
  addBox(42, 9, 12, 0, 0, -282, M.red, 'red');
  addHall({ w: 30, d: 12, colH: 4.6, double: true, platformH: .6, pm: 1 }, 0, 9, -282);
  // perimeter wall with a glazed coping, and the four corner towers 角楼
  const wallSeg = (x, z, len, alongZ) => {
    addBox(alongZ ? 4 : len, 8, alongZ ? len : 4, x, 0, z, M.red, 'red');
    const cp = roofGeometry(len, 4, 1.3, { overhang: .8, lift: 0, flare: 0, rings: 2 });
    const m = new THREE.Matrix4().makeRotationY(alongZ ? Math.PI / 2 : 0).setPosition(x, 8, z);
    batch.add('roof', cp.geometry, m, 0, delayFor(z));
  };
  for (const sx of [-1, 1]) {
    wallSeg(sx * 76.5, -4, 87, false);                 // south, either side of the Meridian Gate
    wallSeg(sx * 120, -143, 278, true);                // east / west
    wallSeg(sx * 60.5, -282, 99, false);               // north, either side of Shenwu Gate
    for (const z of [-4, -282]) {
      const cx = sx * 120;
      addBox(12, 8, 12, cx, 0, z, M.red, 'red');
      addHall({ w: 14, d: 7, colH: 3, platformH: .4, pm: .4 }, cx, 8, z, 0, .1);
      addHall({ w: 14, d: 7, colH: 3, platformH: .4, pm: .4 }, cx, 8, z, Math.PI / 2, .1);
      addHall({ w: 6, d: 6, colH: 5.2, pyramid: true, platformH: .4, pm: .2 }, cx, 8, z, 0, .15);
    }
  }
  // side palaces 东西六宫 etc. — procedural compounds
  for (const sx of [-1, 1]) for (let z = -24; z > -272; z -= 24) for (const cx of [72, 98]) {
    if (R() < .12) continue;
    const x = sx * (cx + (R() - .5) * 4), w = 14 + R() * 6, d = 7 + R() * 3;
    addHall({ w, d, colH: 3.2 + R() * .8, platformH: .6, pm: .6, double: R() < .15 }, x, 0, z - 4, 0, R() * .3);
    if (R() < .7) addHall({ w: w * .8, d: d * .9, colH: 3, platformH: .5, pm: .5 }, x, 0, z + 6, 0, R() * .3);
    for (const [bw, bd, bx, bz] of [[24, .8, 0, 11], [24, .8, 0, -11], [.8, 22, 12, 0], [.8, 22, -12, 0]]) addBox(bw, 2.6, bd, x + bx, 0, z + bz, M.red, 'red');
  }
  // merge the batch into a handful of draw calls
  const mats = { roof: M.roof, ridge: M.ridge, marble: M.marble, jade: M.jade, door: M.door, red: M.red, column: M.column };
  W.batchMeshes = [];
  for (const [k, list] of Object.entries(batch.geo)) {
    const m = new THREE.Mesh(mergeGeometries(list), risePatch(mats[k], W.uniforms));
    m.castShadow = k !== 'marble'; m.receiveShadow = true; m.frustumCulled = false; scene.add(m); W.batchMeshes.push(m);
    if (k === 'door') W.batchDoor = m.material;
  }
  const bl = new THREE.LineSegments(mergeGeometries(batch.lines), risePatch(M.goldLine, W.uniforms)); bl.frustumCulled = false; scene.add(bl); W.batchLines = bl;

  // vertical extrusion guides for the hero architecture
  W.verticals.push({ x: 0, z: 0, w: 66, d: 14, y0: 0, h: 29, delay: 3.7 }, { x: 0, z: -32, w: 54, d: 24, y0: 0, h: 25, delay: 3.9 },
    { x: 0, z: -122, w: 86, d: 100, y0: 0, h: 7.2, delay: 4.2 }, { x: 0, z: -100, w: 50, d: 26, y0: 7.2, h: 23, delay: 4.5 },
    { x: 0, z: -124, w: 19, d: 19, y0: 7.2, h: 18, delay: 4.7 }, { x: 0, z: -146, w: 44, d: 22, y0: 7.2, h: 21, delay: 4.8 });
  return W;
}

function addStairs(parent, M, x, y, zFront, width, steps, rise = 3) {
  const sh = rise / steps, sd = .9;
  const g = new THREE.Group();
  for (let k = 0; k < steps; k++) {
    const h = (k + 1) * sh; const b = mesh(box(width, h, sd), M.marble);
    b.position.set(x, y + h / 2, zFront + (steps - k - .5) * sd); g.add(b);
  }
  if (width >= 10) { // carved imperial ramp on the axis 御路
    const len = steps * sd, ramp = mesh(box(4, .3, Math.hypot(len, rise)), M.path);
    ramp.position.set(x, y + rise / 2 + .1, zFront + len / 2); ramp.rotation.x = Math.atan2(rise, len); g.add(ramp);
  }
  g.userData.home = g.position.clone(); parent.add(g); return g;
}
