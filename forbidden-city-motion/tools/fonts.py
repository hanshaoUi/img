"""Copy only the font files this film needs into fonts/ and write fonts/fonts.css.

Inter (Latin) weights 200–700, and the Noto Sans SC unicode-range chunks that contain the
Chinese characters actually used in index.html and src/*.js.
"""
import glob, os, re, shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FS = os.path.join(ROOT, 'node_modules', '@fontsource')
OUT = os.path.join(ROOT, 'fonts')
os.makedirs(OUT, exist_ok=True)

text = ''.join(open(p, encoding='utf-8').read() for p in [os.path.join(ROOT, 'index.html')] + glob.glob(os.path.join(ROOT, 'src', '*.js')))
cjk = sorted({c for c in text if ord(c) > 0x2E80})

def ranges(s):
    out = []
    for part in s.split(','):
        part = part.strip().lower().replace('u+', '')
        a, _, b = part.partition('-')
        out.append((int(a, 16), int(b or a, 16)))
    return out

css = []
for w in (200, 300, 400, 500, 700):
    f = f'inter-latin-{w}-normal.woff2'
    shutil.copy(os.path.join(FS, 'inter', 'files', f), OUT)
    css.append(f"@font-face{{font-family:'Inter';font-style:normal;font-weight:{w};font-display:block;src:url(./{f}) format('woff2');}}")
for w in (300, 400, 700, 900):
    src = open(os.path.join(FS, 'noto-sans-sc', f'{w}.css'), encoding='utf-8').read()
    for block in re.findall(r'@font-face\s*{[^}]*}', src):
        f = re.search(r'files/([^)]+\.woff2)', block).group(1)
        ur = re.search(r'unicode-range:\s*([^;]+);', block).group(1)
        rs = ranges(ur)
        if any(a <= ord(c) <= b for c in cjk for a, b in rs):
            shutil.copy(os.path.join(FS, 'noto-sans-sc', 'files', f), OUT)
            css.append(f"@font-face{{font-family:'Noto Sans SC';font-style:normal;font-weight:{w};font-display:block;src:url(./{f}) format('woff2');unicode-range:{ur};}}")
open(os.path.join(OUT, 'fonts.css'), 'w').write('\n'.join(css) + '\n')
print(len(cjk), 'CJK chars:', ''.join(cjk))
print(len(os.listdir(OUT)) - 1, 'font files')
