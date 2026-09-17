# AI Tool Studio

AIでつくった、学校の仕事に使える道具の置き場。スキル・シート・リンクを並べて共有する静的サイト。

- 公開URL: https://nanosa730.github.io/portal/
- ビルド不要（素のHTML/CSS/JS）。`git push` すればそのまま公開される。

## 方針

- 投稿するのは自分だけ。閲覧は誰でも。
- 配布物はこのリポジトリに実ファイルを置く（外部の共有リンクに頼らない）。
- **実名は載せない。** 学校名・個人名は `〇〇市立〇〇中学校` `〇　〇　〇　〇` のようなプレースホルダーにして、使う人が自分で埋める。

## ファイル構成

```
index.html            一覧（種別タブ＋キーワード検索）
item.html             詳細（item.html?id=xxx の1枚で全作品を描画）
items.json            作品データ。ここに追記するだけで一覧・詳細が増える
assets/style.css      見た目
assets/app.js         一覧・詳細の描画
downloads/            配布する実ファイル
```

## 作品を追加する

1. 配布するファイルを `downloads/` の下に置く（スキルは `downloads/skills/<名前>/` に展開したものと、同じ内容の `.zip` の両方）。
2. `items.json` の `items` 配列にブロックを1つ足す。
3. コミットして push する。

```json
{
  "id": "half-width-alphanumeric-id",
  "type": "skill",
  "title": "一覧に出す名前",
  "summary": "一覧カードに出る1〜2文の説明。",
  "tags": ["検索に引っかけたい言葉"],
  "benefits": [
    "これでできること・時短効果を具体的な数字で1行ずつ"
  ],
  "steps": [
    { "text": "手順の文。" },
    { "text": "コマンドを添える手順。", "code": "コピーボタンが付く" }
  ],
  "downloads": [
    { "label": "ファイル名.zip", "path": "downloads/skills/ファイル名.zip" }
  ],
  "updated": "2026-09-17"
}
```

### フィールド

| キー | 必須 | 内容 |
|---|---|---|
| `id` | ○ | URLに使う。半角英数とハイフン。既存と重複させない |
| `type` | ○ | `skill` / `sheet` / `link` のどれか。一覧のタブに対応 |
| `title` | ○ | 作品名 |
| `summary` | ○ | 一覧カードの説明 |
| `tags` | | 検索対象。分類には使わない |
| `benefits` | | 「これでできること」の箇条書き |
| `steps` | | 導入手順。`code` を付けるとコピーボタン付きの枠で表示される |
| `downloads` | | ダウンロードボタン。`path` はリポジトリ内の相対パス |
| `url` | | `type: "link"` のとき、開く先の外部URL |
| `updated` | | `YYYY-MM-DD`。一覧はこの降順で並ぶ |

`items.json` はJSONなので、末尾のカンマや全角の記号が混じると**一覧が全件表示されなくなる**。push前に確認する。

```bash
python3 -c "import json; json.load(open('items.json')); print('OK')"
```

## ローカルで確認する

`items.json` を `fetch` で読むため、HTMLファイルを直接開くと動かない。簡易サーバーを立てて開く。

```bash
python3 -m http.server 8000
# http://localhost:8000/ を開く
```

## GitHub Pages の有効化（初回1回だけ）

リポジトリの Settings → Pages → Build and deployment の Source を「Deploy from a branch」、Branch を `main` / `/ (root)` にして Save。数分で公開される。
