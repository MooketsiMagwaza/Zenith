import { useEffect, useState } from 'react'
import { AgentState } from './shared/types'
import { formatDuration } from './shared/utils'
import HomeView from './views/HomeView'
import DecksView from './views/DecksView'
import HistoryView from './views/HistoryView'
import JournalView from './views/JournalView'
import SearchView from './views/SearchView'
import FocusView from './views/FocusView'
import ZenView from './views/ZenView'
import { Toaster, toast } from 'sonner'
import { LayoutGrid, BookOpen, History, Search, Sparkles, Pause, Home } from 'lucide-react'

export type View = 'home' | 'decks' | 'history' | 'journal' | 'search' | 'focus' | 'zen'

export default function App() {
  const [view, setView] = useState<View>('decks')
  const [state, setState] = useState<AgentState | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [isMinimized, setIsMinimized] = useState(false)

  useEffect(() => {
    window.api?.getState().then(s => { setState(s) })
    const unsub = window.api?.onStateUpdate(setState)
    return unsub
  }, [])

  useEffect(() => {
    const u1 = window.api?.on('reminder:fire', (r: any) => {
      toast.info(`Reminder: ${r.label}`, { description: r.deckName, action: { label: 'Open', onClick: () => setView('journal') } })
      if (r.sound) { 
        try { 
          const ctx = new AudioContext()
          const gain = ctx.createGain()
          gain.connect(ctx.destination);
          [[880, 0], [660, 0.35]].forEach(([freq, start]) => {
            const osc = ctx.createOscillator()
            osc.type = 'sine'; osc.frequency.value = freq
            osc.connect(gain)
            gain.gain.setValueAtTime(0.001, ctx.currentTime + start)
            gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + start + 0.02)
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + 0.32)
            osc.start(ctx.currentTime + start)
            osc.stop(ctx.currentTime + start + 0.4)
          })
        } catch {} 
      }
    })
    const u2 = window.api?.on('view:open', (v: View) => setView(v))
    const u3 = window.api?.on('window:minimized', () => setIsMinimized(true))
    const u4 = window.api?.on('window:restored', () => setIsMinimized(false))
    return () => { u1?.(); u2?.(); u3?.(); u4?.() }
  }, [])

  useEffect(() => {
    if (!state?.active?.startedAt) { setElapsed(0); return }
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - state.active!.startedAt!) / 1000)), 500)
    return () => clearInterval(id)
  }, [state?.active?.startedAt])

  if (!state) return null

  const activeTask = state.active?.taskIds[0] ? state.tasks.find(t => t.id === state.active!.taskIds[0]) : null
  const isActive = !!state.active?.startedAt

    // MINIMIZED BALL UI
  if (isMinimized) {
    return (
      <div 
        className="app-shell minimized flex items-center justify-center" data-tauri-drag-region
        title="Drag edges to move • Double-click center to expand"
      >
        {/* Inner 64x64 circle: not a drag region, so it catches double-clicks */}
        <div 
          className="w-16 h-16 flex items-center justify-center cursor-pointer rounded-full hover:bg-white/5 transition-colors"
          onDoubleClick={() => window.api.toggleMinimize()}
        >
          <div className="text-center pointer-events-none">
            {isActive ? (
              <>
                <div className="timer-mono text-[#ece9e3] text-lg leading-none">{formatDuration(elapsed)}</div>
                <div className="w-1.5 h-1.5 rounded-full bg-[#c9a84c] pulse-gold mx-auto mt-2" />
              </>
            ) : (
              <div className="text-[#c9a84c] font-serif text-3xl leading-none">Z</div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell flex flex-col overflow-hidden">
      <div className="h-8 flex items-center justify-center shrink-0" data-tauri-drag-region>
        <div 
          className="w-12 h-1.5 bg-[#2c2c2c] hover:bg-[#c9a84c] rounded-full transition-colors cursor-pointer" 
          onDoubleClick={() => window.api.toggleMinimize()}
          title="Double-click to minimize"
        />
      </div>

      <main className="flex-1 overflow-hidden relative bg-[#050505]">
        <div className={`absolute inset-0 transition-opacity duration-200 ${view === 'home' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}><HomeView state={state} setView={setView} /></div>
        <div className={`absolute inset-0 transition-opacity duration-200 ${view === 'decks' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}><DecksView state={state} setView={setView} /></div>
        <div className={`absolute inset-0 transition-opacity duration-200 ${view === 'journal' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}><JournalView state={state} setView={setView} /></div>
        <div className={`absolute inset-0 transition-opacity duration-200 ${view === 'history' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}><HistoryView state={state} setView={setView} /></div>
        <div className={`absolute inset-0 transition-opacity duration-200 ${view === 'search' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}><SearchView state={state} setView={setView} /></div>
      </main>

      {view !== 'focus' && view !== 'zen' && (
        <div className="shrink-0 border-t border-[#1a1a1a] bg-[#060606] relative z-50">
          {isActive && activeTask && (
            <div className="px-4 py-2.5 border-b border-[#1a1a1a] flex items-center justify-between bg-[#0a0a0a]">
              <div className="flex-1 min-w-0 mr-3">
                <div className="micro-caps text-[#c9a84c] text-[9px] mb-0.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#c9a84c] pulse-gold" />
                  Active Focus
                </div>
                <div className="text-sm text-[#ece9e3] truncate font-light">{activeTask.name}</div>
              </div>
              <div className="timer-mono text-[#ece9e3] text-xl mr-4">{formatDuration(elapsed)}</div>
              <button type="button" onClick={() => window.api.sendCommand({ type: 'STOP_SESSION' })} className="p-2 bg-[#c9a84c] text-[#000] rounded-lg hover:bg-[#d4b55d] transition-colors">
                <Pause size={14} strokeWidth={2.5} />
              </button>
            </div>
          )}
          <div className="flex justify-around items-center h-14 relative z-50">
            <TabBtn id="home" icon={Home} label="Home" view={view} setView={setView} />
            <TabBtn id="decks" icon={LayoutGrid} label="Decks" view={view} setView={setView} />
            <TabBtn id="journal" icon={BookOpen} label="Journal" view={view} setView={setView} />
            <TabBtn id="history" icon={History} label="History" view={view} setView={setView} />
            <TabBtn id="search" icon={Search} label="Search" view={view} setView={setView} />
            <TabBtn id="zen" icon={Sparkles} label="Zen" view={view} setView={setView} />
          </div>
        </div>
      )}

      {view === 'focus' && <FocusView state={state} onClose={() => setView('decks')} />}
      {view === 'zen' && <ZenView state={state} onClose={() => setView('decks')} />}
      <Toaster position="bottom-center" toastOptions={{ className: 'bg-[#0a0a0a] border border-[#1a1a1a] text-[#ece9e3]' }} />
    </div>
  )
}

function TabBtn({ id, icon: Icon, label, view, setView }: { id: View, icon: any, label: string, view: View, setView: (v: View) => void }) {
  const isActive = view === id
  return (
    <button type="button" onClick={() => setView(id)} className={`flex flex-col items-center gap-1 px-2 py-1 transition-colors ${isActive ? 'text-[#c9a84c]' : 'text-[#4a4a4a] hover:text-[#7a7a7a]'}`}>
      <Icon size={18} strokeWidth={isActive ? 2.5 : 1.5} />
      <span className="micro-caps text-[9px]" style={{ color: isActive ? '#c9a84c' : undefined }}>{label}</span>
    </button>
  )
}
