import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { year } from './generate.mjs';
import { automerge, yjs } from './models.mjs';
const path = name => new URL(`./generated/${name}`, import.meta.url);
mkdirSync(new URL('./generated/', import.meta.url), { recursive: true });
if (process.argv[2] === 'prepare') {
  const data = year(3);
  data.records['journal:j0'].content = 'Base 🧭 café\n';
  for (const [name,m] of Object.entries({automerge,yjs})) {
    let d = m.create(data.records);
    for (const edits of data.edits) d = m.edit(d,edits);
    writeFileSync(path(`interop-js-${name}.bin`),m.save(d));
    writeFileSync(path('interop-expected.json'),JSON.stringify(m.json(d))); m.dispose(d);
  }
  console.log('Prepared equivalent synthetic JS snapshots with Unicode journals.');
} else if (process.argv[2] === 'verify') {
  for (const [name,m] of Object.entries({automerge,yjs})) {
    const d = m.load(readFileSync(path(`interop-rust-${name}.bin`)));
    const r = m.json(d), expected = JSON.parse(readFileSync(path(`interop-rust-${name}.json`)));
    assert.deepEqual(r,expected);
    assert.equal(r['task:t0'].name,'Edited in Rust');
    assert.ok(r['journal:j0'].content.endsWith(' Rust 🧭 café'));
    m.dispose(d); console.log(`${name}: Rust snapshot decoded in JS, all fields and Unicode edits equal.`);
  }
} else throw new Error('usage: node tools/sync-bench/interop.mjs prepare|verify');
