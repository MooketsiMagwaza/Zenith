import * as A from '@automerge/automerge';
import * as Y from 'yjs';

export const automerge = {
  create(records) {
    return A.change(A.init(), d => {
      d.schema = 1; d.records = {};
      for (const [id, r] of Object.entries(records)) {
        d.records[id] = {};
        for (const [k, v] of Object.entries(r))
          d.records[id][k] = typeof v === 'string' && k !== 'content' ? new A.ImmutableString(v) : v;
      }
    });
  },
  edit(doc, edits) { return A.change(doc, d => {
    for (const e of edits) {
      if ('text' in e) A.splice(d, ['records', e.id, 'content'], e.at ?? d.records[e.id].content.length, e.delete ?? 0, e.text);
      else d.records[e.id][e.field] = typeof e.value === 'string' ? new A.ImmutableString(e.value) : e.value;
    }
  }); },
  fork: A.clone, save: A.save, load: A.load, merge: A.merge,
  json: d => JSON.parse(JSON.stringify(d.records)),
  dispose: A.free,
};

export const yjs = {
  create(records) {
    const d = new Y.Doc();
    d.transact(() => {
      d.getMap('root').set('schema', 1);
      const rs = new Y.Map(); d.getMap('root').set('records', rs);
      for (const [id, r] of Object.entries(records)) {
        const m = new Y.Map(); rs.set(id, m);
        for (const [k, v] of Object.entries(r)) m.set(k, k === 'content' ? new Y.Text(v) : v);
      }
    });
    return d;
  },
  edit(d, edits) { d.transact(() => {
    for (const e of edits) {
      const r = d.getMap('root').get('records').get(e.id);
      if ('text' in e) { const t = r.get('content'); const at = e.at ?? t.length;
        if (e.delete) t.delete(at, e.delete); t.insert(at, e.text); }
      else r.set(e.field, e.value);
    }
  }); return d; },
  fork(d) { return this.load(this.save(d)); },
  save: Y.encodeStateAsUpdate,
  load(bytes) { const d = new Y.Doc(); Y.applyUpdate(d, bytes); return d; },
  merge(a, b) { Y.applyUpdate(a, Y.encodeStateAsUpdate(b)); return a; },
  json: d => d.getMap('root').get('records').toJSON(),
  dispose: d => d.destroy(),
};

// Tombstones are monotonic at the API boundary; no operation writes false after creation.
export function visible(records, id) {
  const r = records[id];
  if (!r || r.deleted) return false;
  if (r.kind === 'log') return true; // historical sessions survive deleting their task
  if (r.taskId && !visible(records, `task:${r.taskId}`)) return false;
  if (r.deckId && !visible(records, `deck:${r.deckId}`)) return false;
  if (r.kind === 'reminder' && !visible(records, `${r.targetType}:${r.targetId}`)) return false;
  return true;
}
