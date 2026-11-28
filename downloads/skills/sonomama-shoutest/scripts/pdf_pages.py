#!/usr/bin/env python3
"""問題集のPDFを読むための下ごしらえ。

  python3 scripts/pdf_pages.py 問題集.pdf --out /tmp/pages

各ページを PNG にして保存し、テキスト層があれば .txt も書き出す。
スキャンPDFは Read ツールで直接開けないことがあるので、先にこれで画像にしてから見る。
テキスト層があるPDFなら .txt を読むほうが速く、誤読も減る。
"""
import argparse
import os

import pymupdf


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf")
    parser.add_argument("--out", default="/tmp/pages")
    parser.add_argument("--dpi", type=int, default=160)
    parser.add_argument("--pages", help="1-3 のような範囲。省略すると全ページ")
    args = parser.parse_args()

    os.makedirs(args.out, exist_ok=True)
    document = pymupdf.open(args.pdf)

    if args.pages:
        first, _, last = args.pages.partition("-")
        targets = range(int(first) - 1, int(last or first))
    else:
        targets = range(document.page_count)

    for i in targets:
        page = document[i]
        png = os.path.join(args.out, f"p{i + 1:02d}.png")
        page.get_pixmap(dpi=args.dpi).save(png)

        text = page.get_text().strip()
        note = "テキスト層なし（画像を見て読み取る）"
        if text:
            txt = os.path.join(args.out, f"p{i + 1:02d}.txt")
            with open(txt, "w", encoding="utf-8") as f:
                f.write(text)
            note = f"{txt}（{len(text)}文字）"
        print(f"p{i + 1}: {png} / {note}")


if __name__ == "__main__":
    main()
