// The film: one paused GSAP master timeline, seeked once per frame.
// Every visual parameter — camera spline progress, line-drawing clocks, per-component assembly
// proxies, explode factors, SVG strokes and morphs, letter masks — is a GSAP tween.
import * as THREE from 'three';
import { LineSet, drawMaterial } from './blueprint.js';
import { project, circlePath } from './hud.js';

const gsap = window.gsap;
gsap.registerPlugin(window.DrawSVGPlugin, window.MorphSVGPlugin, window.SplitText, window.CustomEase);
const CE = window.CustomEase;
CE.create('burst', 'M0,0 C0.06,0.62 0.14,0.9 0.3,0.97 0.52,1.02 0.7,1 1,1');
CE.create('glide', 'M0,0 C0.36,0 0.18,1 1,1');

export function buildTimeline(ctx) {
  const { camera, world: Wd, lines, particles: P, type3d: T, H, M, bloom, grade, key, sky, shafts, axisLine, renderer, scene } = ctx;
  const heroes = Wd.heroes;
  const S = ctx.S = {
    clock: 0, rise: 0, up: 0, fov: 35, exposure: .3, fog: .00035, bloom: .75, gold: 0, glow: 0, warm: 0, keyI: 3.4,
    bpO: 1, gridO: 1, vertO: 1, railClock: 0, railO: 1, heroHide: 0, xl: 0, shafts: 0, dust: 0, axisDraw: 0, axisO: 0, fade: 0,
    abDots: 0, abDotR: 1,
    ex: { u: 0, d: 0, l: 0, b: 0, w: 0, c: 0, p: 0, t: 0, s: 0 },
  };
  const PS = { time: 0, alpha: 0, hold: 0, flow: 0, cloud: 0, contour: 0, rebuild: 0 };
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.inOut' } });
  const ptl = gsap.timeline({ paused: true, defaults: { ease: 'power2.inOut' } });
  const at = (target, vars, t) => tl.to(target, vars, t);
  const pulse = (key, t, peak, base, up = .08, down = .6) => { tl.to(S, { [key]: peak, duration: up, ease: 'power2.out' }, t); tl.to(S, { [key]: base, duration: down, ease: 'power2.in' }, t + up); };

  // ============================================================== camera: spline shots
  const shots = [];
  const V = a => new THREE.Vector3(...a);
  const shot = (t0, dur, ease, pos, tgt) => {
    const s = { t0, u: { v: 0 }, pos: new THREE.CatmullRomCurve3(pos.map(V), false, 'centripetal'), tgt: new THREE.CatmullRomCurve3(tgt.map(V), false, 'centripetal') };
    tl.to(s.u, { v: 1, duration: dur, ease }, t0); shots.push(s); return s;
  };
  const orbit = (c, r0, r1, a0, a1, y0, y1, n = 7) => Array.from({ length: n }, (_, i) => { const k = i / (n - 1), a = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(a0, a1, k)), r = THREE.MathUtils.lerp(r0, r1, k); return [c[0] + Math.sin(a) * r, THREE.MathUtils.lerp(y0, y1, k), c[2] + Math.cos(a) * r]; });
  const F = Wd.anchors.finial, Fa = [F.x, F.y, F.z];
  // 01 origin — top-down over the plan, then a crane from plan into elevation
  shot(0, 3.6, 'sine.inOut', [[0, 640, -115], [0, 520, -115.01]], [[0, 0, -115.2], [0, 0, -115.21]]);
  shot(3.6, 2.8, 'power2.inOut', [[0, 520, -115.01], [0, 380, -20], [0, 190, 110], [0, 62, 160], [0, 40, 150]], [[0, 0, -115.21], [0, 0, -100], [0, 4, -80], [0, 10, -65], [0, 12, -60]]);
  // 02 assembly — glide over to the terrace, then orbit it
  shot(6.4, 1.2, 'power2.inOut', [[0, 40, 150], [34, 44, 50], [70, 36, -40], [78, 34, -48]], [[0, 12, -60], [0, 12, -90], [0, 13, -112], [0, 13, -114]]);
  const orb = orbit([0, 0, -120], 106, 96, 47.3, -38, 34, 28);
  shot(7.6, 3.7, 'sine.inOut', orb, [[0, 13, -114], [0, 12.5, -115], [0, 12, -116]]);
  // 03 axis — swing back to the south, enter the Meridian Gate tunnel, fly between columns
  const o1 = orb[orb.length - 1];
  shot(11.3, 1.3, 'power2.inOut', [o1, [-40, 52, 10], [-10, 34, 78], [0, 14, 92], [0, 8, 84]], [[0, 12, -116], [0, 10, -60], [0, 8, 0], [0, 6, -10], [0, 5, -20]]);
  shot(12.6, 3.8, 'glide', [[0, 8, 84], [0, 4.4, 30], [0, 3.8, 10], [0, 3.8, -9], [0, 5.2, -19], [0, 6.6, -26], [0, 6.6, -38], [0, 9, -52], [10, 17, -64], [30, 22, -68]],
    [[0, 5, -20], [0, 4, -30], [0, 3.9, -40], [0, 5, -45], [0, 6, -50], [0, 7, -60], [0, 9, -80], [0, 12, -100], [0, 14, -104], [0, 15, -104]]);
  // 04 exploded — decelerate into a frozen three-quarter view, then drift out while it separates
  shot(16.4, .8, 'expo.out', [[30, 22, -68], [40, 24, -64]], [[0, 15, -104], [0, 15.2, -104]]);
  shot(17.2, 4.5, 'sine.inOut', [[40, 24, -64], [74, 42, -40], [108, 56, -22]], [[0, 15.2, -104], [0, 29, -102], [0, 32, -104]]);
  // 05 geometry — push into the gilded finial of the Hall of Central Harmony
  shot(21.7, 1.35, 'power3.in', [[108, 56, -22], [56, 48, -96], [18, 31, -116], [F.x + 2.6, F.y + .9, F.z + 4.2], [F.x + .8, F.y + .3, F.z + 1.9]], [[0, 32, -104], [0, 24, -116], Fa, Fa, Fa]);
  shot(23.05, 3.1, 'none', [[0, 560, -115], [0, 559, -115.01]], [[0, 0, -115.2], [0, 0, -115.21]]);
  // 06 type — from the plan down to the Meridian Gate
  shot(26.2, 2.4, 'power2.inOut', [[0, 559, -115.01], [0, 300, -10], [0, 90, 70], [0, 10, 76], [0, 5, 74]], [[0, 0, -115.21], [0, 0, -50], [0, 8, -10], [0, 13, 0], [0, 14, 0]]);
  shot(28.6, 2.4, 'sine.inOut', [[0, 5, 74], [0, 6.5, 56]], [[0, 14, 0], [0, 15.5, -4]]);
  // 07 particles — crane over the gate, then a slow orbit round the terrace
  shot(31.0, 1.3, 'power2.inOut', [[0, 6.5, 56], [0, 30, 44], [28, 46, 0], [58, 40, -44]], [[0, 15.5, -4], [0, 16, -50], [0, 18, -100], [0, 20, -112]]);
  const orb2 = orbit([0, 0, -120], 95.6, 100, 37.3, -6, 40, 30, 8);
  shot(32.3, 5.6, 'sine.inOut', orb2, [[0, 20, -112], [0, 26, -104], [0, 28, -100]]);
  // 08 monument — pull back along the axis and hold
  const o2 = orb2[orb2.length - 1];
  shot(37.9, 2.0, 'power2.inOut', [o2, [-8, 60, 60], [0, 96, 190], [0, 100, 214]], [[0, 28, -100], [0, 22, -112], [0, 15, -120], [0, 14, -122]]);
  shot(39.9, 4.1, 'sine.out', [[0, 100, 214], [0, 88, 188]], [[0, 14, -122], [0, 12, -126]]);
  at(S, { up: 1, duration: 2.0 }, 3.6);
  tl.set(S, { up: 0 }, 23.05);
  at(S, { up: 1, duration: 1.9 }, 26.2);

  // ============================================================== 01 · origin
  tl.fromTo(S, { clock: 0 }, { clock: 9, duration: 9, ease: 'none' }, 0);
  tl.fromTo(S, { rise: 0 }, { rise: 9, duration: 9, ease: 'none' }, 0);
  at(S, { exposure: 1, duration: 2.8 }, 3.6);
  at(S, { fog: .0024, duration: 2.8, ease: 'power2.in' }, 3.6);
  for (const [n, t0] of [['meridian', 3.7], ['taihemen', 3.95]]) { heroes[n].scale.y = .001; tl.fromTo(heroes[n].scale, { y: .001 }, { y: 1, duration: 1.1, ease: 'expo.out' }, t0); }
  at(S, { gold: 1, duration: 1.4 }, 4.5);
  at(S, { glow: 1, duration: 1.2 }, 5.2);
  at(S, { vertO: 0, duration: .9 }, 6.3);
  at(S, { bpO: .22, gridO: .12, duration: 1.2 }, 6.4);
  at(S, { gold: .65, duration: 1.2 }, 7.2);
  // HUD
  gsap.set([H.frame, H.frameText], { opacity: 0 });
  at([H.frame, H.frameText], { opacity: 1, duration: 1.2 }, .9);
  gsap.set([H.bp, H.bpText, H.scaleText], { opacity: 0 });
  at([H.bp, H.bpText, H.scaleText], { opacity: 1, duration: .5 }, 1.1);
  tl.fromTo(H.bpCircle, { drawSVG: '0%' }, { drawSVG: '100%', duration: 1.2, ease: 'power3.inOut' }, 1.1);
  at([H.bp, H.bpText, H.scaleText], { opacity: 0, duration: .6 }, 4.0);
  const planInner = H.planLabels.map(a => a.inner);
  gsap.set(planInner, { opacity: 0, y: 10 });
  at(planInner, { opacity: 1, y: 0, duration: .45, stagger: .16, ease: 'power3.out' }, 2.1);
  at(planInner, { opacity: 0, duration: .4, stagger: .04 }, 3.75);

  // ============================================================== 02 · assembly (proxies + GSAP staggers)
  const px = n => ({ v: n });
  const halls = ['taihe', 'zhonghe', 'baohe'].map(n => heroes[n]);
  const Hp = halls.map(h => {
    const p = h.userData.parts;
    const rec = {
      h, p, plat: px(0), cols: Array.from({ length: p.columns.count }, () => px(0)), walls: p.walls.map(() => px(0)), beam: px(0), drum: px(0),
      lower: p.lowerRoof ? p.lowerRoof.bands.map(() => px(0)) : [], upper: p.upperRoof.bands.map(() => px(0)), ridge: px(0), finial: px(0),
      lowerY: p.lowerRoof?.group.position.y, finialY: p.finial?.position.y, upperY: p.upperRoof.group.position.y, drumY: p.drum?.position.y, beamY: p.beam.position.y, platY: p.platform.position.y,
    };
    return rec;
  });
  const terrace = heroes.terrace, tiers = terrace.userData.tiers, flights = terrace.userData.stairs.children;
  const tierPx = tiers.map(() => px(0)), postPx = tiers.map(t => Array.from({ length: t.userData.posts.count }, () => px(0))), flightPx = flights.map(() => px(0));
  const tilePx = Wd.tiles.userData.base.map(() => px(0));
  const nx = new Set(Wd.tiles.userData.base.map(b => b[0])).size, nz = tilePx.length / nx;
  tierPx.forEach((p, i) => at(p, { v: 1, duration: .55, ease: 'expo.out' }, 6.45 + i * .5));
  at(tilePx, { v: 1, duration: .55, ease: 'power3.out', stagger: { grid: [nx, nz], from: 'center', amount: 1.3 } }, 6.55);
  at(postPx.flat(), { v: 1, duration: .35, ease: 'back.out(3)', stagger: { amount: 1.0 } }, 7.35);
  at(flightPx, { v: 1, duration: .45, ease: 'bounce.out', stagger: .05 }, 7.8);
  at(Hp.map(h => h.plat), { v: 1, duration: .35, ease: 'expo.out', stagger: .12 }, 8.05);
  at(Hp.flatMap(h => h.cols), { v: 1, duration: .5, ease: 'back.out(1.5)', stagger: { amount: .9, from: 'edges' } }, 8.2);
  at(Hp.flatMap(h => h.walls), { v: 1, duration: .4, ease: 'expo.out', stagger: .04 }, 9.0);
  at(Hp.map(h => h.beam), { v: 1, duration: .35, ease: 'expo.out', stagger: .1 }, 9.25);
  at(Hp.flatMap(h => h.lower), { v: 1, duration: .45, ease: 'power3.out', stagger: .07 }, 9.45);
  at(Hp.map(h => h.drum), { v: 1, duration: .35, ease: 'expo.out', stagger: .08 }, 9.9);
  at(Hp.flatMap(h => h.upper), { v: 1, duration: .45, ease: 'power3.out', stagger: .06 }, 10.05);
  at(Hp.map(h => h.ridge), { v: 1, duration: .4, ease: 'expo.out', stagger: .08 }, 10.6);
  at(Hp[1].finial, { v: 1, duration: .5, ease: 'back.out(3)' }, 10.8);
  pulse('bloom', 6.45, 1.4, .75); pulse('bloom', 10.85, 1.5, .75);

  // ============================================================== 03 · axis
  const rails = new LineSet(), R = mulberry(7);
  for (let i = 0; i < 46; i++) {
    const side = i % 2 ? 1 : -1, x = side * (4 + R() * 36), y = 1.5 + R() * 30, gold = R() < .35;
    rails.seg([x, y, 70], [x, y, -150], R() * .9, .7 + R() * .5, gold ? [1, .74, .38] : [.93, .88, .78], gold ? .55 : .22);
  }
  const railMat = drawMaterial(); const railMesh = rails.build(railMat); scene.add(railMesh);
  tl.fromTo(S, { railClock: 0 }, { railClock: 4, duration: 4, ease: 'none' }, 12.3);
  at(S, { railO: 0, duration: .6 }, 15.9);
  at(S, { bpO: .3, duration: .6 }, 12.3);
  T.info.forEach(p => p.material.opacity = 0);
  [[12.3, 13.2], [13.6, 14.5], [14.8, 15.8], [15.0, 16.1]].forEach(([a, b], i) => { at(T.info[i].material, { opacity: 1, duration: .4 }, a); at(T.info[i].material, { opacity: 0, duration: .35 }, b); });
  H.rings.forEach((r, i) => {
    const [a, b] = [[12.3, 13.35], [13.75, 14.8], [15.15, 16.9]][i];
    gsap.set([r.g, r.label.inner], { opacity: 0 });
    at([r.g, r.label.inner], { opacity: 1, duration: .3 }, a);
    tl.fromTo(r.g.querySelectorAll('circle, line'), { drawSVG: '0%' }, { drawSVG: '100%', duration: .6, stagger: .004, ease: 'power3.out' }, a);
    at([r.g, r.label.inner], { opacity: 0, duration: .3 }, b);
  });

  // ============================================================== 04 · exploded axonometric
  gsap.set(H.flash, { opacity: 0 });
  tl.to(H.flash, { opacity: .55, duration: .05 }, 16.4).to(H.flash, { opacity: 0, duration: .5, ease: 'power2.out' }, 16.45);
  const exKeys = ['u', 'd', 'l', 'b', 'w', 'c', 'p', 't', 's'];
  exKeys.forEach((k, i) => at(S.ex, { [k]: 1, duration: 1.5, ease: 'burst' }, 17.15 + i * .045));
  exKeys.forEach(k => at(S.ex, { [k]: 1.12, duration: 2.2, ease: 'none' }, 18.8));
  at(S.ex, { ...Object.fromEntries(exKeys.map(k => [k, 0])), duration: .55, ease: 'power4.in' }, 21.05);
  pulse('bloom', 17.15, 1.3, .75); pulse('bloom', 21.6, 1.7, .8);
  at(S, { xl: 1, duration: .6 }, 17.6); at(S, { xl: 0, duration: .3 }, 20.8);
  gsap.set([H.explode], { opacity: 0 });
  at(H.explode, { opacity: 1, duration: .4 }, 17.7); at(H.explode, { opacity: 0, duration: .3 }, 20.85);
  const xInner = H.xLabels.map(x => x.a.inner);
  gsap.set(xInner, { opacity: 0, x: -14 });
  at(xInner, { opacity: 1, x: 0, duration: .4, stagger: .14, ease: 'power3.out' }, 17.9);
  at(xInner, { opacity: 0, duration: .25, stagger: .02 }, 20.8);
  H.xLabels.forEach(x => { x.a.manual = true; });

  // ============================================================== 05 · geometry
  gsap.set([H.abBg, H.abDisc], { opacity: 0 });
  at(H.abDisc, { opacity: 1, duration: .2, ease: 'none' }, 22.85);
  tl.set(H.abBg, { opacity: 1 }, 23.05);
  tl.fromTo(H.abDisc, { attr: { r: 1300 } }, { attr: { r: 12 }, duration: .9, ease: 'expo.inOut' }, 23.05);
  tl.fromTo(H.abRings, { drawSVG: '0%' }, { drawSVG: '100%', duration: .8, stagger: .07, ease: 'power2.out' }, 23.35);
  H.abRings.forEach((r, i) => tl.fromTo(r, { rotation: 0 }, { rotation: (i % 2 ? -1 : 1) * 60, svgOrigin: '960 540', duration: 2.6, ease: 'none' }, 23.35));
  tl.fromTo(H.abRadials.children, { drawSVG: '0%' }, { drawSVG: '100%', duration: .5, stagger: { amount: .7, from: 'random' }, ease: 'power3.out' }, 23.55);
  tl.fromTo(H.abRadials, { rotation: 0 }, { rotation: 20, svgOrigin: '960 540', duration: 2, ease: 'none' }, 23.55);
  gsap.set(H.abGrid, { opacity: 0 }); at(H.abGrid, { opacity: .8, duration: .5 }, 23.45);
  tl.fromTo(H.abCurves, { drawSVG: '0%' }, { drawSVG: '100%', duration: 1.1, stagger: .1, ease: 'power2.inOut' }, 23.7);
  at(S, { abDots: 1, duration: .6 }, 23.6);
  const ratio = H.abText.querySelector('.ratio'), cap = H.abText.querySelector('.cap');
  gsap.set(H.abText, { opacity: 1 }); gsap.set([ratio, cap], { opacity: 0 });
  const rs = new window.SplitText(ratio, { type: 'chars' });
  tl.set(ratio, { opacity: 1 }, 23.85);
  tl.fromTo(rs.chars, { opacity: 0, y: 60, scale: .8 }, { opacity: 1, y: 0, scale: 1, duration: .6, stagger: .08, ease: 'expo.out' }, 23.85);
  tl.fromTo(cap, { opacity: 0, letterSpacing: '1.2em' }, { opacity: 1, letterSpacing: '.5em', duration: .8, ease: 'power3.out' }, 24.05);
  gsap.set(H.abFacts, { opacity: 0, y: 16 });
  at(H.abFacts, { opacity: 1, y: 0, duration: .4, stagger: .1, ease: 'power3.out' }, 24.15);
  at([ratio, cap, ...H.abFacts], { opacity: 0, duration: .3 }, 24.8);
  // reveal: rings morph into footprints of the actual plan, seen from the top-down camera
  const top = new THREE.PerspectiveCamera(35, 16 / 9, .1, 5000); top.position.set(0, 559.5, -115.01); top.up.set(0, 0, -1); top.lookAt(0, 0, -115.2); top.updateMatrixWorld(); top.updateProjectionMatrix();
  const fpKeys = [[0, 0, 66, 14], [0, -32, 54, 24], [0, -122, 86, 100], [0, -100, 50, 26], [0, -124, 19, 19], [0, -146, 44, 22], [0, -212, 50, 30], [-27, 30, 12, 46], [27, 30, 12, 46]];
  const rectPath = ([x, z, w, d]) => { const a = project(new THREE.Vector3(x - w / 2, 0, z + d / 2), top), b = project(new THREE.Vector3(x + w / 2, 0, z - d / 2), top); return `M${a.x},${a.y} L${b.x},${a.y} L${b.x},${b.y} L${a.x},${b.y} Z`; };
  tl.set(H.abRings, { strokeDasharray: 'none', strokeDashoffset: 0 }, 24.75);
  H.abRings.forEach((r, i) => tl.to(r, { morphSVG: rectPath(fpKeys[i]), rotation: 0, duration: .9, ease: 'expo.inOut' }, 24.8 + i * .03));
  at([H.abRadials, ...H.abCurves], { opacity: 0, duration: .35 }, 24.8);
  at(H.abDisc, { opacity: 0, duration: .3 }, 24.85);
  at(S, { abDots: 0, duration: .3 }, 24.8);
  H.gridV.forEach((l, i) => { const x = [-120, -90, -60, -30, 30, 60, 90, 120][i], p = project(new THREE.Vector3(x, 0, -115), top); at(l, { attr: { x1: p.x, x2: p.x }, duration: .9, ease: 'expo.inOut' }, 24.85); });
  H.gridH.forEach((l, i) => { const z = [40, -40, -120, -200][i], p = project(new THREE.Vector3(0, 0, z), top); at(l, { attr: { y1: p.y, y2: p.y }, duration: .9, ease: 'expo.inOut' }, 24.85); });
  gsap.set(H.abReveal, { opacity: 0 });
  tl.fromTo(H.abReveal, { opacity: 0, letterSpacing: '1.1em' }, { opacity: 1, letterSpacing: '.55em', duration: .8, ease: 'power3.out' }, 25.05);
  at(H.abReveal, { opacity: 0, duration: .4 }, 26.0);
  tl.set(S, { fog: .00035, bpO: .9, gridO: .5, gold: 1 }, 23.05);
  at(H.abBg, { opacity: 0, duration: .6 }, 25.45);
  at([...H.abRings, H.abGrid], { opacity: 0, duration: .45 }, 25.95);
  pulse('bloom', 23.0, 1.6, .8);

  // ============================================================== 06 · typography × architecture
  gsap.set(H.maskRect, { opacity: 0 }); gsap.set(H.maskOutline, { opacity: 0 });
  tl.set(H.maskRect, { opacity: 1 }, 26.2);
  tl.fromTo(H.maskChars, { scale: 7, transformOrigin: '50% 50%' }, { scale: 1, duration: .9, stagger: .13, ease: 'expo.out' }, 26.2);
  tl.fromTo(H.outlineChars, { scale: 7, transformOrigin: '50% 50%' }, { scale: 1, duration: .9, stagger: .13, ease: 'expo.out' }, 26.2);
  at(H.maskOutline, { opacity: .8, duration: .5 }, 26.55);
  const capSpans = H.maskCaption.querySelectorAll('span');
  gsap.set(capSpans, { opacity: 0, y: 12 });
  at(capSpans, { opacity: 1, y: 0, duration: .35, stagger: .09, ease: 'power3.out' }, 26.9);
  at(capSpans, { opacity: 0, duration: .25, stagger: .03 }, 27.75);
  at(H.maskChars, { scale: 9, duration: .7, stagger: .05, ease: 'expo.in' }, 27.9);
  at(H.outlineChars, { scale: 9, duration: .7, stagger: .05, ease: 'expo.in' }, 27.9);
  at(H.maskOutline, { opacity: 0, duration: .3 }, 28.1);
  at(H.maskRect, { opacity: 0, duration: .3 }, 28.35);
  at(S, { bpO: .18, gridO: .1, gold: .7, duration: 1.2 }, 26.6);
  at(S, { fog: .0024, duration: 1.6, ease: 'power2.in' }, 26.6);
  // 3D letters: FORBIDDEN passes behind the tower roof; 紫禁城 emerges from the three tunnels
  T.forbidden.forEach(p => p.material.opacity = 0);
  tl.fromTo(T.forbidden.map(p => p.position), { x: i => T.forbidden[i].userData.home.x + 150 }, { x: i => T.forbidden[i].userData.home.x, duration: 1.5, stagger: .07, ease: 'expo.out' }, 28.65);
  tl.fromTo(T.forbidden.map(p => p.material), { opacity: 0 }, { opacity: 1, duration: .4, stagger: .07 }, 28.65);
  at(T.forbidden.map(p => p.position), { y: '+=9', duration: .6, stagger: .035, ease: 'power3.in' }, 30.35);
  at(T.forbidden.map(p => p.material), { opacity: 0, duration: .45, stagger: .035 }, 30.45);
  T.chars.forEach(p => { p.material.opacity = 0; });
  tl.fromTo(T.chars.map(p => p.position), { z: -5 }, { z: 13, duration: 1.3, stagger: .28, ease: 'power3.out' }, 29.0);
  tl.fromTo(T.chars.map(p => p.scale), { x: .45, y: .45 }, { x: 1, y: 1, duration: 1.3, stagger: .28, ease: 'power3.out' }, 29.0);
  tl.fromTo(T.chars.map(p => p.material), { opacity: 0 }, { opacity: 1, duration: .5, stagger: .28 }, 29.0);
  at(T.chars.map(p => p.material), { opacity: 0, duration: .4 }, 30.55);
  T.wall.material.opacity = 0; T.wall.scale.x = .001;
  tl.fromTo(T.wall.scale, { x: .001 }, { x: 1, duration: 1.0, ease: 'expo.out' }, 29.45);
  tl.fromTo(T.wall.material, { opacity: 0 }, { opacity: 1, duration: .3 }, 29.45);
  at(T.wall.material, { opacity: 0, duration: .4 }, 30.55);
  pulse('bloom', 29.0, 1.2, .8);

  // ============================================================== 07 · particle reconstruction (separate sub-timeline)
  ptl.fromTo(PS, { time: 0 }, { time: 12, duration: 7, ease: 'none' }, 31.5);
  ptl.to(PS, { alpha: 1, duration: .3, ease: 'power1.out' }, 32.0);
  ptl.to(PS, { hold: 1, duration: 1.0, ease: 'sine.inOut' }, 32.2);
  ptl.to(PS, { flow: 1, duration: 1.9, ease: 'power2.inOut' }, 33.0);
  ptl.to(PS, { cloud: 1, duration: 1.2 }, 34.6);
  ptl.to(PS, { contour: 1, duration: .95 }, 35.8);
  ptl.to(PS, { rebuild: 1, duration: 1.1, ease: 'power3.inOut' }, 36.7);
  ptl.to(PS, { alpha: 0, duration: .35 }, 37.75);
  ptl.set(PS, {}, 44);
  tl.set(S, { heroHide: 1 }, 32.35); tl.set(S, { heroHide: 0 }, 37.75);
  at(S, { exposure: .8, duration: 1.2 }, 33.0); at(S, { exposure: 1.02, duration: .8 }, 37.7);
  pulse('bloom', 32.0, 1.0, .6, .2, .6); pulse('bloom', 37.75, 1.8, .85);
  pulse('gold', 37.75, 1.6, .8, .06, .9);

  // ============================================================== 08 · monument
  at([H.frame, H.frameText], { opacity: 0, duration: 1.6 }, 38.4);
  at(S, { bpO: 0, gridO: 0, duration: 1.4 }, 38.0);
  at(S, { warm: 1, glow: 1.5, keyI: 4.0, duration: 2.5 }, 38.0);
  at(S, { shafts: 1, duration: 2.4 }, 38.4);
  at(S, { gold: .12, duration: 2.2 }, 38.3);
  at(S, { dust: 1, duration: 1.4 }, 38.4);
  at(S, { fog: .002, duration: 2 }, 38.0);
  const zh = H.title.querySelector('.zh'), en = H.title.querySelector('.en'), rule = H.title.querySelector('.rule'), meta = H.title.querySelector('.meta');
  const zs = new window.SplitText(zh, { type: 'chars' }), es = new window.SplitText(en, { type: 'chars' });
  gsap.set(H.title, { opacity: 1 }); gsap.set([zh, en, meta], { opacity: 0 }); gsap.set(rule, { scaleX: 0 });
  tl.set([zh, en], { opacity: 1 }, 40.2);
  tl.fromTo(zs.chars, { opacity: 0, y: 18, filter: 'blur(8px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.1, stagger: .18, ease: 'power3.out' }, 40.2);
  tl.fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: 1.0, ease: 'expo.inOut' }, 40.8);
  tl.fromTo(es.chars, { opacity: 0 }, { opacity: 1, duration: .5, stagger: { amount: .6, from: 'center' }, ease: 'none' }, 41.1);
  tl.fromTo(meta, { opacity: 0, letterSpacing: '.9em' }, { opacity: .7, letterSpacing: '.6em', duration: 1.0, ease: 'power3.out' }, 41.5);
  // the first line of the film returns on the last beat
  tl.fromTo(S, { axisDraw: 0 }, { axisDraw: 1, duration: .5, ease: 'expo.out' }, 42.0);
  tl.set(S, { axisO: 1 }, 42.0); at(S, { axisO: .35, duration: 1.2 }, 42.5);
  pulse('bloom', 42.5, 1.5, .85, .06, .9);
  at(S, { fade: 1, duration: .75, ease: 'power2.in' }, 43.25);
  tl.set(S, {}, ctx.DUR);

  // ============================================================== per-frame application
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), vp = new THREE.Vector3();
  const upA = new THREE.Vector3(0, 0, -1), upB = new THREE.Vector3(0, 1, 0);
  const goldMats = [M.goldLine, Wd.batchLines.material];
  const doorMats = [M.door, Wd.batchDoor];
  const xlGeo = new THREE.BufferGeometry(); xlGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(16 * 3 * 2 * 4), 3));
  const xlMesh = new THREE.LineSegments(xlGeo, new THREE.LineDashedMaterial({ color: new THREE.Color(.95, .88, .75).multiplyScalar(1.4), dashSize: .7, gapSize: .5, transparent: true, opacity: 0, toneMapped: false, depthWrite: false }));
  xlMesh.frustumCulled = false; scene.add(xlMesh);
  const setInst = (mesh, bases, fn) => { bases.forEach((b, i) => { const r = fn(b, i); mesh.setMatrixAt(i, r); }); mesh.instanceMatrix.needsUpdate = true; };
  const vis = (o, v) => { o.visible = v > .002; };

  function apply(t) {
    // camera
    let s = shots[0]; for (const x of shots) if (t >= x.t0) s = x;
    const u = THREE.MathUtils.clamp(s.u.v, 0, 1);
    camera.position.copy(s.pos.getPointAt(u));
    camera.up.copy(upA).lerp(upB, S.up).normalize();
    camera.lookAt(s.tgt.getPointAt(u));
    camera.fov = S.fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    // global look
    renderer.toneMappingExposure = S.exposure; scene.fog.density = S.fog; bloom.strength = S.bloom;
    grade.uniforms.uTime.value = t; grade.uniforms.uFade.value = S.fade;
    key.intensity = S.keyI; sky.material.uniforms.uWarm.value = S.warm;
    shafts.children.forEach(m => { m.material.opacity = S.shafts; });
    P.dust.material.uniforms.uTime.value = t; P.dust.material.uniforms.uAlpha.value = S.dust; P.dust.visible = S.dust > 0;
    lines.mats.plan.uniforms.uClock.value = S.clock; lines.mats.grid.uniforms.uClock.value = S.clock; lines.mats.vert.uniforms.uClock.value = S.clock;
    lines.mats.plan.uniforms.uOpacity.value = S.bpO; lines.mats.grid.uniforms.uOpacity.value = S.gridO; lines.mats.vert.uniforms.uOpacity.value = S.vertO;
    lines.plan.visible = S.bpO > .001; lines.grid.visible = S.gridO > .001; lines.vert.visible = S.vertO > .001;
    railMat.uniforms.uClock.value = S.railClock; railMat.uniforms.uOpacity.value = S.railO; railMesh.visible = S.railClock > 0 && S.railO > .001;
    Wd.uniforms.uRise.value = S.rise;
    goldMats.forEach(m => { m.opacity = Math.min(1, S.gold); }); M.goldLine.color.setRGB(1, .66, .26).multiplyScalar(1.8 * Math.max(1, S.gold));
    doorMats.forEach(m => { m.emissiveIntensity = S.glow; });
    for (const n of ['meridian', 'taihemen']) vis(heroes[n], heroes[n].scale.y);
    // terrace
    const ex = S.ex;
    tiers.forEach((tr, i) => {
      const v = tierPx[i].v; vis(tr, v);
      tr.position.x = (i % 2 ? 1 : -1) * (1 - v) * 190;
      tr.position.y = tr.userData.home.y - ex.t * (i + 1) * 1.6;
      setInst(tr.userData.posts, tr.userData.posts.userData.base, (b, k) => { const pv = postPx[i][k].v; return m4.compose(vp.set(b.x, b.y - (1 - pv) * .5, b.z), q.identity(), sc.set(1, Math.max(pv, .001), 1)); });
      tr.userData.rails.forEach(r => { r.visible = postPx[i][postPx[i].length - 1].v > .5; });
    });
    flights.forEach((f, i) => { const v = flightPx[i].v; vis(f, v); f.position.set(0, (1 - v) * 14 - ex.s * 2.2, ex.s * 9); });
    heroes.terrace.visible = S.heroHide < .5;
    // courtyard tiles
    setInst(Wd.tiles, Wd.tiles.userData.base, ([x, z], i) => { const v = tilePx[i].v; q.setFromAxisAngle(vp.set(1, 0, 0), (1 - v) * Math.PI); return m4.compose(vp.set(x, .08 + (1 - v) * 7, z), q, sc.setScalar(Math.max(.001, v < .001 ? .001 : .35 + .65 * v))); });
    // halls
    Hp.forEach((r, hi) => {
      const k = hi === 0 ? 1 : .55, p = r.p;
      r.h.visible = S.heroHide < .5;
      p.platform.scale.y = Math.max(r.plat.v, .001); p.platform.position.y = r.platY * r.plat.v - ex.p * 1.8 * k; vis(p.platform, r.plat.v);
      const cb = p.columns.userData.base;
      setInst(p.columns, cb, (b, i) => { const v = r.cols[i].v; return m4.compose(vp.set(b.x * (1 + .32 * ex.c * k), b.y + (1 - v) * 24, b.z * (1 + .55 * ex.c * k)), q.identity(), sc.set(1, v < .001 ? .001 : 1, 1)); });
      p.walls.forEach((w, i) => { const v = r.walls[i].v; vis(w, v); w.scale.y = Math.max(v, .001); w.position.copy(w.userData.home).addScaledVector(w.userData.dir, ex.w * 7 * k); w.position.y -= (1 - v) * w.geometry.parameters.height / 2; });
      p.beam.scale.x = Math.max(r.beam.v, .001); vis(p.beam, r.beam.v); p.beam.position.y = r.beamY + ex.b * 5 * k;
      if (p.lowerRoof) { p.lowerRoof.group.position.y = r.lowerY + ex.l * 10 * k; p.lowerRoof.bands.forEach((b, i) => { const v = r.lower[i].v; vis(b, v); b.position.y = (1 - v) * 16; b.rotation.y = (1 - v) * .3; }); }
      if (p.drum) { p.drum.scale.y = Math.max(r.drum.v, .001); vis(p.drum, r.drum.v); p.drum.position.y = r.drumY + ex.d * 15 * k; }
      p.upperRoof.group.position.y = r.upperY + ex.u * 21 * k;
      p.upperRoof.bands.forEach((b, i) => { const v = r.upper[i].v; vis(b, v); b.position.y = (1 - v) * 18; b.rotation.y = (1 - v) * -.3; });
      if (p.upperRoof.ridge) { p.upperRoof.ridge.scale.x = Math.max(r.ridge.v, .001); vis(p.upperRoof.ridge, r.ridge.v); }
      if (p.finial) { p.finial.scale.setScalar(Math.max(r.finial.v, .001)); vis(p.finial, r.finial.v); p.finial.position.y = r.finialY + ex.u * 21 * k; }
    });
    // exploded diagram: corner guides + labels
    xlMesh.material.opacity = S.xl; xlMesh.visible = S.xl > .001;
    if (S.xl > .001) {
      const th = Hp[0], p = th.p, pos = xlGeo.attributes.position; let n = 0;
      const tops = [p.upperRoof.group.position.y + 6, p.drum.position.y, p.lowerRoof.group.position.y + 2, p.beam.position.y, 1];
      for (const [cx, cz] of [[23, 11], [-23, 11], [23, -11], [-23, -11]]) {
        const a = th.h.localToWorld(vp.set(cx, -8 - ex.t * 4, cz)).clone(), b = th.h.localToWorld(new THREE.Vector3(cx, tops[0], cz));
        pos.setXYZ(n++, a.x, a.y, a.z); pos.setXYZ(n++, b.x, b.y, b.z);
        for (const y of tops) { const c = th.h.localToWorld(new THREE.Vector3(cx, y, cz)); pos.setXYZ(n++, c.x - 1.2, c.y, c.z); pos.setXYZ(n++, c.x + 1.2, c.y, c.z); }
      }
      xlGeo.setDrawRange(0, n); pos.needsUpdate = true; xlMesh.computeLineDistances();
      // label dots on the actual components
      const W0 = [
        th.h.localToWorld(new THREE.Vector3(14, p.upperRoof.group.position.y + 4, -4)),
        th.h.localToWorld(new THREE.Vector3(25, p.lowerRoof.group.position.y + 1, -8)),
        th.h.localToWorld(new THREE.Vector3(22, p.beam.position.y, -10.5)),
        th.h.localToWorld(new THREE.Vector3(22.3 * (1 + .32 * ex.c), 6, -10.3 * (1 + .55 * ex.c))),
        th.h.localToWorld(new THREE.Vector3(20.6 + ex.w * 7, 5, -6)),
        new THREE.Vector3(37, 7.2 - ex.t * 4.8, -120),
      ];
      const ys = W0.map(w => project(w, camera));
      let lastY = 38;
      const order = ys.map((p, i) => [p.y, i]).sort((a, b) => a[0] - b[0]);
      const labelY = []; for (const [y, i] of order) { const yy = Math.max(y, lastY + 92); labelY[i] = yy; lastY = yy; }
      H.xLabels.forEach((x, i) => {
        const p = ys[i], lx = 1380, ly = Math.min(1000, Math.max(130, labelY[i]));
        x.dot.setAttribute('cx', p.x); x.dot.setAttribute('cy', p.y);
        x.line.setAttribute('x1', p.x); x.line.setAttribute('y1', p.y); x.line.setAttribute('x2', lx - 16); x.line.setAttribute('y2', ly);
        x.a.wrap.style.transform = `translate(${lx}px, ${ly}px)`;
        const w = W0[i]; x.xyz.textContent = `X ${fmt(w.x)}  Y ${fmt(w.y * 3)}  Z ${fmt(w.z)}`;
      });
    }
    // particles
    P.group.visible = PS.alpha > .001;
    if (P.group.visible) {
      P.U.uK.value.set(PS.hold, PS.flow, PS.cloud, PS.contour); P.U.uRebuild.value = PS.rebuild; P.U.uTime.value = PS.time; P.U.uAlpha.value = PS.alpha;
    }
    // 3D type visibility
    for (const p of [...T.forbidden, ...T.chars, T.wall, ...T.info]) p.visible = p.material.opacity > .002;
    // closing axis line
    const ap = axisLine.geometry.attributes.position; ap.setXYZ(1, 0, .25, 62 - 362 * S.axisDraw); ap.needsUpdate = true;
    axisLine.material.opacity = S.axisO; axisLine.visible = S.axisO > .001 && S.axisDraw > 0;
  }
  function captureParticlePrev() { P.U.uKp.value.set(PS.hold, PS.flow, PS.cloud, PS.contour); P.U.uRebuildP.value = PS.rebuild; P.U.uTimeP.value = PS.time; }
  return { tl, ptl, apply, captureParticlePrev, S };
}

const fmt = v => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2).padStart(6, '0');
function mulberry(seed) { return () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
