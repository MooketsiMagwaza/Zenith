import type { Deck, Log } from './types';
import type { Features } from './features';
import { goalProgress, goalWindow, targetInfo } from './progress';
export function sessionRewards(completed: Log[], before: Deck[], allLogs: Log[], features: Features) {
  const r = features.rewards, messages: string[] = [], keys: string[] = [];
  const last = completed[0];
  if (!last) return {messages, keys, affirmation:undefined};
  const now = Math.max(...completed.map(l => l.endedAt)) - 1;
  const add = (key:string, message:string) => { if(!r.seen[key]) { keys.push(key); messages.push(message); } };
  if (r.milestones) {
    for (const l of completed) {
      const t = before.flatMap(d => d.tasks).find(t => t.id === l.taskId);
      if(t && t.totalSeconds < 3600 && t.totalSeconds + l.duration >= 3600) add(`hour:${t.id}`, `Your first hour with ${t.name}.`);
    }
    const ids = new Set(completed.map(l => l.id));
    const earlier = allLogs.filter(l => !ids.has(l.id));
    for(const [target, goal] of Object.entries(features.goals)) {
      const info = targetInfo(before,target);
      if (!info.title || !completed.some(l => info.taskIds.includes(l.taskId))) continue;
      const added = completed.filter(l => info.taskIds.includes(l.taskId)).reduce((s,l) => s+l.duration,0);
      const was = goalProgress(goal,info.taskIds,earlier,info.lifetime,now);
      const is = goalProgress(goal,info.taskIds,allLogs,info.lifetime+added,now);
      if(!was.met && is.met) add(`goal:${target}:${goal.period}:${goal.seconds}:${goalWindow(goal,now)[0]}`, `You met your intention for ${info.title}.`);
    }
  }
  const index = Math.abs(completed[0].startedAt) % Math.max(1,r.pack.length);
  return {messages, keys, affirmation: r.affirmations ? r.pack[index] : undefined};
}
