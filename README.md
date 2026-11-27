# AI Tool Studio

AIでつくった、学校の仕事に使える道具の置き場。surge に公開したサイトやアプリ、図解、Claude用スキル、シートを、ジャンル別に並べて共有する静的サイト。

- 公開URL: https://nanosa730.github.io/portal/
- ビルド不要（素のHTML/CSS/JS）。`git push` すればそのまま公開される。

## 方針

- 投稿するのは自分だけ。閲覧は誰でも。
- `robots.txt` で検索避けしている。ただし **URLを知っている人は誰でも開ける**。パスワードはかけていないので、見られて困るものは載せない。
- 配布物（スキル・シート）はこのリポジトリに実ファイルを置く。外部の共有リンクには頼らない。
- 配布物の中の学校名・個人名はプレースホルダーにして、使う人が自分で埋める。

## ファイル構成

```
index.html              一覧（ジャンル別のセクション＋種別タブ＋検索）
item.html               詳細（item.html?id=xxx の1枚で全件を描画）
items.json              作品データとジャンル定義。ここが唯一の情報源
assets/style.css        見た目
assets/app.js           一覧・詳細の描画
assets/thumbs/          カードのサムネイル（1280×800）
downloads/              配布する実ファイル
tools/publish.sh        surge へ公開＋ポータルへ登録＋push
tools/portal.mjs        items.json の読み書き
tools/linkcheck.mjs     登録URLの疎通確認
robots.txt              検索避け
```

## 種別とジャンル

**種別**（タブ）は4つ。

| 種別 | 中身 | 動線 |
|---|---|---|
| `app` | 開いてその場で使うツール | サイトを開く |
| `diagram` | 読んで理解する図解 | サイトを開く |
| `skill` | Claude用スキル | ダウンロードして導入 |
| `sheet` | スプレッドシート・CSV | ダウンロードして使う |

**ジャンル**（左の索引）は `items.json` の `genres` で定義。現在8種。

| id | 表示名 |
|---|---|
| `komu` | 校務 |
| `jugyo` | 授業づくり |
| `shido` | 生徒指導 |
| `gakkyu` | 学級活動 |
| `hoshin` | 学校方針・提案 |
| `kenshu` | 講演・研修 |
| `ai` | AI・ICT |
| `yomimono` | 読み物・教材 |

ジャンルを足すときは `genres` に1行足す。並び順がそのまま一覧の並び順になる。

## surge に公開したものを載せる

デプロイと登録を1コマンドにまとめてある。`deploy-diagram.sh` の代わりにこれを使う。

```bash
# 1枚HTMLでもフォルダでもよい
tools/publish.sh output/api-basics.html --genre ai

# ドメインを決めたいとき
tools/publish.sh ./my-app --domain my-app.surge.sh --genre komu --type app
```

やっていること:

1. surge に公開する（`robots.txt` が無ければ検索避けを同梱する）
2. 公開先のHTMLから `<title>` と `<meta name="description">` を読む
3. Chrome があればサムネイルを撮る（1280×800）
4. `items.json` に追記、または同じドメインの項目を上書き更新
5. JSONを検証してから commit & push

2回目以降の再デプロイは、同じドメイン＝同じ作品として上書きされる。種別とジャンルは引き継がれるので聞かれない。

### 公開済みのURLを登録だけする

```bash
tools/publish.sh --register https://example.surge.sh/ --genre kenshu
```

### 取りこぼしを探す

surge にあってポータルに載っていないものを一覧する。

```bash
tools/publish.sh --import
```

私用のサイトも混ざるので、自動では登録しない。載せたいものだけ `--register` で足す。

### オプション

| オプション | 既定 |
|---|---|
| `--domain <名前.surge.sh>` | ファイル名から決める |
| `--genre <id>` | 既存項目なら引き継ぐ。無ければ対話で聞く |
| `--type app\|diagram` | `app` |
| `--title "表示名"` | HTMLの `<title>` |
| `--summary "説明"` | HTMLの meta description |
| `--tags "タグ1,タグ2"` | なし |
| `--no-thumb` | サムネイルを撮る |
| `--no-push` | push する |

`SURGE_TOKEN` を環境変数に入れておくとログインを聞かれない。Chrome の場所を変えたいときは `PORTAL_CHROME` で指定する。

## スキル・シートを足す

実ファイルを `downloads/` に置いて、`items.json` に1ブロック足す。

```json
{
  "id": "half-width-id",
  "type": "skill",
  "title": "一覧に出す名前",
  "summary": "一覧カードに出る1〜2文の説明。",
  "genre": "komu",
  "tags": ["検索に引っかけたい言葉"],
  "benefits": ["これでできること・時短効果を1行ずつ"],
  "steps": [
    { "text": "手順の文。" },
    { "text": "コマンドを添える手順。", "code": "コピーボタンが付く" }
  ],
  "downloads": [{ "label": "ファイル名.zip", "path": "downloads/skills/ファイル名.zip" }],
  "updated": "2026-11-27"
}
```

### フィールド

| キー | 必須 | 内容 |
|---|---|---|
| `id` | ○ | URLに使う。半角英数とハイフン。重複させない |
| `type` | ○ | `app` / `diagram` / `skill` / `sheet` |
| `title` | ○ | 作品名 |
| `summary` | ○ | 一覧カードの説明 |
| `genre` | ○ | `genres` のどれかの `id` |
| `url` | app/diagramは必須 | 開く先 |
| `thumb` | | カード画像。`assets/thumbs/<id>.jpg` |
| `tags` | | 検索対象。分類には使わない |
| `benefits` | | 「これでできること」の箇条書き |
| `steps` | | 導入手順。`code` を付けるとコピーボタン付きの枠になる |
| `downloads` | | ダウンロードボタン |
| `updated` | | `YYYY-MM` か `YYYY-MM-DD`。一覧はこの降順 |

書いたら検証する。push前に必ず通すこと（GitHub Actions でも走る）。

```bash
node tools/portal.mjs validate
```

## ローカルで確認する

`items.json` を `fetch` で読むため、HTMLを直接開くと動かない。簡易サーバーを立てる。

```bash
python3 -m http.server 8000
# http://localhost:8000/
```

## 自動で走るもの

| いつ | 何を |
|---|---|
| push / PR のたび | `items.json` の検証（`.github/workflows/validate.yml`） |
| 毎週月曜 09:00 JST | 登録URLの疎通確認。落ちていたら Issue（`.github/workflows/linkcheck.yml`） |

疎通確認は2回やり直してから落ちたと判断する。自動では項目を消さないので、`surge teardown` したものは自分で `items.json` から消す。

手元でも走らせられる。

```bash
node tools/linkcheck.mjs
```

## GitHub Pages の有効化（初回1回だけ）

Settings → Pages → Build and deployment の Source を「Deploy from a branch」、Branch を `main` / `/ (root)` にして Save。
