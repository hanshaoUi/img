// GPU "DrawSVG" for 3D lines: every segment carries its own start time and duration and
// grows from A to B in the vertex shader. One uniform (uClock, driven by GSAP) draws the plan.
import * as THREE from 'three';

const GOLD = [1.0, .74, .38], IVORY = [.93, .88, .78], BLUE = [.42, .55, .85], JADE = [.3, .95, .75];

export class LineSet {
  constructor() { this.a = []; this.b = []; this.end = []; this.delay = []; this.dur = []; this.col = []; this.alpha = []; }
  seg(A, B, delay, dur, col, alpha) {
    for (const e of [0, 1]) { this.a.push(...A); this.b.push(...B); this.end.push(e); this.delay.push(delay); this.dur.push(dur); this.col.push(...col); this.alpha.push(alpha); }
  }
  poly(pts, delay, total, col, alpha, closed = false) {
    const n = pts.length - (closed ? 0 : 1);
    for (let i = 0; i < n; i++) this.seg(pts[i], pts[(i + 1) % pts.length], delay + total * i / n, total / n * 1.6, col, alpha);
  }
  build(material) {
    const g = new THREE.BufferGeometry(), f = (arr, n) => new THREE.Float32BufferAttribute(arr, n);
    g.setAttribute('position', f(this.a, 3)); g.setAttribute('aB', f(this.b, 3)); g.setAttribute('aEnd', f(this.end, 1));
    g.setAttribute('aDelay', f(this.delay, 1)); g.setAttribute('aDur', f(this.dur, 1)); g.setAttribute('aCol', f(this.col, 3)); g.setAttribute('aAlpha', f(this.alpha, 1));
    const l = new THREE.LineSegments(g, material); l.frustumCulled = false; return l;
  }
}

export function drawMaterial(extra = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { uClock: { value: 0 }, uOpacity: { value: 1 }, uGrid: { value: 1 }, ...extra },
    vertexShader: `
      attribute vec3 aB; attribute float aEnd, aDelay, aDur, aAlpha; attribute vec3 aCol;
      uniform float uClock; varying vec3 vCol; varying float vA;
      void main() {
        float k = clamp((uClock - aDelay) / aDur, 0.0, 1.0); k = 1.0 - pow(1.0 - k, 3.0);
        vec3 p = mix(position, aB, aEnd * k);
        vCol = aCol; vA = aAlpha * step(0.0001, k) * (1.0 + 1.5 * (1.0 - k));
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      uniform float uOpacity; varying vec3 vCol; varying float vA;
      void main() { gl_FragColor = vec4(vCol * 1.6, vA * uOpacity); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  });
}

export function buildBlueprint(W) {
  const plan = new LineSet(), grid = new LineSet(), vert = new LineSet();
  const Y = .09, C = -115;
  // 1. the single line: the central axis, drawn from the centre outwards
  plan.seg([0, Y, C], [0, Y, 70], .6, 1.1, GOLD, 1); plan.seg([0, Y, C], [0, Y, -300], .6, 1.1, GOLD, 1);
  // ticks along the axis, following the line as it travels
  for (let z = 70; z >= -300; z -= 5) {
    const major = z % 25 === 0, t = .6 + Math.abs(z - C) / 185 * 1.0;
    const L = major ? 3.2 : 1.3;
    plan.seg([0, Y, z], [L, Y, z], t, .2, GOLD, major ? .8 : .45); plan.seg([0, Y, z], [-L, Y, z], t, .2, GOLD, major ? .8 : .45);
  }
  // 2. modular grid (10 u), spreading from the axis
  for (let x = -140; x <= 140; x += 10) { const d = 1.3 + Math.abs(x) / 140 * .9; grid.seg([x, Y - .01, C], [x, Y - .01, 70], d, .9, BLUE, x % 50 ? .16 : .3); grid.seg([x, Y - .01, C], [x, Y - .01, -300], d, .9, BLUE, x % 50 ? .16 : .3); }
  for (let z = 70; z >= -300; z -= 10) { const d = 1.5 + Math.abs(z - C) / 185 * .9; grid.seg([0, Y - .01, z], [140, Y - .01, z], d, .9, BLUE, z % 50 ? .16 : .3); grid.seg([0, Y - .01, z], [-140, Y - .01, z], d, .9, BLUE, z % 50 ? .16 : .3); }
  // 3. footprints, south → north, each rectangle traced corner to corner
  const fps = [...W.footprints].sort((a, b) => b.z - a.z);
  fps.forEach((f, i) => {
    const t = 1.7 + i / fps.length * 1.7, x0 = f.x - f.w / 2, x1 = f.x + f.w / 2, z0 = f.z - f.d / 2, z1 = f.z + f.d / 2;
    const hero = f.kind !== 'hall' || Math.abs(f.x) < 30;
    plan.poly([[x0, Y, z1], [x1, Y, z1], [x1, Y, z0], [x0, Y, z0]], t, .35, hero ? GOLD : IVORY, hero ? .85 : .5, true);
    if (hero && f.kind === 'hall') { // column-grid ticks inside hero halls
      for (let k = 1; k < 6; k++) { const x = x0 + (x1 - x0) * k / 6; plan.seg([x, Y, z1], [x, Y, z1 - 1.4], t + .3, .15, IVORY, .5); }
    }
  });
  // 4. circular guides & construction geometry around the Hall of Supreme Harmony
  const circle = (cx, cz, r, t, dur, col, a, n = 120) => plan.poly(Array.from({ length: n + 1 }, (_, i) => [cx + r * Math.sin(i / n * Math.PI * 2), Y, cz + r * Math.cos(i / n * Math.PI * 2)]), t, dur, col, a);
  circle(0, -100, 30, 2.2, .9, GOLD, .7); circle(0, -100, 54, 2.4, 1.0, GOLD, .45); circle(0, -122, 96, 2.6, 1.2, IVORY, .25);
  circle(0, 0, 38, 2.0, .9, GOLD, .5); circle(0, -212, 30, 2.7, .9, IVORY, .35);
  for (let i = 0; i < 72; i++) { const a = i / 72 * Math.PI * 2, r0 = 54, r1 = i % 9 ? 57 : 62; plan.seg([Math.sin(a) * r0, Y, -100 + Math.cos(a) * r0], [Math.sin(a) * r1, Y, -100 + Math.cos(a) * r1], 2.6 + i / 72 * .8, .15, GOLD, .6); }
  for (const [x, z] of [[-122, 60], [122, 60], [-122, -290], [122, -290]]) plan.seg([x, Y, z], [0, Y, C], 2.9, .9, IVORY, .14);
  // 5. dimension lines
  plan.seg([-134, Y, 58], [-134, Y, -286], 3.0, .8, IVORY, .45); plan.seg([-122, Y, 66], [122, Y, 66], 3.0, .8, IVORY, .45);
  for (let z = 58; z >= -286; z -= 43) plan.seg([-136.5, Y, z], [-131.5, Y, z], 3.2, .2, IVORY, .6);
  for (let x = -122; x <= 122; x += 30.5) plan.seg([x, Y, 68.5], [x, Y, 63.5], 3.2, .2, IVORY, .6);
  // river
  plan.poly(W.river.map(p => [p.x, Y, p.z]), 2.1, .9, JADE, .7);
  // 6. vertical extrusion lines: walls rise as light before they rise as matter
  for (const v of W.verticals) {
    const x0 = v.x - v.w / 2, x1 = v.x + v.w / 2, z0 = v.z - v.d / 2, z1 = v.z + v.d / 2, t = v.delay;
    for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) vert.seg([x, v.y0, z], [x, v.y0 + v.h, z], t, .7, GOLD, .45);
    vert.poly([[x0, v.y0 + v.h, z1], [x1, v.y0 + v.h, z1], [x1, v.y0 + v.h, z0], [x0, v.y0 + v.h, z0]], t + .45, .5, IVORY, .22, true);
  }
  return { plan, grid, vert };
}

export function buildLines(W) {
  const sets = buildBlueprint(W), mat = drawMaterial(), gmat = drawMaterial(), vmat = drawMaterial();
  return { plan: sets.plan.build(mat), grid: sets.grid.build(gmat), vert: sets.vert.build(vmat), mats: { plan: mat, grid: gmat, vert: vmat } };
}
