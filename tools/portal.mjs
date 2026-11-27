#!/usr/bin/env node
// items.json の読み書き。publish.sh から呼ばれる。
//
//   node tools/portal.mjs upsert   --id <id> --type <type> --url <url> [...]
//   node tools/portal.mjs get      --id <id> [--field genre]
//   node tools/portal.mjs has      --url <url>          … 登録済みなら exit 0
//   node tools/portal.mjs genres
//   node tools/portal.mjs validate

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = join(ROOT, 'items.json');
const TYPES = ['app', 'diagram', 'skill', 'sheet'];

function read() {
  const data = JSON.parse(readFileSync(FILE, 'utf8'));
  if (!Array.isArray(data.items)) throw new Error('items.json に items 配列がありません');
  if (!Array.isArray(data.genres)) throw new Error('items.json に genres 配列がありません');
  return data;
}

function write(data) {
  writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n');
}

function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) out[a.slice(2)] = argv[i + 1]?.startsWith('--') ? true : argv[++i];
    else out._.push(a);
  }
  return out;
}

function normalizeUrl(url) {
  return String(url || '').replace(/\/+$/, '').toLowerCase();
}

function die(message) {
  console.error(message);
  process.exit(1);
}

const [cmd, ...rest] = process.argv.slice(2);
const o = args(rest);
const data = read();

switch (cmd) {
  case 'genres': {
    for (const g of data.genres) console.log(`${g.id}\t${g.label}\t${g.note || ''}`);
    break;
  }

  case 'get': {
    const item = data.items.find((i) => i.id === o.id);
    if (!item) process.exit(1);
    console.log(o.field ? (item[o.field] ?? '') : JSON.stringify(item, null, 2));
    break;
  }

  case 'has': {
    const want = normalizeUrl(o.url);
    process.exit(data.items.some((i) => normalizeUrl(i.url) === want) ? 0 : 1);
    break;
  }

  case 'upsert': {
    if (!o.id) die('--id が必要です');
    if (!TYPES.includes(o.type)) die(`--type は ${TYPES.join(' / ')} のどれかです`);

    const existing = data.items.find((i) => i.id === o.id);
    const genre = o.genre || existing?.genre;
    if (!genre) die('--genre が必要です');
    if (!data.genres.some((g) => g.id === genre)) {
      die(`ジャンル "${genre}" は未定義です。使えるのは: ${data.genres.map((g) => g.id).join(', ')}`);
    }

    const item = existing || { id: o.id };
    item.type = o.type;
    item.title = o.title || item.title || o.id;
    if (o.summary) item.summary = o.summary;
    else if (!item.summary) item.summary = '';
    item.genre = genre;
    if (o.url) item.url = o.url;
    if (o.tags) {
      item.tags = String(o.tags).split(',').map((t) => t.trim()).filter(Boolean);
    } else if (!item.tags) {
      item.tags = [];
    }
    if (o.thumb) {
      if (!existsSync(join(ROOT, o.thumb))) die(`サムネイルが見つかりません: ${o.thumb}`);
      item.thumb = o.thumb;
    }
    item.updated = o.updated || new Date().toISOString().slice(0, 10);

    if (!existing) data.items.push(item);

    const order = new Map(data.genres.map((g, n) => [g.id, n]));
    const key = (v) => (String(v || '').replace(/\D/g, '') + '00000000').slice(0, 8);
    data.items.sort((a, b) => (order.get(a.genre) - order.get(b.genre)) || key(b.updated).localeCompare(key(a.updated)));

    write(data);
    console.log(`${existing ? '更新' : '追加'}: ${item.title}  [${data.genres.find((g) => g.id === genre).label}]`);
    break;
  }

  case 'validate': {
    const problems = [];
    const seen = new Set();
    for (const i of data.items) {
      const where = i.id || '(idなし)';
      if (!i.id) problems.push('id のない項目があります');
      if (seen.has(i.id)) problems.push(`id が重複: ${i.id}`);
      seen.add(i.id);
      if (!TYPES.includes(i.type)) problems.push(`${where}: type が不正 (${i.type})`);
      if (!i.title) problems.push(`${where}: title がありません`);
      if (!data.genres.some((g) => g.id === i.genre)) problems.push(`${where}: genre が不正 (${i.genre})`);
      if ((i.type === 'app' || i.type === 'diagram') && !i.url) problems.push(`${where}: url がありません`);
      if (i.thumb && !existsSync(join(ROOT, i.thumb))) problems.push(`${where}: サムネイルが見つかりません (${i.thumb})`);
      for (const d of i.downloads || []) {
        if (!existsSync(join(ROOT, d.path))) problems.push(`${where}: 配布ファイルが見つかりません (${d.path})`);
      }
    }
    if (problems.length) {
      console.error('items.json に問題があります:');
      for (const p of problems) console.error('  - ' + p);
      process.exit(1);
    }
    console.log(`items.json OK（${data.items.length} 件 / ジャンル ${data.genres.length} 種）`);
    break;
  }

  default:
    die('使い方: node tools/portal.mjs <genres|get|has|upsert|validate> [...]');
}
