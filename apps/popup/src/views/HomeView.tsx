import { AgentState } from '../shared/types'
import { View } from '../App'
import { formatDuration, isDueToday } from '@shared/utils'
import { Sparkles } from 'lucide-react'
type Props = { state: AgentState; setView: (v: View) => void }
export default function HomeView({ state }: Props) {
  const todayLogs = state.logs.filter(l => isDueToday(l.startedAt)), todayTotal = todayLogs.reduce((sum, l) => sum + l.duration, 0)
  const weekAgo = Date.now() - 7 * 86400000, weekTotal = state.logs.filter(l => l.startedAt >= weekAgo).reduce((sum, l) => sum + l.duration, 0)
  return (
    <div className="h-full flex flex-col p-5 overflow-y-auto fade-in">
      <div className="mb-6 text-center py-6"><div className="text-2xl font-light italic text-[#ece9e3] mb-1">Zenith</div><div className="micro-caps mb-6">Time tracking with intention</div><div className="gold-rule w-24 mx-auto mb-6"></div><div className="text-[#7a7a7a] text-sm italic font-light px-4 leading-relaxed">"Today is victory over yourself of yesterday."</div><div className="micro-caps text-[10px] mt-2 text-[#4a4a4a]">— Musashi</div></div>
      <div className="grid grid-cols-2 gap-3 mb-6"><div className="card-soft p-4 text-center"><div className="micro-caps mb-1">Today</div><div className="timer-mono text-xl text-[#ece9e3]">{formatDuration(todayTotal)}</div></div><div className="card-soft p-4 text-center"><div className="micro-caps mb-1">This Week</div><div className="timer-mono text-xl text-[#ece9e3]">{formatDuration(weekTotal)}</div></div></div>
      <div className="card-soft p-4 flex items-center gap-3"><Sparkles size={16} className="text-[#c9a84c]" /><div className="flex-1"><div className="text-sm text-[#ece9e3]">{state.decks.length} Decks</div><div className="micro-caps text-[10px]">{state.tasks.length} Cards · {state.logs.length} Sessions</div></div></div>
    </div>
  )
}
