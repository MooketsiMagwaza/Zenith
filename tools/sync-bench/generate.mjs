// Synthetic workload only. Never reads app storage or user data.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function year(days = 365) {
  const start = Date.UTC(2025, 9, 8), day = 86400000;
  const records = {};
  const add = (kind, r) => { records[`${kind}:${r.id}`] = { kind, deleted: false, ...r }; };
  for (let d = 0; d < 12; d++) {
    add('deck', { id: `d${d}`, name: `Project ${d}`, color: '#3aa6a0', createdAt: start });
    for (let t = 0; t < 12; t++) {
      const id = `t${d * 12 + t}`;
      add('task', { id, deckId: `d${d}`, name: `Task ${t}`, tag: 'Study', totalSeconds: 0,
        createdAt: start, mode: t % 2 ? 'countdown' : 'stopwatch', targetSeconds: 1500 });
      for (let c = 0; c < 3; c++) add('checklist', { id: `${id}-c${c}`, taskId: id, text: `Step ${c}`, done: false, order: c });
    }
  }
  for (let r = 0; r < 24; r++) add('reminder', { id: `r${r}`, targetType: 'task', targetId: `t${r}`,
    label: 'Practice', deckName: `Project ${Math.floor(r / 12)}`, deckColor: '#3aa6a0', fireAt: start + 3600000,
    repeat: ['none', 'daily', 'weekdays', 'weekly'][r % 4], weekday: r % 7, enabled: true, notify: true,
    sound: false, createdAt: start });
  add('preferences', { id: 'shared', tutorialSeen: true, zenPack: 'nature', zenInterval: 300, zenWallpaper: 'forest' });
  for (let n = 0; n < days; n++) {
    for (let s = 0; s < 6; s++) {
      const t = (n * 6 + s) % 144, duration = 1500 + (n % 4) * 300;
      const task = records[`task:t${t}`]; task.totalSeconds += duration;
      const startedAt = start + n * day + (9 + s) * 3600000;
      add('log', { id: `l${n}-${s}`, taskId: task.id, taskName: task.name, deckName: `Project ${Math.floor(t / 12)}`,
        deckColor: '#3aa6a0', duration, startedAt, endedAt: startedAt + duration * 1000, hasJournal: s === 0 });
    }
    add('journal', { id: `j${n}`, taskId: `t${n * 6 % 144}`, deckId: `d${Math.floor(n * 6 % 144 / 12)}`,
      taskName: 'Study', deckName: 'Project', deckColor: '#3aa6a0', logId: `l${n}-0`,
      content: `Day ${n}. ` + 'I practised the material, checked my progress and planned the next session. '.repeat(12),
      wordCount: 159, createdAt: start + n * day, updatedAt: start + n * day });
  }
  // Repeated edits create history as well as the imported final state. Same trace in both runtimes.
  const edits = Array.from({ length: days }, (_, n) => [
    { id: `task:t${n % 144}`, field: 'name', value: `Study plan ${n}` },
    { id: `checklist:t${n % 144}-c0`, field: 'done', value: !!(n % 2) },
    { id: `reminder:r${n % 24}`, field: 'enabled', value: !!(n % 3) },
    { id: 'preferences:shared', field: 'zenInterval', value: 60 + n % 10 * 30 },
    { id: `journal:j${n}`, text: ' Next: revise tomorrow.' },
    ...(n % 31 === 0 ? [{ id: `task:t${n % 144}`, field: 'deleted', value: true }] : []),
  ]);
  const documents = { catalog: [] };
  for (const [id, r] of Object.entries(records)) {
    const docId = r.kind === 'journal' ? `journal:${r.id}` : r.kind === 'log'
      ? `logs:${new Date(r.startedAt).toISOString().slice(0, 7)}` : 'catalog';
    (documents[docId] ??= []).push(id);
  }
  return { schema: 1, records, edits, documents };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  mkdirSync(new URL('./generated/', import.meta.url), { recursive: true });
  const data = year();
  writeFileSync(new URL('./generated/year.json', import.meta.url), JSON.stringify(data));
  console.log(JSON.stringify({ days: data.edits.length, records: Object.keys(data.records).length,
    json_bytes: Buffer.byteLength(JSON.stringify(data)), synthetic: true }));
}
