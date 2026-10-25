import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {applyRecords,exportJSON,importJSON,snapshotFromRecords,recordsWithSnapshot,validateSnapshot,type DataSnapshot} from './dataFormat';
import {exportCSV,importCSV,parseCSV} from './csv';
import {exportMarkdown,importMarkdown} from './markdownData';
import {exportICS} from './ics';
import {importICS} from './icsImport';
import {mergeData} from './mergeData';
import {migrateFeatures} from './features';
const fixture=(name:string) => readFileSync(new URL(`./fixtures/${name}`,import.meta.url),'utf8');
const legacy=JSON.parse(fixture('current-build-export.json'));
const empty:DataSnapshot={decks:[],logs:[],journals:[],reminders:[]};
it('imports the invented pre-change snapshot and round trips original storage strings',() => {
 const original=structuredClone(legacy), records=importJSON(JSON.stringify(legacy));
 records['zenith.zen.customQuotes']='["Invented sample quote"]';
 expect(importJSON(exportJSON(records,0))).toEqual(records); expect(snapshotFromRecords(records).decks).toEqual(legacy.decks); expect(legacy).toEqual(original);
});
it('rejects malformed/future data and foreign storage keys before writing',() => {
 const records=importJSON(JSON.stringify(legacy));
 expect(() => importJSON('{')).toThrow(); expect(() => importJSON(JSON.stringify({format:'zenith',version:2,exportedAt:'',records}))).toThrow();
 expect(() => importJSON(exportJSON({...records,'zenith.features.v1':'{"version":2}'},0))).toThrow();
 expect(() => importJSON(JSON.stringify({format:'zenith',version:1,exportedAt:'',records:{...records,unrelated:'secret'}}))).toThrow();
 expect(() => validateSnapshot({...legacy,logs:[{...legacy.logs[0],duration:-1}]})).toThrow();
});
it('CSV round trips quotes/newlines and spreadsheet-formula-like titles',() => {
 const logs=[{...legacy.logs[0],taskName:'=SAMPLE("x")\nSnow 雪',deckName:"'quoted, deck"}];
 const csv=exportCSV(logs); expect(csv).toContain("'=SAMPLE"); expect(importCSV(csv,'zenith')).toEqual(logs);
 expect(() => parseCSV('a,b\n"unfinished,b')).toThrow(); expect(() => parseCSV('a,b\n1')).toThrow(); expect(() => parseCSV('a,a\n1,2')).toThrow();
});
it('imports labelled invented Toggl/Clockify fixtures and deduplicates repeated merges',() => {
 const toggl=importCSV(fixture('toggl-invented.csv'),'toggl'), clockify=importCSV(fixture('clockify-invented.csv'),'clockify','mdy');
 expect(toggl).toHaveLength(2); expect(toggl[0].duration).toBe(1500); expect(toggl[1].taskName).toBe('Practise "scales"'); expect(clockify[0].duration).toBe(600);
 const combined=mergeData(empty,{logs:[...toggl,...clockify]}), again=mergeData(combined,{logs:[...toggl,...clockify]});
 expect(again).toEqual(combined); expect(again.decks.flatMap(d => d.tasks).reduce((s,t) => s+t.totalSeconds,0)).toBe(5100);
});
it('rejects unsupported headers, impossible dates, future CSV versions and conflicting sessions',() => {
 expect(() => importCSV('Project,Description\nSample,Sample','toggl')).toThrow();
 expect(() => importCSV(fixture('toggl-invented.csv').replaceAll('2026-10-08','2026-02-30'),'toggl')).toThrow();
 expect(() => importCSV(exportCSV(legacy.logs).replace('"1"','"2"'),'zenith')).toThrow();
 expect(() => mergeData(validateSnapshot(legacy),{logs:[{...legacy.logs[0],duration:999}]})).toThrow();
});
it('Markdown journals round trip arbitrary bodies, preserve existing notes and deduplicate appends',() => {
 const journals=[{...legacy.journals[0],body:'# Snow 雪\n<!-- zenith-journal-v1 fake -->\n\ntext\r\n'}];
 expect(importMarkdown(exportMarkdown(journals))).toEqual(journals);
 const merged=mergeData(validateSnapshot(legacy),{journals}); expect(merged.journals[0].body).toContain(legacy.journals[0].body); expect(merged.journals[0].body).toContain(journals[0].body);
 expect(mergeData(merged,{journals})).toEqual(merged); expect(() => importMarkdown('ordinary notes')).toThrow();
});
it('iCalendar round trips sessions and enabled recurring reminders and rejects unsupported rules',() => {
 const reminder={id:'sample-r',targetType:'task' as const,targetId:'sample-card',label:'Sample read, Gatsby',fireAt:legacy.logs[0].startedAt,repeat:'weekly' as const,weekday:4,enabled:true,notify:false,sound:false,createdAt:legacy.logs[0].startedAt};
 const imported=importICS(exportICS(legacy.logs,[reminder])); expect(imported.logs).toEqual(legacy.logs);
 expect(imported.reminders[0].id).toBe(reminder.id); expect(imported.reminders[0].fireAt).toBe(reminder.fireAt); expect(imported.reminders[0].weekday).toBe(4);
 expect(() => importICS(exportICS([],[reminder]).replace('FREQ=WEEKLY;BYDAY=TH','FREQ=MONTHLY'))).toThrow();
 expect(() => importICS(exportICS(legacy.logs,[]).replace('DTSTART:','DTSTART;TZID=Europe/London:'))).toThrow();
});
it('storage apply rolls back on a failed write and leaves unrelated keys alone',async () => {
 const before=importJSON(JSON.stringify(legacy)); const values=new Map(Object.entries({...before,unrelated:'keep'})); let fail=true;
 const store={entries:() => Array.from(values.entries()),getItem:(k:string) => values.get(k) ?? null,setItem:(k:string,v:string) => {if(fail && k==='toggl_zen_logs') {fail=false;throw new Error('Invented quota failure');} values.set(k,v);},removeItem:(k:string) => {values.delete(k);}};
 const next=recordsWithSnapshot(before,{...validateSnapshot(legacy),logs:[]}); let rejected=false;
 try {await applyRecords(store,next);} catch {rejected=true;}
 expect(rejected).toBe(true); expect(Object.fromEntries(values)).toEqual({...before,unrelated:'keep'});
 await applyRecords(store,next); expect(values.get('unrelated')).toBe('keep'); expect(values.get('toggl_zen_logs')).toBe('[]');
});
it('preserves extension fields in older v1 feature records during additive migration',() => {
 const raw={version:1,extra:{sample:'invented'},companion:{enabled:true,extra:'keep',cards:{t:{kind:'book',extra:42}}},rewards:{extra:'keep'},goals:{'task:t':{period:'total',seconds:60,extra:'keep'}}};
 const migrated=migrateFeatures(raw); expect(migrated.extra).toEqual(raw.extra); expect(migrated.companion.extra).toBe('keep'); expect(migrated.companion.cards.t.extra).toBe(42); expect(migrated.rewards.extra).toBe('keep'); expect(migrated.goals['task:t'].extra).toBe('keep');
});
it('rolls back an asynchronous desktop flush failure',async () => {
 const before=importJSON(JSON.stringify(legacy)), values=new Map(Object.entries(before)); let fail=true;
 const store={entries:() => Array.from(values.entries()),getItem:(k:string) => values.get(k) ?? null,setItem:(k:string,v:string) => {values.set(k,v);},removeItem:(k:string) => {values.delete(k);},flush:async () => {if(fail) {fail=false;throw new Error('Invented desktop write failure');}}};
 let rejected=false; try {await applyRecords(store,recordsWithSnapshot(before,{...validateSnapshot(legacy),logs:[]}));} catch {rejected=true;}
 expect(rejected).toBe(true);expect(Object.fromEntries(values)).toEqual(before);
});
