#!/bin/bash
# surge へ公開して、同時に AI Tool Studio（このポータル）へ登録する。
#
#   tools/publish.sh <HTMLファイル|フォルダ> [オプション]   公開して登録
#   tools/publish.sh --register <URL> [オプション]          公開済みURLを登録だけする
#   tools/publish.sh --import                               surge にあって未登録のものを一覧する
#
# オプション
#   --domain <名前.surge.sh>   公開先。省略時はファイル名から決める
#   --genre  <ジャンルid>      省略時は対話で聞く（既存項目なら引き継ぐ）
#   --type   app|diagram       省略時は app
#   --title  "表示名"          省略時は HTML の <title>
#   --summary "説明"           省略時は HTML の meta description
#   --tags   "タグ1,タグ2"
#   --no-thumb                 サムネイルを撮らない
#   --no-push                  commit まで。push はしない
#
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

c_g=$'\033[0;32m'; c_y=$'\033[1;33m'; c_r=$'\033[0;31m'; c_d=$'\033[0;90m'; c_0=$'\033[0m'
say()  { printf '%s\n' "$*"; }
info() { printf '%s%s%s\n' "$c_d" "$*" "$c_0"; }
warn() { printf '%s%s%s\n' "$c_y" "$*" "$c_0" >&2; }
err()  { printf '%s%s%s\n' "$c_r" "$*" "$c_0" >&2; exit 1; }

command -v node >/dev/null 2>&1 || err "Node.js が必要です。先にインストールしてください。"

SURGE=(npx --yes surge)
[ -n "${SURGE_TOKEN:-}" ] && SURGE_AUTH=(--token "$SURGE_TOKEN") || SURGE_AUTH=()

strip_ansi() { sed -E $'s/\033\\[[0-9;]*[a-zA-Z]//g'; }

# ---------- 引数 ----------
MODE=deploy
TARGET=""
DOMAIN=""; GENRE=""; TYPE=""; TITLE=""; SUMMARY=""; TAGS=""
WANT_THUMB=1; WANT_PUSH=1

while [ $# -gt 0 ]; do
  case "$1" in
    --import)   MODE=import; shift ;;
    --register) MODE=register; TARGET="${2:-}"; shift 2 ;;
    --domain)   DOMAIN="${2:-}"; shift 2 ;;
    --genre)    GENRE="${2:-}"; shift 2 ;;
    --type)     TYPE="${2:-}"; shift 2 ;;
    --title)    TITLE="${2:-}"; shift 2 ;;
    --summary)  SUMMARY="${2:-}"; shift 2 ;;
    --tags)     TAGS="${2:-}"; shift 2 ;;
    --no-thumb) WANT_THUMB=0; shift ;;
    --no-push)  WANT_PUSH=0; shift ;;
    -h|--help)  sed -n '2,22p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    -*)         err "知らないオプション: $1" ;;
    *)          TARGET="$1"; shift ;;
  esac
done

# ---------- --import ----------
if [ "$MODE" = import ]; then
  say "surge の公開一覧を取得しています..."
  listing="$("${SURGE[@]}" list "${SURGE_AUTH[@]}" 2>/dev/null | strip_ansi || true)"
  [ -n "$listing" ] || err "surge list を取得できませんでした。npx surge login を済ませているか確認してください。"

  missing=0
  while read -r d; do
    [ -n "$d" ] || continue
    if node tools/portal.mjs has --url "https://$d/"; then continue; fi
    title="$(curl -sS --max-time 20 "https://$d/" 2>/dev/null | tr '\n' ' ' \
      | sed -nE 's/.*<title[^>]*>([^<]*)<\/title>.*/\1/p' | head -1)"
    printf '%s%-42s%s %s\n' "$c_y" "$d" "$c_0" "${title:-(タイトル不明)}"
    missing=$((missing + 1))
  done < <(printf '%s\n' "$listing" | grep -oE '[a-z0-9][a-z0-9-]*\.surge\.sh' | sort -u)

  say ""
  if [ "$missing" -eq 0 ]; then
    say "${c_g}未登録のサイトはありません。${c_0}"
  else
    say "未登録 ${missing} 件。載せたいものだけ、こう登録します:"
    say "  ${c_d}tools/publish.sh --register https://<ドメイン>/ --genre <ジャンルid>${c_0}"
    say ""
    say "ジャンルid:"
    node tools/portal.mjs genres | awk -F'\t' '{printf "  %-10s %s\n", $1, $2}'
  fi
  exit 0
fi

# ---------- 公開 ----------
if [ "$MODE" = deploy ]; then
  [ -n "$TARGET" ] || err "公開するHTMLファイルかフォルダを指定してください。"
  [ -e "$TARGET" ] || err "$TARGET が見つかりません。"

  if [ -z "$DOMAIN" ]; then
    base="$(basename "$TARGET")"; base="${base%.html}"
    slug="$(printf '%s' "$base" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9-' '-' | sed -E 's/-+/-/g; s/^-|-$//g')"
    [ -n "$slug" ] || err "ドメイン名を決められませんでした。--domain で指定してください。"
    DOMAIN="${slug}.surge.sh"
  fi
  DOMAIN="${DOMAIN#https://}"; DOMAIN="${DOMAIN%/}"

  if [ -d "$TARGET" ]; then
    SRC="$TARGET"
  else
    SRC="$(mktemp -d)"
    trap 'rm -rf "$SRC"' EXIT
    cp "$TARGET" "$SRC/index.html"
  fi
  # 検索避け。ポータルからリンクするので、せめて検索には出さない
  [ -f "$SRC/robots.txt" ] || printf 'User-agent: *\nDisallow: /\n' > "$SRC/robots.txt"

  say "${c_y}surge に公開しています...${c_0} (${DOMAIN})"
  "${SURGE[@]}" "$SRC" --domain "$DOMAIN" "${SURGE_AUTH[@]}"
  URL="https://${DOMAIN}/"
else
  [ -n "$TARGET" ] || err "--register には URL が必要です。"
  URL="$TARGET"
  case "$URL" in https://*) ;; *) URL="https://$URL" ;; esac
  case "$URL" in */) ;; *) URL="$URL/" ;; esac
  DOMAIN="${URL#https://}"; DOMAIN="${DOMAIN%/}"
fi

ID="${DOMAIN%%.surge.sh}"
ID="${ID%%.*}"

# ---------- タイトルと説明を公開先から読む ----------
html="$(curl -sS --max-time 25 "$URL" 2>/dev/null | head -c 60000 | tr '\n' ' ' || true)"
[ -n "$html" ] || warn "公開先からHTMLを読めませんでした。タイトルと説明は手で指定してください。"

if [ -z "$TITLE" ]; then
  TITLE="$(printf '%s' "$html" | sed -nE 's/.*<title[^>]*>([^<]*)<\/title>.*/\1/p' | head -1)"
fi
if [ -z "$SUMMARY" ]; then
  SUMMARY="$(printf '%s' "$html" \
    | sed -nE 's/.*<meta[^>]+name="description"[^>]+content="([^"]*)".*/\1/p' | head -1)"
  [ -n "$SUMMARY" ] || SUMMARY="$(printf '%s' "$html" \
    | sed -nE 's/.*<meta[^>]+content="([^"]*)"[^>]+name="description".*/\1/p' | head -1)"
fi
[ -n "$TITLE" ] || TITLE="$ID"

# ---------- 種別とジャンル ----------
if [ -z "$TYPE" ]; then
  TYPE="$(node tools/portal.mjs get --id "$ID" --field type 2>/dev/null || true)"
  [ -n "$TYPE" ] || TYPE=app
fi

if [ -z "$GENRE" ]; then
  GENRE="$(node tools/portal.mjs get --id "$ID" --field genre 2>/dev/null || true)"
fi
if [ -z "$GENRE" ]; then
  if [ -t 0 ]; then
    say ""
    say "ジャンルを選んでください:"
    node tools/portal.mjs genres | awk -F'\t' '{printf "  %-10s %s\n", $1, $2}'
    printf 'ジャンルid> '
    read -r GENRE
  else
    err "--genre を指定してください（$(node tools/portal.mjs genres | cut -f1 | tr '\n' ' ')）"
  fi
fi

# ---------- サムネイル ----------
THUMB_ARGS=()
if [ "$WANT_THUMB" = 1 ]; then
  CHROME="${PORTAL_CHROME:-}"
  if [ -z "$CHROME" ]; then
    for c in \
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" \
      "/Applications/Chromium.app/Contents/MacOS/Chromium" \
      "$(command -v google-chrome || true)" \
      "$(command -v chromium || true)" \
      "$(command -v chromium-browser || true)"
    do
      [ -n "$c" ] && [ -x "$c" ] && CHROME="$c" && break
    done
  fi

  if [ -n "$CHROME" ]; then
    mkdir -p assets/thumbs
    shot="$ROOT/assets/thumbs/$ID.png"
    info "サムネイルを撮っています..."
    if "$CHROME" --headless=new --disable-gpu --hide-scrollbars \
         --window-size=1280,800 --virtual-time-budget=6000 \
         --screenshot="$shot" "$URL" >/dev/null 2>&1 && [ -s "$shot" ]; then
      if command -v sips >/dev/null 2>&1; then
        sips -s format jpeg -s formatOptions 82 "$shot" --out "$ROOT/assets/thumbs/$ID.jpg" >/dev/null 2>&1 \
          && rm -f "$shot" && THUMB_ARGS=(--thumb "assets/thumbs/$ID.jpg")
      fi
      [ ${#THUMB_ARGS[@]} -eq 0 ] && THUMB_ARGS=(--thumb "assets/thumbs/$ID.png")
    else
      warn "サムネイルを撮れませんでした。カードは記号表示になります。"
      rm -f "$shot"
    fi
  else
    info "Chrome が見つからないのでサムネイルは省略します（--no-thumb で黙らせられます）"
  fi
fi

# ---------- 登録 ----------
UPSERT=(node tools/portal.mjs upsert --id "$ID" --type "$TYPE" --url "$URL"
        --title "$TITLE" --genre "$GENRE")
[ -n "$SUMMARY" ] && UPSERT+=(--summary "$SUMMARY")
[ -n "$TAGS" ] && UPSERT+=(--tags "$TAGS")
[ ${#THUMB_ARGS[@]} -gt 0 ] && UPSERT+=("${THUMB_ARGS[@]}")

"${UPSERT[@]}"
node tools/portal.mjs validate

# ---------- commit & push ----------
if ! git diff --quiet || ! git diff --cached --quiet || [ -n "$(git status --porcelain)" ]; then
  git add items.json assets/thumbs 2>/dev/null || true
  if git diff --cached --quiet; then
    info "ポータル側に変更はありませんでした。"
  else
    git commit -q -m "ポータルに登録: ${TITLE}" -m "${URL}"
    say "${c_g}コミットしました${c_0}"
    if [ "$WANT_PUSH" = 1 ]; then
      branch="$(git rev-parse --abbrev-ref HEAD)"
      delay=2
      for attempt in 1 2 3 4 5; do
        if git push -u origin "$branch"; then break; fi
        [ "$attempt" = 5 ] && err "push に失敗しました。あとで git push してください。"
        warn "push に失敗。${delay}秒待って再試行します..."
        sleep "$delay"; delay=$((delay * 2))
      done
      say "${c_g}push しました${c_0}"
    else
      info "--no-push なので push はしていません。"
    fi
  fi
fi

say ""
say "${c_g}完了${c_0}"
say "  公開:   $URL"
say "  ポータル: item.html?id=$ID"
