# 紫禁城 · Forbidden City — a procedural motion film

A 44-second cinematic motion-graphics film in which the Forbidden City is generated, animated and
transformed entirely in code. One paused **GSAP** master timeline is seeked once per frame and drives
everything: camera splines, line-drawing clocks, hundreds of per-component assembly proxies, the
exploded axonometric, SVG strokes and morphs, letter masks, 3D typography and the particle system.

- **Film:** [`out/forbidden-city.mp4`](out/forbidden-city.mp4) — 1920×1080, 30 fps, H.264 + AAC
- **Live version:** open `index.html` through any static server (`npx serve .`) and click to play.

## Sequences

| Time | Sequence | What happens |
| --- | --- | --- |
| 0.0 | 01 Origin | A single axis line in darkness; the plan draws itself (grid, footprints, circular guides, ticks, dimension lines). The camera cranes from top-down plan into elevation while walls rise as light, then as matter, and roof edges ignite. |
| 6.4 | 02 Assembly | The triple marble terrace slams in on the beat, 400+ courtyard tiles flip in a centre-out grid stagger, balustrades, stairs, 100+ columns, walls, beams and roof bands cascade into the three great halls. |
| 11.4 | 03 Axis | The camera swings south and flies the central axis: through the Meridian Gate tunnel, over the Golden Water bridges, between the columns of the Gate of Supreme Harmony, with spatial text, perspective rails and rotating interface rings attached to the architecture. |
| 16.4 | 04 Exploded | Freeze. The Hall of Supreme Harmony separates into roof, drum, eaves, beam ring, column grid, lattice walls and terrace tiers, with live coordinates and connector lines — then collapses in one synchronized motion. |
| 21.8 | 05 Geometry | The camera pushes into the gilded finial of the Hall of Central Harmony; the gold becomes concentric rings in the 9:5 imperial ratio, radials, a 9×5 module grid and orbiting points, which morph into the real plan footprints and hand back to the 3D scene. |
| 26.2 | 06 Type | 紫禁城 becomes a mask that reveals the palace; FORBIDDEN slides behind the gate tower's roof; 紫 禁 城 emerge from the three tunnels; text attaches to the gate wall. |
| 31.0 | 07 Particle | The terrace and halls dissolve into 46,000 particles that hold the silhouette, flow through a noise field with trails, form auspicious cloud curves, become the elevation drawing of the Hall of Supreme Harmony, and rebuild the palace. |
| 38.0 | 08 Monument | Interface elements withdraw; the axis in warm light; a restrained title; the opening axis line returns on the final beat. |

## How it is built

- `src/world.js` — procedural architecture. Hip roofs are lofted surfaces with a concave profile,
  corner lift and flare; halls are assembled from platform, instanced column grid, lattice walls,
  beam ring, double eaves and ridges. The Meridian Gate base is an extruded shape with real tunnels.
  Background architecture is merged into a few draw calls that rise in a wave via a vertex-shader delay.
- `src/blueprint.js` — GPU "DrawSVG" for 3D lines: every segment has its own start and duration.
- `src/particles.js` — stateless particle system; positions are a pure function of GSAP-driven
  uniforms, trails are drawn from the state 0.12 s earlier with energy-conserving brightness.
- `src/timeline.js` — the whole choreography (GSAP timeline, staggers incl. grid staggers,
  DrawSVG, MorphSVG, SplitText, CustomEase) and the per-frame application to the scene.
- `src/hud.js`, `src/type3d.js` — editorial HUD, 3D-anchored labels, abstract composition, letter mask, 3D glyphs.
- `audio/score.py` — the score and sound design, synthesized with numpy/scipy on the same cue times.
- `render.cjs` — frame-accurate offline renderer (Playwright + ffmpeg, parallel workers).

## Rebuild

```bash
npm install                      # three, gsap, fonts (only needed for tools/fonts.py)
pip install numpy scipy imageio-ffmpeg
python3 audio/score.py           # → audio/score.wav + score.m4a
NODE_PATH=$(npm root -g) node render.cjs --workers 3            # → out/forbidden-city.mp4
NODE_PATH=$(npm root -g) node render.cjs --stills 5.5,19.5,35.4 # spot-check frames
```
Libraries are vendored in `vendor/` (three r186, GSAP 3.15 with DrawSVG, MorphSVG, SplitText,
CustomEase); `tools/fonts.py` extracts the Inter and Noto Sans SC subsets used into `fonts/`.
