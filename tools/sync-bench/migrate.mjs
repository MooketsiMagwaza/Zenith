// Read-only migration candidate builder. Host installation/atomic switch is future app work.
import { createHash } from 'node:crypto';
const digest = s => createHash('sha256').update(s).digest('hex');
const fullKeys = { decks: 'toggl_zen_decks', logs: 'toggl_zen_logs', journals: 'toggl_zen_journals',
  reminders: 'toggl_zen_reminders', active: 'toggl_zen_active' };

export function migrate(raw, format) {
  if (!['popup-browser', 'popup-file', 'full-localStorage'].includes(format)) throw new Error('unknown source format');
  const original = JSON.parse(raw);
  let state;
  if (format === 'full-localStorage') {
    state = {};
    for (const [field, key] of Object.entries(fullKeys)) {
      if (key in original) state[field] = typeof original[key] === 'string' ? JSON.parse(original[key]) : original[key];
    }
    for (const [field,key] of Object.entries({zenPack:'zenith.zen.pack',zenInterval:'zenith.zen.intervalSec'})) {
      if (key in original) state[field] = field === 'zenInterval' ? Number(original[key]) : original[key];
    }
    if ('zenith.tutorial.seen' in original) state.tutorialSeen = original['zenith.tutorial.seen'] === '1';
    // Preserve ordered custom settings as exact JSON strings in scalar registers.
    for (const [field,key] of Object.entries({customQuotesJson:'zenith.zen.customQuotes',customWallsJson:'zenith.zen.customWalls'})) {
      if (key in original) {
        const value = typeof original[key] === 'string' ? JSON.parse(original[key]) : original[key];
        if (!Array.isArray(value) || value.some(v => typeof v !== 'string')) throw new Error(`invalid ${key}`);
        state[field] = JSON.stringify(value);
      }
    }
  } else state = format === 'popup-file' ? original.state : original;
  if (!state || typeof state !== 'object' || Array.isArray(state)) throw new Error('invalid source state');
  const records = {}, unmapped = [];
  function add(kind, record, extra = {}) {
    if (!record || typeof record.id !== 'string' || !record.id || record.id.length > 256) throw new Error(`invalid ${kind} ID`);
    const id = `${kind}:${record.id}`;
    if (id in records) throw new Error(`duplicate ${id}; retain source and resolve explicitly`);
    if ('kind' in record || 'deleted' in record) throw new Error('reserved migration fields');
    const r = { kind, deleted: false, ...extra };
    for (const [k, v] of Object.entries(record)) {
      if (['tasks', 'checklist', 'body'].includes(k)) continue;
      if (v === null || ['string', 'number', 'boolean'].includes(typeof v)) r[k] = v;
      else unmapped.push({ id, field: k });
    }
    if (kind === 'journal') {
      r.content = record.content ?? record.body;
      if (typeof r.content !== 'string') throw new Error(`missing journal text ${id}`);
    }
    records[id] = r;
    return r;
  }
  const list = (name) => {
    if (!(name in state)) return [];
    if (!Array.isArray(state[name])) throw new Error(`invalid ${name} collection`);
    return state[name];
  };
  const tasks = [...list('tasks')];
  for (const d of list('decks')) {
    add('deck', d);
    if (d.tasks !== undefined && !Array.isArray(d.tasks)) throw new Error('invalid nested tasks');
    for (const t of d.tasks ?? []) {
      if (t.deckId && t.deckId !== d.id) throw new Error('task/deck mismatch');
      tasks.push({ ...t, deckId: d.id });
    }
  }
  for (const t of tasks) {
    add('task', t);
    if (t.checklist !== undefined && !Array.isArray(t.checklist)) throw new Error('invalid checklist');
    for (const [order, c] of (t.checklist ?? []).entries()) add('checklist', c, { taskId: t.id, order });
  }
  for (const [collection, kind] of [['logs','log'], ['journals','journal'], ['reminders','reminder']])
    for (const r of list(collection)) add(kind, r);
  // Preserve the old reported total exactly; count future/remote session IDs once.
  // Signed offsets intentionally retain existing discrepancies rather than rewriting history.
  for (const t of tasks) {
    if (!Number.isSafeInteger(t.totalSeconds) || t.totalSeconds < 0) throw new Error('invalid task total');
    const imported = list('logs').filter(l => l.taskId === t.id).reduce((n,l) => {
      if (!Number.isSafeInteger(l.duration) || l.duration < 0) throw new Error('invalid log duration');
      return n + l.duration;
    },0);
    const offset = t.totalSeconds - imported;
    if (!Number.isSafeInteger(offset)) throw new Error('task total overflow');
    records[`task:${t.id}`].legacySecondsOffset = offset;
  }
  const prefs = { id: 'shared' };
  for (const k of ['tutorialSeen','zenPack','zenInterval','zenWallpaper','customQuotesJson','customWallsJson']) if (k in state) prefs[k] = state[k];
  if ('zenInterval' in prefs && (!Number.isSafeInteger(prefs.zenInterval) || prefs.zenInterval < 0)) throw new Error('invalid interval');
  add('preferences', prefs);
  // Original bytes retain active timer, unknown preferences, orphan journals, order and metadata.
  // The archive is local/private; never advertise it or commit real source data.
  return { schema: 1, records, sourceHash: digest(`${format}\0${raw}`),
    archive: { format, raw, sha256: digest(raw) }, deviceLocal: { active: state.active ?? null,
      wallIndex: original['zenith.zen.wallIdx'] ?? null }, unmapped };
}
