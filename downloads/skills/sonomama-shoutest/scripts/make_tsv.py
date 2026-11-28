#!/usr/bin/env python3
"""確定した問題からTSVを書き出す。

  python3 scripts/make_tsv.py 問題.json -o data/2026-09-15_理科_p50-51.tsv

問題銀行シートの列順・区切り文字・画像の埋め込みをここで一手に引き受ける。
毎回手で組み立てると列ズレや正解の入れ忘れが起きるので、必ずこれを通す。

入力JSONの形:
{
  "round_id": "2026-09-15-理科1年",
  "subject": "理科",
  "range": "p.50-51",
  "questions": [
    {"number": "1", "type": "記述", "text": "…", "answer": "物体", "accepted": ["ぶったい"]},
    {"number": "4", "type": "記述", "text": "…", "answer": "空気調節ねじ",
     "accepted": ["…"], "image": "/path/to/fig.png"},
    {"number": "候補A", "type": "記述", "text": "…", "answer": "無機物", "enabled": false},
    {"number": "候補E", "type": "選択", "text": "…",
     "choices": ["展性", "延性", "光沢", "磁性"], "answer": "展性", "enabled": false}
  ]
}

points は省略すると1点。enabled を false にすると差し替え候補として残る。
"""
import argparse
import base64
import io
import json
import sys

HEADERS = ["回ID", "教科", "範囲", "番号", "形式", "問題文", "選択肢", "正解",
           "許容解", "配点", "画像ID", "出題", "フォームURL"]
VALID_TYPES = ["記述", "選択", "複数選択"]
CELL_LIMIT = 45000  # スプレッドシートのセル上限（5万文字）に対する安全圏


def to_data_uri(path: str) -> str:
    """図をセルに埋め込める文字列にする。Driveに置かせないための工夫。"""
    from PIL import Image

    image = Image.open(path).convert("RGB")
    max_width, quality = 500, 82
    if image.width > max_width:
        image = image.resize((max_width, round(image.height * max_width / image.width)))

    while quality >= 40:
        buffer = io.BytesIO()
        image.save(buffer, format="JPEG", quality=quality, optimize=True)
        uri = "data:image/jpeg;base64," + base64.b64encode(buffer.getvalue()).decode()
        if len(uri) <= CELL_LIMIT:
            return uri
        quality -= 10
    raise SystemExit(f"{path} はセルに収まりません。図を小さく切り出し直してください。")


def check(question: dict, position: int) -> list:
    """フォーム生成側と同じ条件で先に弾く。シートに貼ってから気づくのを避ける。"""
    problems = []
    where = f"{position}問目（番号 {question.get('number', '?')}）"
    if not question.get("text"):
        problems.append(f"{where}: 問題文がありません。")
    if question.get("type") not in VALID_TYPES:
        problems.append(f"{where}: 形式は {' / '.join(VALID_TYPES)} のいずれかにしてください。")
    if not question.get("answer"):
        problems.append(f"{where}: 正解がありません。")

    if question.get("type") in ("選択", "複数選択"):
        choices = question.get("choices") or []
        if len(choices) < 2:
            problems.append(f"{where}: 選択肢が2つ以上必要です。")
        for answer in str(question.get("answer", "")).split("|"):
            if answer and answer not in choices:
                problems.append(f"{where}: 正解「{answer}」が選択肢にありません。")
    return problems


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("spec")
    parser.add_argument("-o", "--output", required=True)
    args = parser.parse_args()

    with open(args.spec, encoding="utf-8") as f:
        spec = json.load(f)

    questions = spec["questions"]
    problems = [p for i, q in enumerate(questions, 1) for p in check(q, i)]
    if problems:
        print("\n".join(problems), file=sys.stderr)
        raise SystemExit("問題の書き方を直してから、もう一度実行してください。")

    rows = []
    for question in questions:
        image = question.get("image")
        rows.append([
            spec["round_id"],
            spec.get("subject", ""),
            spec.get("range", ""),
            str(question.get("number", "")),
            question["type"],
            question["text"],
            "|".join(question.get("choices") or []),
            question["answer"],
            "|".join(question.get("accepted") or []),
            str(question.get("points", 1)),
            to_data_uri(image) if image else "",
            "" if question.get("enabled", True) else "false",
            "",
        ])

    with open(args.output, "w", encoding="utf-8") as f:
        f.write("\t".join(HEADERS) + "\n")
        for row in rows:
            f.write("\t".join(cell.replace("\t", " ").replace("\n", " ") for cell in row) + "\n")

    asked = sum(1 for q in questions if q.get("enabled", True))
    points = sum(q.get("points", 1) for q in questions if q.get("enabled", True))
    figures = sum(1 for q in questions if q.get("image"))
    print(f"{args.output}: 出題 {asked}問 / {points}点満点 / 候補 {len(questions) - asked}問 / 図 {figures}枚")


if __name__ == "__main__":
    main()
