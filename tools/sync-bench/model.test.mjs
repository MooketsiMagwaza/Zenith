import test from 'node:test';
import assert from 'node:assert/strict';
import * as A from '@automerge/automerge';
import { year } from './generate.mjs';
import { automerge, yjs, visible } from './models.mjs';
import { migrate } from './migrate.mjs';

for (const [name, m] of Object.entries({ automerge, yjs })) {
  test(`${name}: partitions, all merge orders, tombstones and journal replacements`, () => {
    let base = m.create(year(1).records), a = m.fork(base), b = m.fork(base), c = m.fork(base);
    a = m.edit(a, [{ id:'task:t0', field:'name', value:'A' }, { id:'journal:j0', at:0, delete:5, text:'ALPHA' }]);
    b = m.edit(b, [{ id:'task:t0', field:'deleted', value:true }, { id:'journal:j0', at:0, delete:5, text:'BETA' }]);
    c = m.edit(c, [{ id:'task:t0', field:'name', value:'C' }, { id:'journal:j0', text:'🧭 café' }]);
    const snapshots = [a,b,c].map(d => m.save(d));
    let expected;
    for (const order of [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]]) {
      let d = m.fork(base);
      for (const i of order) { const incoming = m.load(snapshots[i]); d = m.merge(d, incoming); d = m.merge(d, incoming); m.dispose(incoming); }
      d = m.edit(d, [{ id:'task:t0', field:'name', value:'later' }]);
      const r = m.json(d); expected ??= r; assert.deepEqual(r, expected);
      assert.equal(visible(r, 'task:t0'), false); assert.equal(visible(r, 'journal:j0'), false);
      assert.equal(visible(r, 'log:l0-0'), true);
      assert.ok(r['journal:j0'].content.includes('ALPHA') && r['journal:j0'].content.includes('BETA') && r['journal:j0'].content.includes('🧭 café'));
      if (name === 'automerge') assert.equal(Object.keys(A.getConflicts(d.records['task:t0'], 'name') ?? {}).length, 0);
      m.dispose(d);
    }
    [base,a,b,c].forEach(d => m.dispose(d));
  });
}
test('generated year counts and original session totals agree', () => {
  const d = year(), rs = Object.values(d.records);
  for (const [kind, count] of Object.entries({deck:12,task:144,checklist:432,reminder:24,preferences:1,log:2190,journal:365}))
    assert.equal(rs.filter(r => r.kind === kind).length, count);
  for (const t of rs.filter(r => r.kind === 'task'))
    assert.equal(t.totalSeconds, rs.filter(r => r.kind === 'log' && r.taskId === t.id).reduce((n,l) => n+l.duration, 0));
});

const task = { id:'t', deckId:'d', name:'Task', tag:'Study', totalSeconds:99, createdAt:1,
  checklist:[{id:'c',text:'Checklist',done:false}] };
const popup = { version:4, decks:[{id:'d',name:'Deck',color:'#123456',createdAt:1}], tasks:[task],
  logs:[{id:'l',taskId:'t',taskName:'Task',deckName:'Deck',deckColor:'#123456',duration:30,startedAt:1,endedAt:31,hasJournal:true}],
  journals:[{id:'j',taskId:'t',content:'🧭 café\nreflection',updatedAt:5}, {id:'orphan',taskId:'lost',content:'keep me',updatedAt:4}],
  reminders:[{id:'r',targetType:'task',targetId:'t',label:'Study',fireAt:9,repeat:'daily',enabled:true,notify:true,sound:false,createdAt:1}],
  active:{taskIds:['t'],deckIds:['d'],startedAt:5}, tutorialSeen:true,zenPack:'nature',zenInterval:60,zenWallpaper:'forest',futureSetting:{keep:true} };
for (const format of ['popup-browser','popup-file','full-localStorage']) {
  test(`migration ${format}: every ID and text survives and original bytes are retained`, () => {
    const source = format === 'popup-file' ? {state:popup} : format === 'popup-browser' ? popup : {
      toggl_zen_decks:JSON.stringify([{id:'d',name:'Deck',color:'#123456',tasks:[task]}]),
      toggl_zen_logs:JSON.stringify(popup.logs), toggl_zen_journals:JSON.stringify(popup.journals.map(j => {
        const {content,...rest} = j; return {...rest, body:content,logId:null,wordCount:3,createdAt:1}; })),
      toggl_zen_reminders:JSON.stringify(popup.reminders), toggl_zen_active:JSON.stringify(popup.active), customPreference:'preserve exactly',
      'zenith.zen.pack':'nature', 'zenith.zen.intervalSec':'60', 'zenith.tutorial.seen':'1',
      'zenith.zen.customQuotes':'["quote one","quote two"]', 'zenith.zen.customWalls':'["data:image/example"]', 'zenith.zen.wallIdx':'1' };
    const raw = JSON.stringify(source, null, 2), result = migrate(raw, format);
    assert.equal(result.archive.raw, raw); assert.equal(migrate(raw,format).sourceHash, result.sourceHash);
    assert.equal(Object.keys(result.records).length, 8);
    assert.equal(result.records['journal:j'].content, popup.journals[0].content);
    assert.equal(result.records['journal:orphan'].content, 'keep me');
    assert.equal(result.records['task:t'].totalSeconds, 99);
    assert.equal(result.records['task:t'].legacySecondsOffset + result.records['log:l'].duration, 99);
    assert.equal(result.records['preferences:shared'].zenPack, 'nature');
    assert.equal(result.records['preferences:shared'].zenInterval, 60);
    if (format === 'full-localStorage') {
      assert.equal(result.records['preferences:shared'].customQuotesJson, '["quote one","quote two"]');
      assert.equal(result.deviceLocal.wallIndex,'1');
    }
    assert.deepEqual(result.deviceLocal.active, popup.active);
    for (const m of [automerge,yjs]) { const d = m.create(result.records), loaded = m.load(m.save(d));
      assert.deepEqual(m.json(loaded), result.records); m.dispose(d); m.dispose(loaded); }
  });
}
test('migration refuses corrupt JSON, duplicate IDs, reserved shape and missing text', () => {
  assert.throws(() => migrate('{','popup-browser'));
  assert.throws(() => migrate(JSON.stringify({...popup,tasks:[task,task]}),'popup-browser'));
  assert.throws(() => migrate(JSON.stringify({...popup,journals:[{id:'j'}]}),'popup-browser'));
  assert.throws(() => migrate(JSON.stringify({...popup,decks:[{id:'d',kind:'deck'}]}),'popup-browser'));
});
