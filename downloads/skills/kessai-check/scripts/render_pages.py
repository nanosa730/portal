"""原稿（PDF/画像）を150dpiのPNGにし、座標グリッド付き画像も作る。
使い方: python3 render_pages.py <入力> <作業dir>"""
import sys, os, subprocess, glob, shutil
from PIL import Image, ImageDraw, ImageFont
src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
if src.lower().endswith('.pdf'):
    subprocess.run(['pdftoppm', '-png', '-r', '150', src, os.path.join(out, 'p')], check=True)
    # pdftoppm はページ数で桁埋めするので p-1.png 形式に揃える
    for f in glob.glob(os.path.join(out, 'p-*.png')):
        n = int(os.path.basename(f)[2:-4]); os.rename(f, os.path.join(out, f'p-{n}.png'))
else:
    im = Image.open(src).convert('RGB')
    if im.width > 1600:
        im = im.resize((1240, round(im.height * 1240 / im.width)))
    im.save(os.path.join(out, 'p-1.png'))
F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 14)
for f in sorted(glob.glob(os.path.join(out, 'p-*.png'))):
    im = Image.open(f).convert('RGB'); d = ImageDraw.Draw(im)
    for x in range(0, im.width, 50):
        d.line([(x, 0), (x, im.height)], fill=(0, 160, 255) if x % 100 == 0 else (190, 225, 255))
    for y in range(0, im.height, 50):
        d.line([(0, y), (im.width, y)], fill=(0, 160, 255) if y % 100 == 0 else (190, 225, 255))
    for x in range(0, im.width, 100):
        for y in range(0, im.height, 100):
            d.text((x + 2, y + 2), f'{x},{y}', font=F, fill=(255, 0, 0))
    im.save(f.replace('p-', 'g-'))
    print(f, im.size)
