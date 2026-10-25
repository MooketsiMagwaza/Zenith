import { JournalSchema } from './dataFormat';
import type { Journal } from './types';
export function exportMarkdown(journals:Journal[]) {
 return '# Zenith journals\n\n'+journals.map(j => {
  const {body,...metadata}=j;
  const title=(j.taskName || j.deckName || 'Journal').replace(/[\r\n]/g,' ');
  return `## ${title}\n<!-- zenith-journal-v1 ${encodeURIComponent(JSON.stringify({...metadata,bodyLength:body.length}))} -->\n${body}\n\n`;
 }).join('');
}
/** Length-framed bodies keep arbitrary Markdown (including marker-like comments) unchanged. */
export function importMarkdown(text:string):Journal[] {
 if(!text.startsWith('# Zenith journals\n\n')) throw new Error('Choose a Zenith journal bundle; arbitrary Markdown needs a card target');
 const result:Journal[]=[]; let cursor='# Zenith journals\n\n'.length;
 while(cursor<text.length) {
  const header=/^## [^\n]*\n<!-- zenith-journal-v1 ([^\n]+) -->\n/.exec(text.slice(cursor));
  if(!header) throw new Error('Malformed journal bundle');
  const meta=JSON.parse(decodeURIComponent(header[1])); cursor+=header[0].length;
  if(!Number.isInteger(meta.bodyLength) || meta.bodyLength<0 || cursor+meta.bodyLength>text.length) throw new Error('Invalid journal body length');
  const body=text.slice(cursor,cursor+meta.bodyLength); cursor+=meta.bodyLength;
  if(text.slice(cursor,cursor+2)!=='\n\n') throw new Error('Invalid journal separator'); cursor+=2;
  const {bodyLength,...metadata}=meta; result.push(JournalSchema.parse({...metadata,body}));
 }
 return result;
}
