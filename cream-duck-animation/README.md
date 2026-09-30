# 奶油鸭 Cream Duck · 30 秒 IP 动画

成片：[`out/cream-duck-30s.mp4`](out/cream-duck-30s.mp4)（1920×1080，30fps，H.264 + AAC，30 秒）

角色按三视图还原：奶白色梨形身体、反戴红色棒球帽、招牌臭脸粗眉、大黄嘴、雀斑、黑色斜挎带 + 黄色笑脸小包。

## 分镜

| 时间 | 场景 |
| --- | --- |
| 0–5.5s | 奶油鸭从天而降，红帽子旋转飞来反扣在头上，“哼！”，标题「奶油鸭 CREAM DUCK」弹出 |
| 5.5–12s | 三视图：原地转身（正 → 右 → 后 → 正），再分成正/右/后三视图，标注「反戴红帽 / 招牌臭脸 / 笑脸挎包」 |
| 12–18s | 百变表情包：臭脸、炸毛、震惊、犯困、害羞、偷笑 |
| 18–24s | 甜品大冒险：跳过纸杯蛋糕、马卡龙、布丁，扑通跳进牛奶杯，“好甜～” |
| 24–30s | 收尾：Logo、口号「酷酷的外表 · 软软的内心」、duck.hoperp.com、一排小奶油鸭 |

场景之间用“奶油滴落”转场。背景音乐和音效由 `music.py` 合成（120 BPM，C–Am–F–G），与画面节点对齐。

## 文件

- `index.html` — 全部动画（Canvas 矢量绘制）。浏览器直接打开即可预览、拖动时间轴。
- `render.cjs` — 用 Playwright 逐帧截图，通过 ffmpeg 合成 MP4。
- `music.py` — 合成背景音乐与音效，输出 `out/music.wav`。

## 重新生成

```bash
pip install numpy imageio-ffmpeg          # ffmpeg 由 imageio-ffmpeg 提供（也可设置 FFMPEG=/path/to/ffmpeg）
npm i -g playwright                        # 或在本目录 npm i playwright
python3 music.py
NODE_PATH=$(npm root -g) node render.cjs   # → out/cream-duck-30s.mp4
# 只导出几帧检查画面：
NODE_PATH=$(npm root -g) node render.cjs --stills 3,10.5,15.5
```

修改文案、配色、时间点都在 `index.html` 里：`P` 是配色，`scene1`…`scene5` 是各场景，`SCENES` / `CUTS` 是总时间轴。
