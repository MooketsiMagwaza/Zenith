import { useState } from 'react'
import { AgentState, Reminder } from '../shared/types'
import { X, Bell, Volume2, Calendar } from 'lucide-react'

type Props = { state: AgentState; onClose: () => void }

export default function ReminderModal({ state, onClose }: Props) {
  const [label, setLabel] = useState('')
  const [targetType, setTargetType] = useState<'task'|'deck'>('task')
  const [targetId, setTargetId] = useState('')
  const [repeat, setRepeat] = useState<'none'|'daily'|'weekdays'|'weekly'>('none')
  const [time, setTime] = useState('09:00')
  const [notify, setNotify] = useState(true)
  const [sound, setSound] = useState(true)
  const [weekday, setWeekday] = useState(1)

  const save = () => { 
    if (!label.trim() || !targetId) return; 
    const [h, m] = time.split(':').map(Number); 
    const fireAt = new Date(); 
    fireAt.setHours(h, m, 0, 0); 
    
    if (fireAt.getTime() < Date.now()) {
      fireAt.setDate(fireAt.getDate() + 1)
    }

    window.api.sendCommand({ 
      type: 'ADD_REMINDER', 
      reminder: { 
        targetType, targetId, label: label.trim(), 
        fireAt: fireAt.getTime(), repeat, 
        weekday: repeat === 'weekly' ? weekday : undefined,
        enabled: true, notify, sound, 
        deckName: targetType==='deck'?state.decks.find(d=>d.id===targetId)?.name:undefined, 
        deckColor: targetType==='deck'?state.decks.find(d=>d.id===targetId)?.color:undefined 
      } 
    }); 
    onClose() 
  }

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="absolute inset-0 z-60 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-[#050505] border border-[#1a1a1a] rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-4"><span className="micro-caps">New Reminder</span><button onClick={onClose} className="text-[#7a7a7a] hover:text-[#ece9e3]"><X size={18}/></button></div>
        <div className="space-y-4">
          <input value={label} onChange={e=>setLabel(e.target.value)} placeholder="Reminder label..." className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg outline-none focus:border-[#c9a84c] text-[#ece9e3]" />
          <div className="flex gap-2">
            <select value={targetType} onChange={e=>setTargetType(e.target.value as any)} className="flex-1 px-3 py-2 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg outline-none text-[#ece9e3]"><option value="task">Card</option><option value="deck">Deck</option></select>
            <select value={targetId} onChange={e=>setTargetId(e.target.value)} className="flex-2 px-3 py-2 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg outline-none text-[#ece9e3]">{(targetType==='task'?state.tasks:state.decks).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>
          </div>
          <div className="flex gap-2">
            <input type="time" value={time} onChange={e=>setTime(e.target.value)} className="flex-1 px-3 py-2 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg outline-none text-[#ece9e3]" />
            <select value={repeat} onChange={e=>setRepeat(e.target.value as any)} className="flex-1 px-3 py-2 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg outline-none text-[#ece9e3]"><option value="none">Once</option><option value="daily">Daily</option><option value="weekdays">Weekdays</option><option value="weekly">Weekly</option></select>
          </div>
          
          {repeat === 'weekly' && (
            <div className="flex gap-1 justify-between">
              {weekdays.map((day, idx) => (
                <button key={idx} onClick={() => setWeekday(idx)} className={`flex-1 py-1.5 micro-caps rounded transition-colors ${weekday === idx ? 'bg-[#c9a84c] text-[#000]' : 'bg-[#0a0a0a] text-[#7a7a7a] hover:text-[#ece9e3]'}`}>{day}</button>
              ))}
            </div>
          )}

          <div className="flex gap-4">
            <label className="flex items-center gap-2 micro-caps text-[#7a7a7a]"><input type="checkbox" checked={notify} onChange={e=>setNotify(e.target.checked)} className="accent-[#c9a84c]" /><Bell size={14}/> Notify</label>
            <label className="flex items-center gap-2 micro-caps text-[#7a7a7a]"><input type="checkbox" checked={sound} onChange={e=>setSound(e.target.checked)} className="accent-[#c9a84c]" /><Volume2 size={14}/> Sound</label>
          </div>
        </div>
        <div className="mt-6 flex justify-end"><button onClick={save} className="px-6 py-2 bg-[#c9a84c] text-[#000] rounded-lg micro-caps font-medium">Create Reminder</button></div>
      </div>
    </div>
  )
}
