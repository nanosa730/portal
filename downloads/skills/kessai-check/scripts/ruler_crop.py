"""等倍の切り出しに目盛りを付ける（座標を正確に読むため）。
使い方: python3 ruler_crop.py <画像> x0 y0 x1 y1 <出力>  ※幅は1240以下推奨"""
import sys
from PIL import Image, ImageDraw, ImageFont
f, x0, y0, x1, y1, out = sys.argv[1], *map(int, sys.argv[2:6]), sys.argv[6]
F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 12)
im = Image.open(f).convert('RGB').crop((x0, y0, x1, y1)); d = ImageDraw.Draw(im)
for x in range((x0 // 20 + 1) * 20, x1, 20):
    X = x - x0; d.line([(X, 0), (X, im.height if x % 100 == 0 else 8)], fill=(0, 160, 255))
    if x % 100 == 0: d.text((X + 2, 10), str(x), font=F, fill=(255, 0, 0))
for y in range((y0 // 20 + 1) * 20, y1, 20):
    Y = y - y0; d.line([(0, Y), (6, Y)], fill=(255, 0, 0)); d.text((8, Y - 6), str(y), font=F, fill=(255, 0, 0))
im.save(out)
