"""items.json に従い、原稿画像に番号付き枠を描く。
使い方: python3 annotate.py items.json <作業dir>  → <作業dir>/a-<page>.png"""
import sys, json, os
from PIL import Image, ImageDraw, ImageFont
spec = json.load(open(sys.argv[1], encoding='utf-8')); wd = sys.argv[2]
COL = {'red': (220, 0, 0), 'blue': (0, 90, 220)}
F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 20)
for p, fn in spec['pages'].items():
    im = Image.open(os.path.join(wd, fn)).convert('RGB'); d = ImageDraw.Draw(im)
    LM, RM = 24, im.width - 24
    for it in [i for i in spec['items'] if str(i['page']) == str(p)]:
        c = COL[it['level']]
        for r in it['rects']: d.rectangle(r, outline=c, width=4)
        labels = it.get('labels') or [{}]
        for lb in labels:
            r = it['rects'][lb.get('rect', 0)]
            if 'at' in lb:
                cx, cy = lb['at']; path = None
            else:
                side = lb.get('side') or ('L' if (r[0] + r[2]) / 2 < im.width / 2 else 'R')
                cy = lb.get('y', (r[1] + r[3]) // 2)
                cx = LM if side == 'L' else RM
                bx = r[0] if side == 'L' else r[2]
                path = [(cx + (15 if side == 'L' else -15), cy), (bx, cy)]
                if not (r[1] <= cy <= r[3]):
                    path.append((bx, r[1] if cy < r[1] else r[3]))
            if path: d.line(path, fill=c, width=2)
            d.ellipse((cx - 15, cy - 15, cx + 15, cy + 15), fill=c)
            t = str(it['no']); w = d.textlength(t, font=F)
            d.text((cx - w / 2, cy - 12), t, font=F, fill='white')
    im.save(os.path.join(wd, f'a-{p}.png')); print('saved', f'a-{p}.png')
