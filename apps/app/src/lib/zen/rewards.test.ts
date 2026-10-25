import { it, expect } from 'vitest';
import { sessionRewards } from './rewards';
import { migrateFeatures } from './features';
import type { Deck, Log } from './types';
const before:Deck[]=[{id:'d',name:'Sample deck',color:'#c9a84c',tasks:[{id:'t',deckId:'d',name:'Invented practice',tag:'',totalSeconds:3500,createdAt:0}]}];
const log:Log={id:'l',taskId:'t',taskName:'Invented practice',deckName:'Sample deck',deckColor:'#c9a84c',duration:100,startedAt:100000,endedAt:200000,hasJournal:false};
it('quiet defaults produce no rewards and empty sessions are ignored', () => {
  const f=migrateFeatures(null); expect(sessionRewards([log],before,[log],f).messages).toEqual([]);
  expect(sessionRewards([log],before,[log],f).affirmation).toBeUndefined(); expect(sessionRewards([],before,[],f).keys).toEqual([]);
});
it('crosses first hour and goal once with independent affirmation pack', () => {
  const f=migrateFeatures({version:1,rewards:{milestones:true,affirmations:true,pack:['Sample affirmation']},goals:{'task:t':{period:'total',seconds:3600}}});
  const first=sessionRewards([log],before,[log],f); expect(first.messages).toHaveLength(2); expect(first.affirmation).toBe('Sample affirmation');
  first.keys.forEach(k => f.rewards.seen[k]=true); expect(sessionRewards([log],before,[log],f).messages).toEqual([]);
  f.rewards.affirmations=false; expect(sessionRewards([log],before,[log],f).affirmation).toBeUndefined();
});
it('does not announce previously met goals or first hours on every session', () => {
  const later=structuredClone(before); later[0].tasks[0].totalSeconds=7200;
  const f=migrateFeatures({version:1,rewards:{milestones:true},goals:{'task:t':{period:'total',seconds:3600}}});
  expect(sessionRewards([log],later,[log],f).messages).toEqual([]);
});
it('migrates old feature data to all-off reward switches without mutation', () => {
 const old={version:1,companion:{enabled:true}}, original=structuredClone(old), next=migrateFeatures(old);
 expect(next.rewards.recap).toBe(false); expect(next.rewards.affirmations).toBe(false); expect(next.rewards.milestones).toBe(false); expect(old).toEqual(original);
});
