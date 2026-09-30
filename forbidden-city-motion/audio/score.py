"""Procedural score & sound design for the Forbidden City film → audio/score.wav (+ .m4a).

Everything is synthesized: drones, sub impacts, cinematic toms, metallic resonances, whooshes,
mechanical assembly clicks, granular particle textures and a Karplus–Strong plucked string for a
restrained Chinese colour (D minor pentatonic). Cue times mirror src/timeline.js.
"""
import os, subprocess, wave
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000
DUR = 44.0
N = int(SR * DUR)
rng = np.random.default_rng(1420)
mix = np.zeros((N, 2))      # dry bus
verb = np.zeros((N, 2))     # reverb send
BPM = 120; BEAT = 60 / BPM; B0 = 6.45  # the groove's downbeat = the first assembly impact

def tt(n): return np.arange(n) / SR
def midi(m): return 440 * 2 ** ((m - 69) / 12)
def env(n, a=.005, d=.3, hold=0.0):
    t = tt(n); e = np.minimum(1, t / max(a, 1e-4)); return e * np.where(t < a + hold, 1, np.exp(-(t - a - hold) / d))
def filt(x, kind, f, order=2):
    f = np.clip(np.atleast_1d(f), 20, SR / 2 - 100)
    return sosfilt(butter(order, f if len(f) > 1 else f[0], kind, fs=SR, output='sos'), x)
def place(sig, t, pan=0.0, gain=1.0, send=.25):
    i = int(t * SR)
    if i >= N or len(sig) == 0: return
    if i < 0: sig = sig[-i:]; i = 0
    sig = sig[:N - i] * gain
    if sig.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        sig = np.stack([sig * l, sig * r], 1) * 1.414
    mix[i:i + len(sig)] += sig
    verb[i:i + len(sig)] += sig * send

# ------------------------------------------------------------------ instruments
def sub_drop(f0=70, f1=28, dur=1.6):
    n = int(SR * dur); t = tt(n); f = f1 + (f0 - f1) * np.exp(-t * 3.2)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, .004, dur * .45)
def kick(f0=120, f1=45, d=.28):
    n = int(SR * .5); t = tt(n); f = f1 + (f0 - f1) * np.exp(-t * 28)
    return np.tanh(1.6 * np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, .001, d))
def tom(f=70, d=.55):
    n = int(SR * 1.2); t = tt(n); ff = f * (1 + .45 * np.exp(-t * 20))
    body = np.sin(2 * np.pi * np.cumsum(ff) / SR) * env(n, .002, d)
    skin = filt(rng.standard_normal(n), 'bandpass', [150, 900]) * env(n, .001, .05) * .5
    return body + skin
def noise_burst(dur, d, lo=200, hi=12000):
    n = int(SR * dur); return filt(rng.standard_normal(n), 'bandpass', [lo, hi]) * env(n, .001, d)
def click(bright=6000):
    n = int(SR * .02); return filt(rng.standard_normal(n), 'highpass', bright) * env(n, .0003, .003)
def metal(f=220, dur=4.0, d=1.6, ratios=(1, 2.76, 5.40, 8.93, 13.34), amps=(1, .6, .4, .25, .15)):
    n = int(SR * dur); t = tt(n); s = np.zeros(n)
    for r, a in zip(ratios, amps): s += a * np.sin(2 * np.pi * f * r * t + rng.random() * 6) * np.exp(-t / (d / (1 + r * .15)))
    return s * np.minimum(1, t / .002)
def pluck(f, dur=2.5, damp=.996, bright=.5):  # Karplus–Strong
    n = int(SR * dur); p = max(2, int(SR / f)); buf = rng.uniform(-1, 1, p) * 1.0
    buf = filt(buf, 'lowpass', 1500 + bright * 8000, 1) if p > 12 else buf
    out = np.zeros(n); b = buf.copy()
    for i in range(n):
        j = i % p; out[i] = b[j]; b[j] = damp * .5 * (b[j] + b[(j + 1) % p])
    return out * env(n, .001, dur)
def whoosh(dur=1.2, f0=300, f1=4000, peak=.6):
    n = int(SR * dur); t = tt(n) / dur; x = rng.standard_normal(n); out = np.zeros(n)
    seg = 1024
    for k in range(0, n, seg):
        c = f0 * (f1 / f0) ** (t[k]); sl = slice(k, min(n, k + seg))
        out[sl] = filt(x[max(0, k - 2048):sl.stop], 'bandpass', [c * .6, c * 1.6])[-(sl.stop - k):]
    shape = np.where(t < peak, (t / peak) ** 2, np.exp(-(t - peak) / (1 - peak) * 4))
    return out * shape
def riser(dur=2.0, f0=200, f1=3000):
    n = int(SR * dur); t = tt(n); k = t / dur
    f = f0 * (f1 / f0) ** k; tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * .25 + np.sin(2 * np.pi * np.cumsum(f * 1.5) / SR) * .12
    nz = filt(rng.standard_normal(n), 'highpass', 800) * .5
    return (tone + nz) * k ** 2.2
def reverse_swell(dur=1.0):
    s = metal(180, dur + .2, 1.5)[:int(SR * dur)] + noise_burst(dur, .4, 300, 9000) * .6
    return (s * np.linspace(0, 1, len(s)) ** 2)[::-1][::-1] * np.linspace(0, 1, len(s)) ** 2
def pad(freqs, dur, a=1.5, r=2.0, cutoff=1400, detune=.004):
    n = int(SR * dur); t = tt(n); s = np.zeros(n)
    for f in freqs:
        for d in (-detune, 0, detune):
            ph = rng.random()
            s += 2 * ((t * f * (1 + d) + ph) % 1) - 1
    s = filt(s / (len(freqs) * 3), 'lowpass', cutoff)
    e = np.minimum(1, t / a) * np.minimum(1, (dur - t) / r)
    return s * np.clip(e, 0, 1)
def drone(f, dur, a=3, r=3):
    n = int(SR * dur); t = tt(n)
    s = np.sin(2 * np.pi * f * t) + .5 * np.sin(2 * np.pi * 2 * f * t + .3) + .25 * np.sin(2 * np.pi * 3.01 * f * t)
    s *= 1 + .15 * np.sin(2 * np.pi * .13 * t)
    return s * np.clip(np.minimum(t / a, (dur - t) / r), 0, 1)
def grains(dur, density, f_lo=2500, f_hi=9000, glen=.03):
    n = int(SR * dur); out = np.zeros((n, 2)); cnt = int(dur * density)
    gl = int(SR * glen); w = np.hanning(gl)
    for _ in range(cnt):
        i = rng.integers(0, max(1, n - gl)); f = rng.uniform(f_lo, f_hi); p = rng.uniform(-1, 1)
        g = np.sin(2 * np.pi * f * tt(gl)) * w * rng.uniform(.3, 1)
        out[i:i + gl, 0] += g * (1 - p) * .5; out[i:i + gl, 1] += g * (1 + p) * .5
    return out
def add(*xs):
    n = max(len(x) for x in xs); o = np.zeros(n)
    for x in xs: o[:len(x)] += x
    return o
def blip(f=2000, d=.05): n = int(SR * .15); return np.sin(2 * np.pi * f * tt(n)) * env(n, .001, d)

PENTA = [62, 65, 67, 69, 72, 74, 77, 79, 81, 84]   # D minor pentatonic

# ================================================================== 01 · origin (0 – 6.4)
place(drone(36.7, 18, 4, 4), 0, 0, .35, .1)                 # D1 bed
place(drone(55.0, 16, 5, 4), .5, 0, .18, .1)                # A1
place(pad([146.8, 220, 293.7], 7, 3, 2, 900), 0, 0, .12, .5)
line = np.sin(2 * np.pi * 1174.7 * tt(int(SR * 3))) * env(int(SR * 3), .02, 1.2) * (1 + .3 * np.sin(2 * np.pi * 7 * tt(int(SR * 3))))
place(line, .6, 0, .08, .9); place(click(3000), .6, 0, .4)
for k in range(24):                                         # blueprint data ticks on a 16th grid
    t = 1.1 + k * BEAT / 4
    if rng.random() < .75: place(click(5000 + rng.random() * 5000), t, rng.uniform(-.8, .8), .18 + .1 * (k / 24), .3)
for i in range(6): place(blip(1800 + i * 160, .04), 2.1 + i * .16, (i - 2.5) * .2, .06, .6)
place(riser(2.8, 120, 2400), 3.6, 0, .22, .5)
place(filt(rng.standard_normal(int(SR * 2.4)), 'lowpass', 180) * np.sin(np.linspace(0, np.pi, int(SR * 2.4))), 4.0, 0, .5, .2)  # walls rising rumble
for t in (3.7, 3.95): place(tom(52, .5), t, 0, .5, .3)
for t in np.linspace(4.2, 5.9, 14): place(click(2500), t + rng.uniform(-.03, .03), rng.uniform(-.9, .9), .12, .4)

# ================================================================== 02 · assembly (6.45 – 11.3)
def impact(t, big=1.0, f=196):
    place(sub_drop(80, 28, 2.2), t, 0, .9 * big, .15); place(kick(140, 42, .4), t, 0, .8 * big, .2)
    place(noise_burst(1.5, .35, 300, 9000), t, 0, .35 * big, .6); place(metal(f, 5, 2.2), t, 0, .12 * big, .9)
impact(6.45, 1.0, 146.8)
for n in range(int((11.3 - B0) / BEAT) + 1):              # groove
    t = B0 + n * BEAT
    place(kick(110, 45, .22), t, 0, .55 if n % 2 == 0 else .35, .1)
    for s in range(4): place(click(8000), t + s * BEAT / 4, .35, .06 if s % 2 else .1, .05)
    if n % 4 == 2: place(tom(88, .35), t, -.2, .3, .3)
for i, t in enumerate((6.45, 6.95, 7.45)):                 # three terrace tiers slam in
    place(tom(60, .6), t + .02, (-1, 1, -1)[i] * .4, .7, .3); place(metal(330 + i * 40, 2, .6), t + .02, 0, .08, .6)
for k in range(60): place(click(3500), 6.55 + k * 1.3 / 60 + rng.uniform(0, .02), rng.uniform(-1, 1), .15, .2)  # tiles
for k in range(40): place(click(6500), 7.35 + k / 40, rng.uniform(-.7, .7), .12, .2)                        # balustrade
for k in range(9): place(tom(120 - k * 3, .12), 7.8 + k * .05, rng.uniform(-.5, .5), .18, .2)              # stairs
for k in range(18): place(add(tom(95, .09) * .6, click(2000) * .5), 8.25 + k * .05, rng.uniform(-.8, .8), .35, .2)  # columns land
place(whoosh(.6, 200, 1500, .5), 8.95, 0, .25, .3)                                                          # walls
for k in range(10): place(metal(midi(PENTA[k % 5] + 12), 1.2, .35), 9.5 + k * .07, (k % 2 - .5), .05, .5)   # lower eaves
for k in range(13): place(metal(midi(PENTA[(k + 2) % 7] + 12), 1.2, .35), 10.1 + k * .06, ((k + 1) % 2 - .5), .05, .5)
for k in range(3): place(add(click(1500) * 2, tom(200, .08) * .4), 10.62 + k * .08, 0, .35, .3)                 # ridges snap
impact(10.85, .8, 196)

# ================================================================== 03 · axis (11.3 – 16.4)
place(whoosh(1.4, 150, 3000, .55), 11.25, 0, .5, .4)
for n in range(int((16.4 - 12.45) / BEAT)):
    t = 12.45 + n * BEAT
    place(kick(100, 44, .24), t, 0, .55, .1)
    place(click(9000), t + BEAT / 2, -.3, .12, .05)
    for s in (1, 3): place(click(7000), t + s * BEAT / 4, .3, .06, .05)
    place(pluck(midi([38, 38, 41, 43, 45, 43, 41, 36][n % 8]), 1.0, .993, .2) * .9, t, 0, .28, .2)       # bass ostinato
for t, f in ((12.3, 1600), (13.75, 1900), (15.15, 2200)):
    place(blip(f, .06), t, .4, .1, .6); place(blip(f * 1.5, .06), t + .08, .5, .06, .6)
tunnel = filt(rng.standard_normal(int(SR * .9)), 'lowpass', 400) * np.sin(np.linspace(0, np.pi, int(SR * .9)))
place(tunnel, 13.25, 0, .6, .6); place(whoosh(.9, 400, 2500, .45), 13.2, -.3, .35, .4)
place(whoosh(.8, 500, 5000, .5), 14.35, .4, .35, .4)
for k in range(8): place(whoosh(.18, 1200, 3000, .5), 14.55 + k * .09, (-1) ** k * .7, .08, .2)            # columns flicking past
place(pad([146.8, 220, 293.7, 349.2], 2.2, .8, 1.0, 2000), 15.0, 0, .12, .6)

# ================================================================== 04 · exploded (16.4 – 21.8)
place(kick(160, 50, .15), 16.4, 0, .6, .8); place(blip(3200, .5), 16.4, 0, .08, 1.0)                        # freeze
place(noise_burst(.3, .05, 3000, 12000), 16.4, 0, .15, .9)
impact(17.15, .9, 110)
place(whoosh(1.8, 200, 6000, .3), 17.15, 0, .35, .6)
for i in range(6): place(blip(1400 + i * 110, .05), 17.9 + i * .14, .5, .07, .5); place(click(6000), 17.9 + i * .14, .5, .15, .2)
place(pad([146.8, 155.6, 220, 311.1], 4.2, 1.2, 1.0, 1100), 17.4, 0, .3, .7)                                 # suspended cluster
for k in range(8): place(click(4500) * .6, 18.8 + k * .28, (-1) ** k * .4, .16, .4)
for k in range(5): place(kick(70, 38, .3), 18.95 + k * BEAT, 0, .28, .1)                                        # held breath
rs = riser(.6, 400, 5000); place(rs, 21.0, 0, .35, .4)
place((noise_burst(.6, 5, 400, 9000) * np.linspace(0, 1, int(SR * .6)) ** 3), 21.0, 0, .35, .6)             # reverse swell
impact(21.6, 1.25, 98)

# ================================================================== 05 · geometry (21.7 – 26.2)
place(riser(1.35, 200, 6000), 21.7, 0, .3, .4); place(whoosh(1.35, 300, 9000, .9), 21.7, 0, .35, .4)
place(metal(587.3, 6, 2.8), 23.0, 0, .3, 1.2); place(metal(880, 5, 2.0), 23.0, .2, .12, 1.2)                # the gold
place(grains(2.0, 120, 3000, 9000), 23.0, 0, .12, .8)
place(drone(73.4, 3.6, .4, 1.2), 23.0, 0, .18, .3)
for i in range(9): place(pluck(midi(PENTA[i]), 2.4, .997, .7), 23.35 + i * .07, (i - 4) * .18, .35, .9)      # rings = arpeggio
place(grains(1.0, 200, 5000, 12000), 23.55, 0, .08, .6)                                                        # radials
place(tom(55, .5), 23.85, 0, .4, .5); place(tom(82, .4), 24.0, 0, .3, .5)                                      # 9 : 5
for i in range(4): place(blip(2400 + i * 200, .05), 24.15 + i * .1, (i - 1.5) * .4, .06, .6)
place(whoosh(1.0, 3000, 200, .6), 24.8, 0, .3, .5)                                                             # morph
for i in range(9): place(click(3000), 25.62 + i * .012, (i - 4) * .1, .3, .3)                                   # plan locks in
place(pad([146.8, 220, 293.7], 1.8, .5, .8, 1600), 25.4, 0, .12, .6)

# ================================================================== 06 · type (26.2 – 31)
for i in range(3): place(tom(62 - i * 3, .5), 26.2 + i * .13, (i - 1) * .5, .7, .4); place(kick(150, 50, .2), 26.2 + i * .13, 0, .4, .2)
for i in range(4): place(click(5000), 26.9 + i * .09, (i - 1.5) * .4, .2, .3)
place(riser(.75, 300, 6000), 27.9, 0, .35, .4); place(whoosh(.75, 500, 8000, .95), 27.9, 0, .3, .3)
impact(28.6, .9, 146.8)
for n in range(int((31.0 - 28.6) / BEAT) + 1):
    t = 28.6 + n * BEAT
    place(kick(110, 45, .22), t, 0, .5, .1); place(click(8500), t + BEAT / 2, .3, .1, .05)
    place(pluck(midi([38, 41, 43, 45, 43][n % 5]), .9, .993, .2), t, 0, .25, .2)
for i in range(9): place(whoosh(.5, 800, 3000, .4), 28.65 + i * .07, .9 - i * .2, .1, .2)                      # FORBIDDEN slides by
for i in range(3): place(tom(46, .8), 29.0 + i * .28, (i - 1) * .6, .8, .5); place(metal(220 + i * 55, 3, 1.2), 29.0 + i * .28, (i - 1) * .6, .07, .8)
for k in range(20): place(click(7000), 29.45 + k * .03, -.6 + k * .06, .08, .2)                                  # wall text types on
place(whoosh(.8, 300, 5000, .5), 30.35, 0, .3, .4)

# ================================================================== 07 · particles (31 – 38)
place(whoosh(1.3, 200, 2500, .5), 31.0, 0, .35, .4)
place(drone(36.7, 7.5, 1.5, 2), 31.0, 0, .3, .2)
place(sub_drop(60, 30, 1.5), 32.0, 0, .5, .2)
g = grains(3.0, 380, 2500, 11000); g *= np.linspace(.3, 1, len(g))[:, None]; place(g, 32.0, 0, .16, .7)          # dissolve shimmer
swirl_n = int(SR * 2.2); sw = rng.standard_normal(swirl_n); swt = tt(swirl_n)
swf = filt(sw, 'bandpass', [400, 2600]) * np.sin(np.pi * swt / 2.2)
place(np.stack([swf * (.5 + .5 * np.sin(2 * np.pi * .9 * swt)), swf * (.5 - .5 * np.sin(2 * np.pi * .9 * swt))], 1), 33.0, 0, .45, .6)
place(pad([146.8, 174.6, 220, 261.6], 5.0, 1.5, 1.5, 1300), 33.0, 0, .12, .7)
for i, m in enumerate([62, 65, 69, 72, 74, 77, 81, 84]): place(pluck(midi(m), 2.6, .997, .8), 34.6 + i * .11, (i - 3.5) * .2, .3, .9)  # clouds
place(metal(1174.7, 3, 1.2), 35.1, 0, .06, 1.0)
for k in range(28): place(click(4000 + k * 150), 35.8 + k * .032, -.8 + k * .06, .12, .3)                          # contour lines draw
place(riser(1.05, 150, 4000), 36.7, 0, .35, .4)
place(np.linspace(0, 1, int(SR * 1.05)) ** 3 * noise_burst(1.05, 5, 300, 10000), 36.7, 0, .3, .5)
impact(37.75, 1.2, 146.8)

# ================================================================== 08 · monument (38 – 44)
place(pad([73.4, 146.8, 220, 293.7, 329.6, 440], 6.0, 2.0, 2.4, 1700, .003), 38.0, 0, .2, .7)                    # D add9, open
place(drone(36.7, 6.0, 2, 2.5), 38.0, 0, .3, .2)
for i, (m, t) in enumerate([(74, 40.2), (69, 40.56), (81, 40.92)]): place(pluck(midi(m), 3.0, .998, .5), t, (i - 1) * .3, .3, 1.0)
place(metal(293.7, 5, 2.4), 40.2, 0, .06, 1.2)
place(riser(.5, 600, 3000) * .5, 42.0, 0, .2, .4)
place(sub_drop(70, 30, 1.8), 42.5, 0, .9, .3); place(kick(140, 44, .5), 42.5, 0, .7, .3)                          # the last beat
place(metal(146.8, 3.5, 1.8), 42.5, 0, .22, 1.3); place(pluck(midi(62), 2.5, .998, .6), 42.5, 0, .35, 1.0)

# ------------------------------------------------------------------ reverb + master
def ir(sec=2.8, pre=.02):
    n = int(SR * sec); t = tt(n)
    out = np.zeros((n + int(SR * pre), 2))
    for ch in range(2):
        x = rng.standard_normal(n) * np.exp(-t / (sec / 5.5))
        out[int(SR * pre):, ch] = filt(x, 'lowpass', 6500)
    return out / np.sqrt(np.sum(out ** 2) / 2)
IR = ir()
wet = np.stack([fftconvolve(verb[:, c], IR[:, c])[:N] for c in range(2)], 1)
out = mix + wet * .5
out = filt(out.T, 'highpass', 24).T                                                                               # keep the sub clean
fade = np.ones(N); fi = int(SR * .9); fade[-fi:] = np.linspace(1, 0, fi) ** 2
out *= fade[:, None]
out = np.tanh(out / np.max(np.abs(out)) * 1.6) / np.tanh(1.6) * .93                                              # soft master limiter
here = os.path.dirname(os.path.abspath(__file__))
wav = os.path.join(here, 'score.wav')
with wave.open(wav, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((out * 32767).astype('<i2').tobytes())
print('wrote', wav)
try:
    import imageio_ffmpeg
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-y', '-loglevel', 'error', '-i', wav, '-c:a', 'aac', '-b:a', '192k', os.path.join(here, 'score.m4a')], check=True)
    print('wrote score.m4a')
except Exception as e:
    print('m4a skipped:', e)
