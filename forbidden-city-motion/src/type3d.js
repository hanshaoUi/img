// Typography that lives inside the 3D scene: it is occluded by roofs, emerges from tunnels
// and attaches to walls. Each glyph or line is a plane with a canvas texture.
import * as THREE from 'three';

export const LATIN = '"Inter", "Helvetica Neue", Arial, sans-serif';
export const HAN = '"Noto Sans SC", "Inter", sans-serif';

export function textPlane(str, { font = LATIN, weight = 700, px = 220, height = 10, color = '#efe6d2', glow = 1, spacing = 0, align = 'center', pad = .15 } = {}) {
  const c = document.createElement('canvas'), g = c.getContext('2d');
  g.font = `${weight} ${px}px ${font}`; g.letterSpacing = spacing + 'px';
  const w = Math.ceil(g.measureText(str).width + px * pad * 2), h = Math.ceil(px * 1.35);
  c.width = w; c.height = h;
  g.font = `${weight} ${px}px ${font}`; g.letterSpacing = spacing + 'px'; g.textBaseline = 'middle'; g.fillStyle = color;
  g.fillText(str, px * pad, h / 2 + px * .04);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  mat.color.setScalar(glow);
  const geo = new THREE.PlaneGeometry(height * w / h, height);
  if (align === 'left') geo.translate(height * w / h / 2, 0, 0);
  const m = new THREE.Mesh(geo, mat); m.renderOrder = 5;
  m.userData.width = height * w / h;
  return m;
}
