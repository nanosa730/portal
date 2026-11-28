#!/usr/bin/env python3
"""表彰記録を入力用シート(A〜H列)の末尾に追記する。

使い方:
  python3 append_records.py 入力.xlsx records.json 出力.xlsx [--dry-run] [--sheet シート名]

--sheet を省略すると「表彰入力」シートに書く。

records.json の形式（リスト）:
  [{"year":2026,"month":11,"day":3,"name":"山田 花子","record":"大会名　種目　第１位",
    "grade":1,"class":"A"}]   # grade/class は省略可（生徒名簿から補完）

生徒名簿シート(A:学年 B:組 C:番号 D:氏名 E:かな)から 学年・組・かな を補完する。
"""
import json, sys, unicodedata, copy
import openpyxl

SHEET = "表彰入力"  # 既定の書き込み先。--sheet で変えられる
ROSTER = "生徒名簿"
VARIANTS = str.maketrans({"髙": "高", "﨑": "崎", "邉": "辺", "邊": "辺", "濵": "浜", "濱": "浜",
                          "櫻": "桜", "齋": "斎", "齊": "斉", "德": "徳", "瀨": "瀬", "柳": "柳"})

def norm(s):
    s = unicodedata.normalize("NFKC", str(s or ""))
    return "".join(s.split())

def loose(s):
    return norm(s).translate(VARIANTS)

def half(s):
    return unicodedata.normalize("NFKC", str(s)) if s is not None else None

def main():
    src, recs_path, dst = sys.argv[1:4]
    dry = "--dry-run" in sys.argv
    sheet = sys.argv[sys.argv.index("--sheet") + 1] if "--sheet" in sys.argv else SHEET
    wb = openpyxl.load_workbook(src)
    ws, rs = wb[sheet], wb[ROSTER]
    roster = [r for r in rs.iter_rows(min_row=1, values_only=True) if r and r[3]]
    recs = json.load(open(recs_path, encoding="utf-8"))

    # 末尾判定は 氏名(F)・記録(H) のみで行う（D列の遠い行に迷い込んだ値があるため）
    last = max([r for r, v in enumerate(ws.iter_rows(min_col=6, max_col=8, values_only=True), 1)
                if (v[0] not in (None, "") or v[2] not in (None, ""))] or [1])
    row = last + 1
    existing = {(norm(f), norm(h)) for f, _, h in ws.iter_rows(min_row=2, max_row=last, min_col=6, max_col=8, values_only=True)}
    report = []
    for rec in recs:
        name = rec["name"]
        hits = [r for r in roster if norm(r[3]) == norm(name)] or \
               [r for r in roster if loose(r[3]) == loose(name)]
        if rec.get("grade") is not None:
            hits = [r for r in hits if half(r[0]) == half(rec["grade"])] or hits
        if rec.get("class"):
            hits = [r for r in hits if half(r[1]) == half(rec["class"])] or hits
        status = "OK" if len(hits) == 1 else ("名簿になし" if not hits else "同姓同名あり")
        h = hits[0] if len(hits) == 1 else None
        grade = h[0] if h else rec.get("grade")
        cls = half(h[1]) if h else half(rec.get("class"))
        disp = h[3] if h else name
        kana = h[4] if h else rec.get("kana")
        if (norm(disp), norm(rec["record"])) in existing:
            report.append({"row": None, "status": "重複のためスキップ", "values": [disp, rec["record"]]})
            continue
        vals = [rec.get("year"), rec.get("month"), rec.get("day"), grade, cls, disp, kana, rec["record"]]
        report.append({"row": row, "status": status, "values": vals})
        if not dry:
            for c, v in enumerate(vals, 1):
                cell = ws.cell(row, c, v)
                ref = ws.cell(last, c)
                if ref.has_style:
                    cell._style = copy.copy(ref._style)
        row += 1
    if not dry:
        wb.save(dst)
    print(json.dumps(report, ensure_ascii=False, indent=1))

if __name__ == "__main__":
    main()
