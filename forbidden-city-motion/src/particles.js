// Architecture → particles → cloud curves → contour lines → architecture.
// Positions are a pure function of GSAP-driven uniforms, so any frame can be rendered in isolation.
// Trails are line segments from the current state to the state the timeline had 0.12 s earlier.
import * as THREE from 'three';
import { rng } from './world.js';

const NOISE = /* glsl */`
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

const POS = /* glsl */`
attribute vec3 aCloud; attribute vec3 aContour; attribute vec4 aSeed; attribute vec3 aCol;
vec3 statePos(vec4 k, float time) { // k = (hold, flow, cloud, contour) ; rebuild passed separately
  vec3 p0 = position;
  vec3 base = p0 + vec3(0.0, k.x * (0.4 + aSeed.x * 1.4), 0.0);
  vec3 c = p0 - vec3(0.0, 0.0, -122.0);
  float ang = k.y * (0.9 + aSeed.y * 0.9) * (1.0 - clamp(length(c.xz) / 160.0, 0.0, 0.6));
  float ca = cos(ang), sa = sin(ang);
  vec3 sw = vec3(c.x * ca - c.z * sa, c.y, c.x * sa + c.z * ca) + vec3(0.0, 0.0, -122.0);
  vec3 q = p0 * 0.03 + vec3(0.0, time * 0.22, time * 0.12);
  vec3 n = vec3(snoise(q), snoise(q + 31.4), snoise(q + 67.1));
  vec3 f = mix(base, sw + vec3(0.0, 12.0 + 26.0 * aSeed.z, 0.0), k.y) + n * 16.0 * k.y;
  float kc = clamp(k.z * 1.7 - aSeed.w * 0.7, 0.0, 1.0); kc = kc * kc * (3.0 - 2.0 * kc);
  vec3 p = mix(f, aCloud + n * 0.35 * (1.0 - k.w), kc);
  float kk = clamp(k.w * 1.7 - aSeed.x * 0.7, 0.0, 1.0); kk = kk * kk * (3.0 - 2.0 * kk);
  return mix(p, aContour, kk);
}
vec3 finalPos(vec4 k, float rebuild, float time) {
  vec3 p = statePos(k, time);
  float h = clamp(position.y / 32.0, 0.0, 1.0);
  float kr = clamp(rebuild * 1.8 - h * 0.8, 0.0, 1.0); kr = kr * kr * (3.0 - 2.0 * kr);
  return mix(p, position, kr);
}`;

function sampleTriangles(objects, count, R) {
  // gather world-space triangles with colours and weights
  const tris = [], v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const colorOf = m => ['roof', 'ridge', 'finial'].includes(m.name) ? [1.0, .66, .24] : m.name === 'marble' ? [.9, .86, .78] : m.name === 'jade' ? [.25, .8, .65] : [.95, .16, .08];
  const weightOf = m => m.name === 'roof' ? 1.5 : m.name === 'marble' ? .55 : 1;
  const addGeo = (geo, matrix, mat) => {
    const pos = geo.attributes.position, idx = geo.index, n = idx ? idx.count : pos.count;
    const col = colorOf(mat), wgt = weightOf(mat);
    for (let i = 0; i < n; i += 3) {
      for (let k = 0; k < 3; k++) v[k].fromBufferAttribute(pos, idx ? idx.getX(i + k) : i + k).applyMatrix4(matrix);
      const area = new THREE.Vector3().subVectors(v[1], v[0]).cross(new THREE.Vector3().subVectors(v[2], v[0])).length() / 2;
      if (area > 1e-4) tris.push({ a: v[0].clone(), b: v[1].clone(), c: v[2].clone(), w: area * wgt, col });
    }
  };
  for (const root of objects) {
    root.updateMatrixWorld(true);
    root.traverse(o => {
      if (!o.isMesh) return;
      const mat = Array.isArray(o.material) ? o.material[0] : o.material;
      if (o.isInstancedMesh) {
        const m = new THREE.Matrix4();
        for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m); addGeo(o.geometry, m.clone().premultiply(o.matrixWorld), mat); }
      } else addGeo(o.geometry, o.matrixWorld, mat);
    });
  }
  const cum = []; let tot = 0; for (const t of tris) { tot += t.w; cum.push(tot); }
  const out = new Float32Array(count * 3), cols = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = R() * tot; let lo = 0, hi = cum.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < r) lo = mid + 1; else hi = mid; }
    const t = tris[lo]; let u = R(), w = R(); if (u + w > 1) { u = 1 - u; w = 1 - w; }
    const p = t.a.clone().addScaledVector(new THREE.Vector3().subVectors(t.b, t.a), u).addScaledVector(new THREE.Vector3().subVectors(t.c, t.a), w);
    out.set([p.x, p.y, p.z], i * 3); cols.set(t.col, i * 3);
  }
  return { pos: out, col: cols };
}

// sample N points evenly along a set of polylines
function sampleLines(polys, count, R, jitter) {
  const segs = []; let tot = 0;
  for (const pl of polys) for (let i = 0; i < pl.length - 1; i++) { const l = pl[i].distanceTo(pl[i + 1]); if (l > 1e-5) { segs.push([pl[i], pl[i + 1], tot]); tot += l; } }
  const out = new Float32Array(count * 3);
  let j = 0;
  for (let i = 0; i < count; i++) {
    const d = (i + R() * .5) / count * tot;
    while (j < segs.length - 1 && segs[j + 1][2] <= d) j++;
    const [a, b, s] = segs[j], k = (d - s) / a.distanceTo(b);
    const p = a.clone().lerp(b, Math.min(1, k));
    out.set([p.x + (R() - .5) * jitter, p.y + (R() - .5) * jitter, p.z + (R() - .5) * jitter * .4], i * 3);
  }
  // shuffle so neighbours on the curve come from different parts of the building
  for (let i = count - 1; i > 0; i--) { const r = Math.floor(R() * (i + 1)); for (let k = 0; k < 3; k++) { const t = out[i * 3 + k]; out[i * 3 + k] = out[r * 3 + k]; out[r * 3 + k] = t; } }
  return out;
}

// 祥云 — auspicious cloud curves, drawn procedurally from spirals and S-curves
export function cloudCurves() {
  const polys = [];
  const spiral = (cx, cy, r, turns, dir, a0, squash = 1) => {
    const pts = [], n = Math.round(90 * turns);
    for (let i = 0; i <= n; i++) { const t = i / n, a = a0 + dir * t * turns * Math.PI * 2, rr = r * (1 - .82 * t); pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * squash]); }
    return pts;
  };
  const flow = (pts) => pts;
  const cloud = (ox, oy, s, flip) => {
    const f = flip ? -1 : 1, T = ([x, y]) => [ox + x * s * f, oy + y * s];
    const main = spiral(0, 0, 1, 1.35, -1, Math.PI * .5).map(T);
    const left = spiral(-1.55, -.15, .62, 1.2, 1, Math.PI * .5).map(T);
    const right = spiral(1.5, -.2, .55, 1.15, -1, Math.PI * .5).map(T);
    const base = []; for (let i = 0; i <= 80; i++) { const t = i / 80, x = -2.6 + 5.4 * t; base.push(T([x, -1.05 - .18 * Math.sin(t * Math.PI * 2) + .25 * t])); }
    const tail = []; for (let i = 0; i <= 90; i++) { const t = i / 90, x = 2.8 + 3.4 * t; tail.push(T([x, -.85 + .55 * Math.sin(t * Math.PI * 1.5) * (1 - t * .4)])); }
    polys.push(main, left, right, base, tail);
  };
  cloud(-16, 30, 7, false); cloud(20, 40, 5, true); cloud(-38, 45, 3.4, true); cloud(40, 22, 3.6, false);
  // long ribbon underneath
  const rib = []; for (let i = 0; i <= 160; i++) { const t = i / 160; rib.push([-64 + 128 * t, 12 + 5 * Math.sin(t * Math.PI * 3) * Math.sin(t * Math.PI)]); }
  polys.push(rib, rib.map(([x, y]) => [x, y - 2.2]));
  return polys.map(pl => flow(pl).map(([x, y]) => new THREE.Vector3(x, y, -96)));
}

export function buildParticles(scene, W, count = 46000) {
  const R = rng(99);
  const H = W.heroes;
  const src = sampleTriangles([H.terrace, H.taihe, H.zhonghe, H.baohe], count, R);
  // cloud target
  const cloudPos = sampleLines(cloudCurves(), count, R, .5);
  // contour target: the front elevation of the three halls, drawn from their real roof edges
  const polys = [];
  const planeZ = -96;
  for (const name of ['taihe', 'zhonghe', 'baohe']) {
    H[name].updateMatrixWorld(true);
    H[name].traverse(o => {
      if (!o.isLineSegments) return;
      const p = o.geometry.attributes.position, v = new THREE.Vector3(), u = new THREE.Vector3();
      for (let i = 0; i < p.count; i += 2) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); u.fromBufferAttribute(p, i + 1).applyMatrix4(o.matrixWorld); polys.push([new THREE.Vector3(v.x, v.y, planeZ), new THREE.Vector3(u.x, u.y, planeZ)]); }
    });
  }
  const tier = [[43, 0], [43, 2.4], [40, 2.4], [40, 4.8], [37, 4.8], [37, 7.2]];
  polys.push([...tier.map(([x, y]) => new THREE.Vector3(-x, y, planeZ)), ...tier.reverse().map(([x, y]) => new THREE.Vector3(x, y, planeZ))]);
  polys.push([new THREE.Vector3(-70, 0, planeZ), new THREE.Vector3(70, 0, planeZ)]);
  for (let i = 0; i <= 11; i++) { const x = -22.3 + 44.6 * i / 11; polys.push([new THREE.Vector3(x, 8.4, planeZ), new THREE.Vector3(x, 17, planeZ)]); }
  polys.push([new THREE.Vector3(0, 0, planeZ), new THREE.Vector3(0, 40, planeZ)]);
  const contourPos = sampleLines(polys, count, R, .12);

  const seeds = new Float32Array(count * 4); for (let i = 0; i < seeds.length; i++) seeds[i] = R();
  const U = {
    uK: { value: new THREE.Vector4() }, uRebuild: { value: 0 }, uTime: { value: 0 },
    uKp: { value: new THREE.Vector4() }, uRebuildP: { value: 0 }, uTimeP: { value: 0 },
    uAlpha: { value: 0 }, uSize: { value: 1 }, uTrail: { value: .16 },
  };
  // heads
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(src.pos, 3));
  g.setAttribute('aCloud', new THREE.BufferAttribute(cloudPos, 3));
  g.setAttribute('aContour', new THREE.BufferAttribute(contourPos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  g.setAttribute('aCol', new THREE.BufferAttribute(src.col, 3));
  const headMat = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: THREE.NormalBlending, toneMapped: false,
    vertexShader: NOISE + POS + `
      uniform vec4 uK; uniform float uRebuild, uTime, uSize; varying vec3 vCol; varying float vTw;
      void main() {
        vec3 p = finalPos(uK, uRebuild, uTime);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vTw = 0.7 + 0.3 * sin(uTime * 6.0 + aSeed.x * 40.0);
        vCol = aCol;
        gl_PointSize = clamp(uSize * (0.7 + aSeed.y * .8) * 200.0 / -mv.z, 1.0, 3.2);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uAlpha; varying vec3 vCol; varying float vTw;
      void main() { vec2 d = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.15, length(d)); gl_FragColor = vec4(vCol * 1.5 * vTw, a * uAlpha * .9); }`,
  });
  const heads = new THREE.Points(g, headMat); heads.frustumCulled = false;
  // trails: two vertices per particle, the tail evaluated at the earlier timeline state
  const tg = new THREE.BufferGeometry(), dup = (a, n) => { const o = new Float32Array(a.length * 2); for (let i = 0; i < a.length / n; i++) for (let k = 0; k < n; k++) { o[i * 2 * n + k] = a[i * n + k]; o[i * 2 * n + n + k] = a[i * n + k]; } return o; };
  tg.setAttribute('position', new THREE.BufferAttribute(dup(src.pos, 3), 3));
  tg.setAttribute('aCloud', new THREE.BufferAttribute(dup(cloudPos, 3), 3));
  tg.setAttribute('aContour', new THREE.BufferAttribute(dup(contourPos, 3), 3));
  tg.setAttribute('aSeed', new THREE.BufferAttribute(dup(seeds, 4), 4));
  tg.setAttribute('aCol', new THREE.BufferAttribute(dup(src.col, 3), 3));
  const tail = new Float32Array(count * 2); for (let i = 0; i < count; i++) tail[i * 2 + 1] = 1;
  tg.setAttribute('aTail', new THREE.BufferAttribute(tail, 1));
  const trailMat = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    vertexShader: NOISE + POS + `
      attribute float aTail;
      uniform vec4 uK, uKp; uniform float uRebuild, uRebuildP, uTime, uTimeP; varying vec3 vCol; varying float vA;
      void main() {
        vec3 ph = finalPos(uK, uRebuild, uTime), pt = finalPos(uKp, uRebuildP, uTimeP);
        vec3 p = aTail > 0.5 ? pt : ph;
        float len = length(ph - pt);
        vCol = aCol; vA = (1.0 - aTail) * clamp(1.6 / (len + 0.4), 0.0, 1.0);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      uniform float uAlpha, uTrail; varying vec3 vCol; varying float vA;
      void main() { gl_FragColor = vec4(vCol, vA * uAlpha * uTrail); }`,
  });
  const trails = new THREE.LineSegments(tg, trailMat); trails.frustumCulled = false;
  const group = new THREE.Group(); group.add(trails, heads); group.visible = false; scene.add(group);

  // drifting dust for the final shot
  const dn = 900, dp = new Float32Array(dn * 3);
  for (let i = 0; i < dn; i++) { dp[i * 3] = (R() - .5) * 220; dp[i * 3 + 1] = 2 + R() * 60; dp[i * 3 + 2] = 60 - R() * 320; }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const dust = new THREE.Points(dg, new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uAlpha: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `uniform float uTime; varying float vF;
      void main() { vec3 p = position; p.x += sin(uTime * .3 + position.z * .05) * 2.0; p.y += mod(uTime * .8 + position.x, 6.0) - 3.0;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); vF = smoothstep(420.0, 60.0, -mv.z); gl_PointSize = clamp(180.0 / -mv.z, 1.0, 3.0); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uAlpha; varying float vF; void main() { float a = smoothstep(.5, 0., length(gl_PointCoord - .5)); gl_FragColor = vec4(1.0, .78, .45, a * uAlpha * vF * .7); }`,
  }));
  dust.frustumCulled = false; scene.add(dust);
  return { group, U, dust };
}
