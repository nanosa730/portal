#!/usr/bin/env python3
"""学校行事予定について（報告）のWord様式を、指定の年月に組み替える。

使い方:
  python build_report.py --input base.docx --output out.docx \
      --year 2026 --month 10 --events events.json \
      --doc-number 53 --issue-day 1 [--shade 3,4,10,11,...]

events.json は {"1": "始業式　防災訓練", "24": "中間テスト"} の形式（日→行事名）。
--shade を省略すると土日のみに網掛けする。祝日を含めたい場合は日を明示する。
"""
import argparse
import copy
import datetime
import json
import os
import re
import shutil
import subprocess
import tempfile
import zipfile

from lxml import etree

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
XML_SPACE = '{http://www.w3.org/XML/1998/namespace}space'
YOUBI = '月火水木金土日'
ZEN = str.maketrans('0123456789', '０１２３４５６７８９')
# 「７〇〇中第６１号」の〇〇中（学校の略称）を拾う
DOCNUM_RE = re.compile(r'^[0-9０-９]*\s*(.+?)第\s*[0-9０-９]*\s*号')


def to_zen(n):
    return str(n).translate(ZEN)


# ---------- 低レベルユーティリティ ----------

def para_text(p):
    return ''.join(t.text or '' for t in p.iter(W + 't'))


def set_para_text(p, text):
    """段落の文字列を丸ごと差し替える（最初のrunの書式を維持）。"""
    ts = list(p.iter(W + 't'))
    if not ts:
        return
    ts[0].text = text
    ts[0].set(XML_SPACE, 'preserve')
    for t in ts[1:]:
        t.text = ''


def first_rpr(el):
    r = el.find('.//' + W + 'r')
    if r is None:
        return None
    rpr = r.find(W + 'rPr')
    return copy.deepcopy(rpr) if rpr is not None else None


def set_cell(tc, text, fallback_rpr):
    ps = tc.findall(W + 'p')
    p = ps[0]
    for extra in ps[1:]:
        tc.remove(extra)
    rpr = first_rpr(tc)
    if rpr is None:
        rpr = copy.deepcopy(fallback_rpr) if fallback_rpr is not None else None
    for r in p.findall(W + 'r'):
        p.remove(r)
    if text:
        r = etree.SubElement(p, W + 'r')
        if rpr is not None:
            r.append(copy.deepcopy(rpr))
        t = etree.SubElement(r, W + 't')
        t.text = text
        t.set(XML_SPACE, 'preserve')


def set_shading(tr, shd_tmpl, on):
    for tc in tr.findall(W + 'tc'):
        tcPr = tc.find(W + 'tcPr')
        if tcPr is None:
            continue
        for s in tcPr.findall(W + 'shd'):
            tcPr.remove(s)
        if on and shd_tmpl is not None:
            new = copy.deepcopy(shd_tmpl)
            borders = tcPr.find(W + 'tcBorders')
            if borders is not None:
                borders.addnext(new)
            else:
                tcPr.append(new)


# ---------- 本体 ----------

def build(args):
    tmp = tempfile.mkdtemp()
    try:
        with zipfile.ZipFile(args.input) as z:
            z.extractall(tmp)
        # 外部ファイル由来のシンボリックリンクは除去
        for root, _, files in os.walk(tmp):
            for f in files:
                p = os.path.join(root, f)
                if os.path.islink(p):
                    os.unlink(p)

        docxml = os.path.join(tmp, 'word', 'document.xml')
        tree = etree.parse(docxml)
        tbl = tree.getroot()[0].findall(W + 'tbl')[0]
        trs = tbl.findall(W + 'tr')
        header_row, _label_row = trs[0], trs[1]
        day_rows = trs[2:]

        # --- 網掛けテンプレートと素の行テンプレートを確保 ---
        shd_tmpl = None
        for tr in day_rows:
            s = tr.find('.//' + W + 'shd')
            if s is not None:
                shd_tmpl = copy.deepcopy(s)
                break
        plain_tmpl = copy.deepcopy(day_rows[-2])
        set_shading(plain_tmpl, shd_tmpl, False)

        rpr1 = rpr2 = None
        for tr in day_rows:
            tcs = tr.findall(W + 'tc')
            if rpr1 is None and para_text(tcs[1].findall(W + 'p')[0]).strip():
                rpr1 = first_rpr(tcs[1])
            if rpr2 is None and para_text(tcs[2].findall(W + 'p')[0]).strip():
                rpr2 = first_rpr(tcs[2])

        # --- 行数を対象月の日数に合わせる（最終行の太線を保つため末尾の1つ前で増減） ---
        ndays = (datetime.date(args.year + (args.month == 12),
                               args.month % 12 + 1, 1)
                 - datetime.date(args.year, args.month, 1)).days
        while len(day_rows) < ndays:
            new = copy.deepcopy(plain_tmpl)
            day_rows[-1].addprevious(new)
            day_rows = tbl.findall(W + 'tr')[2:]
        while len(day_rows) > ndays:
            tbl.remove(day_rows[-2])
            day_rows = tbl.findall(W + 'tr')[2:]

        # --- 日・曜・行事名・網掛け ---
        events = {}
        if args.events:
            with open(args.events, encoding='utf-8') as f:
                events = {int(k): v for k, v in json.load(f).items()}
        shade_days = set()
        if args.shade:
            shade_days = {int(x) for x in args.shade.split(',') if x.strip()}
        else:
            for d in range(1, ndays + 1):
                if datetime.date(args.year, args.month, d).weekday() >= 5:
                    shade_days.add(d)

        for i, tr in enumerate(day_rows, start=1):
            tcs = tr.findall(W + 'tc')
            wd = YOUBI[datetime.date(args.year, args.month, i).weekday()]
            set_cell(tcs[0], str(i), rpr1)
            set_cell(tcs[1], wd, rpr1)
            set_cell(tcs[2], events.get(i, ''), rpr2)
            if len(tcs) > 3:
                set_cell(tcs[3], '', rpr2)
            set_shading(tr, shd_tmpl, i in shade_days)

        # --- ヘッダー（文書番号・発信日・「○月分行事」） ---
        reiwa = args.year - 2018
        for p in header_row.iter(W + 'p'):
            txt = para_text(p)
            m = DOCNUM_RE.match(txt.strip())
            if m:
                num = args.doc_number if args.doc_number else ''
                if num:
                    abbr = args.school_abbr or m.group(1)
                    set_para_text(
                        p, f'{to_zen(reiwa)}{abbr}第{to_zen(num)}号　')
            elif txt.startswith('令和') and '年' in txt and '日' in txt:
                set_para_text(
                    p,
                    f'令和{to_zen(reiwa)}年{to_zen(args.month)}月'
                    f'{to_zen(args.issue_day)}日　')
            elif '分行事下記のとおり' in txt:
                set_para_text(
                    p, f'　{to_zen(args.month)}月分行事下記のとおり報告いたします。')

        tree.write(docxml, xml_declaration=True, encoding='UTF-8',
                   standalone=True)

        out = os.path.abspath(args.output)
        if os.path.exists(out):
            os.remove(out)
        subprocess.run(['zip', '-Xqr', out, '.'], cwd=tmp, check=True)
        print(f'wrote {out}  ({ndays}日, 行事{len(events)}件, 網掛け{len(shade_days)}日)')
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--input', required=True, help='ベースにするdocx')
    ap.add_argument('--output', required=True)
    ap.add_argument('--year', type=int, required=True, help='西暦')
    ap.add_argument('--month', type=int, required=True)
    ap.add_argument('--events', help='日→行事名のJSON')
    ap.add_argument('--doc-number', help='「第○○号」の数字のみ')
    ap.add_argument('--issue-day', type=int, default=1, help='発信日の日')
    ap.add_argument('--shade', help='網掛けする日をカンマ区切りで（省略時は土日）')
    ap.add_argument('--school-abbr', help='文書番号の学校略称（例: 〇〇中）。省略時はベースの表記をそのまま使う')
    build(ap.parse_args())


if __name__ == '__main__':
    main()
