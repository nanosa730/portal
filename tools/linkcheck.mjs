#!/usr/bin/env node
// items.json に登録された URL が生きているか確かめる。
// 落ちているものがあれば一覧を出して exit 1。
//
//   node tools/linkcheck.mjs [--json]

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const items = JSON.parse(readFileSync(join(ROOT, 'items.json'), 'utf8')).items;
const asJson = process.argv.includes('--json');

const TIMEOUT = 20000;
const RETRIES = 2; // 一時的な障害で騒がないよう、2回までやり直す

async function probe(url) {
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    const stop = AbortSignal.timeout(TIMEOUT);
    try {
      let res = await fetch(url, { redirect: 'follow', signal: stop, method: 'HEAD' });
      // HEAD を受け付けないサーバーがあるので、その場合は GET で確かめ直す
      if (res.status === 405 || res.status === 501) {
        res = await fetch(url, { redirect: 'follow', signal: stop });
      }
      if (res.ok) return { ok: true, status: res.status };
      if (attempt === RETRIES) return { ok: false, status: res.status, reason: `HTTP ${res.status}` };
    } catch (e) {
      if (attempt === RETRIES) return { ok: false, reason: e.name === 'TimeoutError' ? '応答なし（タイムアウト）' : e.message };
    }
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
}

const targets = items.filter((i) => i.url);
const results = [];

for (const item of targets) {
  const r = await probe(item.url);
  results.push({ id: item.id, title: item.title, url: item.url, ...r });
  if (!asJson) {
    console.log(`${r.ok ? '  OK  ' : '  NG  '} ${item.url}  ${r.ok ? '' : '← ' + r.reason}`);
  }
}

const dead = results.filter((r) => !r.ok);

if (asJson) {
  console.log(JSON.stringify({ checked: results.length, dead }, null, 2));
} else {
  console.log('');
  console.log(`${results.length} 件を確認。落ちているもの: ${dead.length} 件`);
}

process.exit(dead.length ? 1 : 0);
