"""合成 30 秒的背景音乐 + 音效，输出 out/music.wav。

120 BPM，C - Am - F - G 循环；音效时间点与 index.html 中的动画时间轴对齐。
只依赖 numpy。
"""
import os
import wave

import numpy as np

SR = 44100
DUR = 30.0
BEAT = 0.5  # 120 BPM
BAR = BEAT * 4
N = int(SR * DUR)
mix = np.zeros((N, 2))


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def add(sig, t, pan=0.0, gain=1.0):
    i = int(t * SR)
    if i >= N:
        return
    sig = sig[: N - i] * gain
    mix[i:i + len(sig), 0] += sig * (1 - pan) * 0.5 ** 0.5 * 1.2
    mix[i:i + len(sig), 1] += sig * (1 + pan) * 0.5 ** 0.5 * 1.2


def env(n, a=0.005, d=0.3):
    t = np.arange(n) / SR
    return np.minimum(1, t / a) * np.exp(-t / d)


def pluck(f, dur=0.6, d=0.25, harm=(1, .5, .25, .12)):
    n = int(SR * dur)
    t = np.arange(n) / SR
    s = sum(h * np.sin(2 * np.pi * f * (k + 1) * t) for k, h in enumerate(harm))
    return s * env(n, 0.004, d)


def glock(f, dur=0.9):
    n = int(SR * dur)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * t) * np.exp(-t / .35) + .35 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t / .08)
    return s * np.minimum(1, t / .002)


def bass(f, dur=0.45):
    n = int(SR * dur)
    t = np.arange(n) / SR
    return (np.sin(2 * np.pi * f * t) + .3 * np.sin(2 * np.pi * 2 * f * t)) * env(n, .01, .22)


def kick():
    n = int(SR * .25)
    t = np.arange(n) / SR
    f = 50 + 90 * np.exp(-t / .03)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .12)


def noise_burst(dur, d, hp=True, seed=0):
    n = int(SR * dur)
    r = np.random.default_rng(seed).standard_normal(n)
    if hp:
        r = np.diff(r, prepend=0)
    return r * env(n, .002, d)


def sweep(f0, f1, dur, d=None):
    n = int(SR * dur)
    t = np.arange(n) / SR
    f = f0 * (f1 / f0) ** (t / dur)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR)
    return s * (env(n, .004, d) if d else np.sin(np.pi * t / dur))


# ---------------------------------------------------------------- 音乐
CHORDS = [(48, [60, 64, 67]), (45, [57, 60, 64]), (41, [57, 60, 65]), (43, [55, 59, 62])]  # C Am F G
# 4 小节乐句：(小节, 拍, midi, 时值拍数)
MELODY = [
    (0, 0, 76, 1), (0, 1, 79, .5), (0, 1.5, 76, .5), (0, 2, 84, 1), (0, 3, 79, 1),
    (1, 0, 81, 1), (1, 1, 79, .5), (1, 1.5, 76, .5), (1, 2, 72, 1), (1, 3, 76, 1),
    (2, 0, 77, 1), (2, 1, 81, .5), (2, 1.5, 84, .5), (2, 2, 81, 1), (2, 3, 77, .5), (2, 3.5, 79, .5),
    (3, 0, 79, 1.5), (3, 1.5, 83, .5), (3, 2, 86, 1), (3, 3, 83, .5), (3, 3.5, 79, .5),
]
N_BARS = int(DUR / BAR)
for b in range(N_BARS):
    t0 = b * BAR
    root, chord = CHORDS[b % 4]
    last = b == N_BARS - 1
    if last:  # 结尾：长长的 C 和弦
        for k, m in enumerate([48, 60, 64, 67, 72]):
            add(pluck(midi(m), 2.0, .9), t0 + k * .03, pan=(k - 2) * .15, gain=.22)
        add(glock(midi(84), 1.8), t0 + .1, gain=.25)
        continue
    intro = b == 0
    # 贝斯 + 底鼓
    if not intro:
        for beat in (0, 2):
            add(bass(midi(root)), t0 + beat * BEAT, gain=.45)
            add(kick(), t0 + beat * BEAT, gain=.35)
        add(bass(midi(root + 7)), t0 + 3.5 * BEAT, gain=.3)
    # 反拍和弦（尤克里里感）
    for beat in ((1, 3) if not intro else (0, 2)):
        for k, m in enumerate(chord):
            add(pluck(midi(m), .5, .16), t0 + beat * BEAT + k * .012, pan=-.25, gain=.16)
    # 沙锤
    if not intro:
        for e in range(8):
            add(noise_burst(.06, .018, seed=b * 8 + e), t0 + e * BEAT / 2, pan=.3, gain=.05 if e % 2 else .03)
    # 旋律（第 1 小节开始，最后两小节前收）
    if 1 <= b <= N_BARS - 2:
        for (mb, beat, m, ln) in MELODY:
            if mb == (b - 1) % 4:
                add(glock(midi(m), max(.4, ln * BEAT + .3)), t0 + beat * BEAT, pan=.2, gain=.26)
    if intro:
        for k, m in enumerate([72, 76, 79, 84]):
            add(glock(midi(m), .8), .1 + k * .12, gain=.18)

# ---------------------------------------------------------------- 音效（与动画时间轴对齐）
def pop(t, f=900, g=.35):
    add(sweep(f, f * 2.2, .09, .05), t, gain=g)


def boing(t, g=.3):
    add(sweep(180, 520, .22, .12), t, gain=g)


def thud(t, g=.5):
    add(kick(), t, gain=g)
    add(noise_burst(.15, .04, hp=False, seed=int(t * 100)), t, gain=.08)


def whoosh(t, g=.18):
    n = int(SR * .7)
    r = np.random.default_rng(int(t * 10)).standard_normal(n)
    r = np.convolve(r, np.ones(12) / 12, mode='same')
    add(r * np.sin(np.pi * np.arange(n) / n) ** 2, t, gain=g)


def sparkle(t, g=.15):
    for k, m in enumerate([84, 88, 91, 96]):
        add(glock(midi(m), .5), t + k * .05, pan=(k - 1.5) * .3, gain=g)


# 场景 1
add(sweep(1400, 300, .6), .25, gain=.12)   # 下落
thud(.9)
whoosh(1.3)
pop(2.2, 700, .4)
add(sweep(500, 260, .18, .1), 2.32, gain=.25)  # “哼！”
for i in range(3):
    pop(2.6 + i * .15, 800 + i * 150)
sparkle(3.3)
# 转场
for t in (4.95, 11.45, 17.45, 23.45):
    whoosh(t, .2)
# 场景 2：转身、分身、标注
for t in (6.1, 7.2, 8.3):
    add(sweep(400, 1200, .25), t, gain=.12)
pop(9.1, 600, .3)
for i in range(3):
    pop(10.1 + i * .4, 1000)
# 场景 3：六张表情卡片
for i in range(6):
    pop(12.5 + i * .28, 700 + i * 90, .3)
# 场景 4：跳跳跳 + 扑通
for a, b in ((18.3, 19.0), (19.4, 20.0), (20.4, 21.0)):
    boing(a)
    thud(b, .3)
boing(21.4, .35)
add(noise_burst(.8, .25, hp=False, seed=5), 22.0, gain=.35)  # 水花
thud(22.0, .3)
pop(22.45, 500, .4)
sparkle(23.1)
# 场景 5：Logo
boing(24.0, .25)
thud(24.7, .3)
for i in range(3):
    pop(24.3 + i * .15, 800 + i * 150)
sparkle(25.5)
pop(26.1, 1100, .3)
sparkle(26.6, .12)

# ---------------------------------------------------------------- 输出
fade = np.ones(N)
fn = int(SR * 1.2)
fade[-fn:] = np.linspace(1, 0, fn)
mix *= fade[:, None]
mix /= np.max(np.abs(mix)) / 0.89
os.makedirs(os.path.join(os.path.dirname(__file__), 'out'), exist_ok=True)
path = os.path.join(os.path.dirname(__file__), 'out', 'music.wav')
with wave.open(path, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype('<i2').tobytes())
print('wrote', path)
