import { useState } from 'react'
import { AgentState } from '../shared/types'
import { View } from '../App'
import { formatDuration, dateKey } from '../shared/utils'
import { ChevronDown, Clock, Calendar } from 'lucide-react'

type Props = { state: AgentState; setView: (v: View) => void }

function formatReadableDate(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  if (date.getTime() === today.getTime()) return 'Today'
  if (date.getTime() === yesterday.getTime()) return 'Yesterday'
  
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export default function HistoryView({ state, setView }: Props) {
  const grouped = state.logs.reduce((acc, log) => {
    const key = dateKey(log.startedAt)
    if (!acc[key]) acc[key] = []
    acc[key].push(log)
    return acc
  }, {} as Record<string, typeof state.logs>)

  const sortedDays = Object.keys(grouped).sort((a, b) => b.localeCompare(a))
  
  // Track expanded days. Default to expanding the most recent day.
  const [expandedDays, setExpandedDays] = useState<Set<string>>(
    new Set(sortedDays.length > 0 ? [sortedDays[0]] : [])
  )

  const toggleDay = (day: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev)
      if (next.has(day)) next.delete(day)
      else next.add(day)
      return next
    })
  }

  const totalWeek = state.logs
    .filter(l => l.startedAt >= Date.now() - 7 * 86400000)
    .reduce((sum, l) => sum + l.duration, 0)

  return (
    <div className="h-full flex flex-col bg-[#050505]">
      {/* Header */}
      <div className="p-4 border-b border-[#1a1a1a] flex items-center justify-between shrink-0 bg-[#060606]">
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-[#c9a84c]" />
          <span className="micro-caps text-[#ece9e3] tracking-wider">History</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="micro-caps text-[#4a4a4a] text-[9px]">This Week</div>
            <span className="timer-mono text-[#c9a84c] text-sm">{formatDuration(totalWeek)}</span>
          </div>
          <div className="text-right">
            <div className="micro-caps text-[#4a4a4a] text-[9px]">Total</div>
            <span className="timer-mono text-[#ece9e3] text-sm">{state.logs.length}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {sortedDays.length === 0 && (
          <div className="text-center py-20 text-[#4a4a4a] micro-caps">
            No sessions recorded yet.
          </div>
        )}
        
        {sortedDays.map(day => {
          const logs = grouped[day].sort((a, b) => b.startedAt - a.startedAt)
          const dayTotal = logs.reduce((sum, l) => sum + l.duration, 0)
          const isExpanded = expandedDays.has(day)
          
          return (
            <div key={day} className="border border-[#1a1a1a] rounded-xl overflow-hidden bg-[#0a0a0a]/50">
              {/* Day Header (Dropdown Toggle) */}
              <button
                onClick={() => toggleDay(day)}
                className="w-full flex items-center justify-between p-3 hover:bg-[#111111] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="text-[#7a7a7a] transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
                    <ChevronDown size={16} />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium text-[#ece9e3]">{formatReadableDate(day)}</div>
                    <div className="micro-caps text-[10px] text-[#4a4a4a] mt-0.5">
                      {logs.length} session{logs.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
                <div className="timer-mono text-[#c9a84c] text-sm">
                  {formatDuration(dayTotal)}
                </div>
              </button>

              {/* Expanded Timeline */}
              {isExpanded && (
                <div className="border-t border-[#1a1a1a] bg-[#050505] p-4">
                  <div className="space-y-0">
                    {logs.map((log, idx) => {
                      const startTime = formatTime(log.startedAt)
                      const endTime = formatTime(log.endedAt || (log.startedAt + log.duration * 1000))
                      const isLast = idx === logs.length - 1
                      
                      return (
                        <div key={log.id} className="flex gap-3">
                          {/* Timeline Column */}
                          <div className="flex flex-col items-center w-4 shrink-0">
                            <div 
                              className="w-2.5 h-2.5 rounded-full border-2 border-[#050505] z-10 mt-1.5 transition-transform group-hover:scale-125"
                              style={{ background: log.deckColor }}
                            />
                            {!isLast && <div className="flex-1 w-px bg-[#1a1a1a] my-1" />}
                          </div>
                          
                          {/* Content Column */}
                          <button
                            onClick={() => setView('journal')}
                            className="flex-1 min-w-0 bg-[#0a0a0a] hover:bg-[#111111] border border-[#1a1a1a] hover:border-[#2c2c2c] rounded-lg p-2.5 transition-all text-left mb-3 group"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <div className="text-sm text-[#ece9e3] truncate font-medium group-hover:text-[#c9a84c] transition-colors">
                                {log.taskName}
                              </div>
                              <div className="timer-mono text-[#ece9e3] text-xs shrink-0 ml-2">
                                {formatDuration(log.duration)}
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="micro-caps text-[10px] text-[#7a7a7a] truncate">
                                {log.deckName}
                              </div>
                              <div className="micro-caps text-[10px] text-[#4a4a4a] shrink-0 ml-2 flex items-center gap-1">
                                <Clock size={9} />
                                {startTime} - {endTime}
                              </div>
                            </div>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
