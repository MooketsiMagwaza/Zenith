import { readFileSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import assert from 'node:assert/strict';
import { automerge, yjs } from './models.mjs';
const name = process.argv[2]; const m = {automerge,yjs}[name];
if (!m) throw new Error('usage: node --expose-gc tools/sync-bench/sharded.mjs automerge|yjs');
const data = JSON.parse(readFileSync(new URL('./generated/year.json', import.meta.url)));
global.gc(); const baseline = process.memoryUsage(); const t = performance.now();
const docs = {}, byRecord = {};
for (const [id, ids] of Object.entries(data.documents)) {
  docs[id] = m.create(Object.fromEntries(ids.map(r => [r, data.records[r]])));
  for (const r of ids) byRecord[r] = id;
}
for (const batch of data.edits) {
  const grouped = {};
  for (const e of batch) (grouped[byRecord[e.id]] ??= []).push(e);
  for (const [id, edits] of Object.entries(grouped)) docs[id] = m.edit(docs[id], edits);
}
const build_ms = performance.now() - t;
const snapshots = Object.entries(docs).map(([id,d]) => [id,m.save(d)]);
global.gc(); const after = process.memoryUsage();
const load_ms = [];
for (let n = 0; n < 7; n++) {
  const t = performance.now(); const loaded = snapshots.map(([id,bytes]) => [id,m.load(bytes)]);
  load_ms.push(performance.now() - t);
  for (const [id,d] of loaded) { assert.deepEqual(m.json(d),m.json(docs[id])); m.dispose(d); }
}
// A single journal edit merge, loaded independently of the log/catalog shards.
const merge_ms = [];
for (let n = 0; n < 7; n++) {
  const a = m.edit(m.fork(docs['journal:j0']),[{id:'journal:j0',text:' ALPHA'}]);
  const b = m.edit(m.fork(docs['journal:j0']),[{id:'journal:j0',text:' BETA'}]);
  const t = performance.now(); const merged = m.merge(a,b); merge_ms.push(performance.now()-t);
  assert.ok(m.json(merged)['journal:j0'].content.includes('BETA'));
  m.dispose(merged); m.dispose(b);
}
const median = xs => xs.toSorted((a,b)=>a-b)[3];
const result = { library:name, documents:snapshots.length, saved_bytes:snapshots.reduce((n,[,b])=>n+b.length,0),
  build_ms, load_all_ms: {median:median(load_ms),samples:load_ms}, single_journal_merge_ms:{median:median(merge_ms),samples:merge_ms},
  rss_delta_bytes:after.rss-baseline.rss, heap_delta_bytes:after.heapUsed-baseline.heapUsed };
writeFileSync(new URL(`./results-sharded-${name}.json`,import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
