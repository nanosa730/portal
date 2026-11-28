"""注記画像＋修正一覧表を1つのPDFにする。
使い方: python3 make_report.py items.json <作業dir> <出力PDF> <タイトル>"""
import sys, json, os
from PIL import Image as PI
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Image, PageBreak, Spacer
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors
from reportlab.lib.units import mm
from xml.sax.saxutils import escape
spec = json.load(open(sys.argv[1], encoding='utf-8')); wd, out, title = sys.argv[2:5]
pdfmetrics.registerFont(TTFont('IPAG', '/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf'))
s = ParagraphStyle('s', fontName='IPAG', fontSize=8.6, leading=12.2)
h = ParagraphStyle('h', fontName='IPAG', fontSize=13, leading=18)
n = ParagraphStyle('n', fontName='IPAG', fontSize=9, leading=13)
LV = {'red': '<font color="#DC0000">要修正</font>', 'blue': '<font color="#005ADC">推奨</font>'}
names = spec.get('side_names', {})
data = [[Paragraph(x, s) for x in ['No', '区分', '場所', '現在', '修正案', '理由・備考']]]
for it in sorted(spec['items'], key=lambda i: i['no']):
    pl = it.get('place', ''); pn = names.get(str(it['page']))
    if pn: pl = f'{pn}・{pl}'
    data.append([Paragraph(str(it['no']), s), Paragraph(LV[it['level']], s)] +
                [Paragraph(escape(x), s) for x in (pl, it.get('current', ''), it.get('fix', ''), it.get('reason', ''))])
t = Table(data, colWidths=[8*mm, 14*mm, 27*mm, 42*mm, 46*mm, 51*mm], repeatRows=1)
t.setStyle(TableStyle([('GRID', (0, 0), (-1, -1), 0.5, colors.black), ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                       ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#FFF2CC'))]))
doc = SimpleDocTemplate(out, pagesize=A4, leftMargin=10*mm, rightMargin=10*mm, topMargin=10*mm, bottomMargin=10*mm)
st = []
for p in sorted(spec['pages'], key=int):
    f = os.path.join(wd, f'a-{p}.png'); w, hh = PI.open(f).size
    W = 190*mm; H = W * hh / w
    if H > 277*mm: H = 277*mm; W = H * w / hh
    st += [Image(f, W, H), PageBreak()]
red = sum(1 for i in spec['items'] if i['level'] == 'red'); blue = len(spec['items']) - red
st += [Paragraph(escape(title), h),
       Paragraph(f'赤＝要修正（{red}件：誤り・誤解のおそれ・敬語・安全面）　青＝推奨（{blue}件：表記揺れ・より良い表現）。番号は前のページの枠番号に対応。', n),
       Spacer(1, 4), t]
if spec.get('notes'): st += [Spacer(1, 6), Paragraph(escape(spec['notes']), n)]
doc.build(st); print('saved', out)
