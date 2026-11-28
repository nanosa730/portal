#!/usr/bin/env python3
"""ベースdocxの表から「日・曜・行事名」を読み出し、ヘッダーの文書番号等も表示する。

  python read_base.py base.docx
"""
import sys
import zipfile

from lxml import etree

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'


def main(path):
    with zipfile.ZipFile(path) as z:
        tree = etree.fromstring(z.read('word/document.xml'))
    tbl = tree[0].findall(W + 'tbl')[0]
    trs = tbl.findall(W + 'tr')

    print('--- ヘッダー ---')
    for p in trs[0].iter(W + 'p'):
        txt = ''.join(t.text or '' for t in p.iter(W + 't')).strip()
        if txt:
            print(txt)

    print('--- 表 ---')
    for tr in trs[1:]:
        cells = [''.join(tc.itertext()).strip() for tc in tr.findall(W + 'tc')]
        print(' | '.join(cells))


if __name__ == '__main__':
    main(sys.argv[1])
