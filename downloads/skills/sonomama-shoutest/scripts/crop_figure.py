#!/usr/bin/env python3
"""問題集のPDFから図を切り出す。

  python3 tools/crop_figure.py 入力.pdf 出力.png --page 1 --box 140,588,342,782

--box は PDF を --dpi で画像にしたときの座標 (left,top,right,bottom)。
まず --preview でページ全体を書き出し、座標を見当づけてから切り出すとよい。
"""
import argparse

import pymupdf
from PIL import Image


def render(pdf_path: str, page_no: int, dpi: int) -> Image.Image:
    with pymupdf.open(pdf_path) as doc:
        pixmap = doc[page_no - 1].get_pixmap(dpi=dpi)
    return Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf")
    parser.add_argument("output")
    parser.add_argument("--page", type=int, default=1)
    parser.add_argument("--dpi", type=int, default=160)
    parser.add_argument("--box", help="left,top,right,bottom")
    parser.add_argument("--scale", type=float, default=2.0, help="切り出した後の拡大率")
    parser.add_argument("--preview", action="store_true", help="ページ全体を書き出して座標を確かめる")
    args = parser.parse_args()

    image = render(args.pdf, args.page, args.dpi)
    if args.preview or not args.box:
        image.save(args.output)
        print(f"{args.output} ページ全体 {image.size}")
        return

    box = tuple(int(v) for v in args.box.split(","))
    cropped = image.crop(box)
    if args.scale != 1.0:
        cropped = cropped.resize((int(cropped.width * args.scale), int(cropped.height * args.scale)))
    cropped.save(args.output)
    print(f"{args.output} {cropped.size}")


if __name__ == "__main__":
    main()
