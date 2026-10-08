import { readFileSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import assert from 'node:assert/strict';
import { automerge, yjs } from './models.mjs';

const library = process.argv[2];
if (!library) {
  const results = ['automerge', 'yjs'].map(name => {
    return JSON.parse(readFileSync(new URL(`./generated/result-js-${name}.json`, import.meta.url)));
  });
  const report = { runtime: process.version, platform: `${process.platform}/${process.arch}`, samples: 7,
    note: 'fresh process per library; RSS and heap deltas include runtime/allocator retention, not exact document memory', results };
  writeFileSync(new URL('./results-js.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} else {
  const m = { automerge, yjs }[library];
  const data = JSON.parse(readFileSync(new URL('./generated/year.json', import.meta.url)));
  global.gc(); const before = process.memoryUsage(); const start = performance.now();
  let doc = m.create(data.records);
  for (const edits of data.edits) doc = m.edit(doc, edits);
  const build_ms = performance.now() - start;
  const saved = m.save(doc); global.gc(); const after = process.memoryUsage();
  writeFileSync(new URL(`./generated/js-${library}.bin`, import.meta.url), saved);
  const loads = [], merges = [];
  for (let i = 0; i < 7; i++) {
    let t = performance.now(); const loaded = m.load(saved); loads.push(performance.now() - t);
    assert.deepEqual(m.json(loaded), m.json(doc)); m.dispose(loaded);
    // Merge timing excludes load/fork; each side makes 100 fields + 100 text edits while apart.
    let a = m.fork(doc), b = m.fork(doc);
    for (let n = 0; n < 100; n++) {
      a = m.edit(a, [{ id: `task:t${n}`, field: 'name', value: `A${n}` }, { id: `journal:j${n}`, text: ' ALPHA' }]);
      b = m.edit(b, [{ id: `task:t${n}`, field: 'name', value: `B${n}` }, { id: `journal:j${n}`, text: ' BETA' }]);
    }
    t = performance.now(); a = m.merge(a, b); merges.push(performance.now() - t);
    b = m.merge(b, a); assert.deepEqual(m.json(a), m.json(b));
    const text = m.json(a)['journal:j0'].content;
    assert.ok(text.includes('ALPHA') && text.includes('BETA'));
    m.dispose(a); m.dispose(b);
  }
  const stats = xs => { const s = xs.toSorted((a,b) => a-b); return { median: s[3], min: s[0], max: s[6], samples: xs }; };
  const result = { library, records: Object.keys(data.records).length, saved_bytes: saved.length,
    build_ms, load_ms: stats(loads), merge_ms: stats(merges),
    rss_delta_bytes: after.rss - before.rss, heap_delta_bytes: after.heapUsed - before.heapUsed,
    journal_concurrent_insertions_retained: true };
  writeFileSync(new URL(`./generated/result-js-${library}.json`, import.meta.url), JSON.stringify(result));
  console.log(JSON.stringify(result));
}
