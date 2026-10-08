import { useState } from 'react'
import { AgentState, TimerMode, Deck, Task } from '../shared/types'
import { View } from '../App'
import { formatDuration } from '../shared/utils'
import { Plus, Trash2, Pause, Play, Tag, Edit2, X, ListTodo, CheckSquare, Square } from 'lucide-react'
import { DECK_COLORS } from '@shared/constants'

type Props = { state: AgentState; setView: (v: View) => void }

export default function DecksView({ state }: Props) {
  const [activeDeckId, setActiveDeckId] = useState<string | null>(state.decks[0]?.id || null)
  const [deckModal, setDeckModal] = useState<{ open: boolean, deck?: Deck }>({ open: false })
  const [taskModal, setTaskModal] = useState<{ open: boolean, task?: Task }>({ open: false })
  const [showChecklistFor, setShowChecklistFor] = useState<string | null>(null)
  const [newChecklistItem, setNewChecklistItem] = useState('')
  
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const activeDeck = state.decks.find(d => d.id === activeDeckId)
  const tasks = activeDeck ? state.tasks.filter(t => t.deckId === activeDeck.id) : []

  const addChecklistItem = (taskId: string) => {
    if (newChecklistItem.trim()) {
      window.api.sendCommand({ type: 'ADD_CHECKLIST_ITEM', taskId, text: newChecklistItem.trim() })
      setNewChecklistItem('')
    }
  }

  const toggleSession = (task: Task) => {
    const isActive = state.active?.taskIds.includes(task.id)
    window.api.sendCommand(isActive ? { type: 'STOP_SESSION' } : { type: 'START_SESSION', taskIds: [task.id] })
  }

  const handleCardClick = (e: React.MouseEvent, task: Task) => {
    if (selectMode || e.metaKey || e.ctrlKey) {
      setSelected(prev => {
        const next = new Set(prev)
        if (next.has(task.id)) next.delete(task.id)
        else next.add(task.id)
        return next
      })
    } else {
      toggleSession(task)
    }
  }

  const startGroup = () => {
    if (selected.size > 0) {
      window.api.sendCommand({ type: 'START_SESSION', taskIds: Array.from(selected) })
      setSelected(new Set())
      setSelectMode(false)
    }
  }

  return (
    <div className="h-full flex flex-col relative">
      <div className="border-b border-[#1a1a1a] px-4 py-2 flex items-center gap-2 overflow-x-auto shrink-0 bg-[#060606]">
        {state.decks.map(d => (
          <button
            key={d.id}
            onClick={() => setActiveDeckId(d.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
              d.id === activeDeckId ? 'bg-[#111111] text-[#ece9e3]' : 'text-[#7a7a7a] hover:bg-[#0a0a0a]'
            }`}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
            {d.name}
          </button>
        ))}
        <button
          onClick={() => setDeckModal({ open: true })}
          className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs text-[#c9a84c] hover:bg-[#0a0a0a] whitespace-nowrap"
        >
          <Plus size={12} /> New Deck
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-24">
        {activeDeck ? (
          <>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-light text-[#ece9e3]">{activeDeck.name}</h2>
                <div className="micro-caps text-[#7a7a7a] mt-1">{tasks.length} cards</div>
              </div>
              <div className="flex gap-2 items-center">
                <button 
                  onClick={() => { setSelectMode(!selectMode); if(selectMode) setSelected(new Set()); }} 
                  className={`px-3 py-1.5 rounded-md micro-caps border transition-colors ${selectMode ? 'border-[#c9a84c] text-[#c9a84c] bg-[#c9a84c]/10' : 'border-[#1a1a1a] text-[#7a7a7a] hover:border-[#2c2c2c]'}`}
                >
                  {selectMode ? 'Done' : 'Select'}
                </button>
                <button onClick={() => setDeckModal({ open: true, deck: activeDeck })} className="p-2 text-[#7a7a7a] hover:text-[#ece9e3]"><Edit2 size={14} /></button>
                <button onClick={() => { if (confirm('Delete deck?')) window.api.sendCommand({ type: 'DELETE_DECK', id: activeDeck.id }) }} className="p-2 text-[#7a7a7a] hover:text-red-500"><Trash2 size={14} /></button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {tasks.map(task => {
                const isActive = state.active?.taskIds.includes(task.id)
                const isSelected = selected.has(task.id)
                return (
                  <div
                    key={task.id}
                    onClick={(e) => handleCardClick(e, task)}
                    className={`card-soft p-4 cursor-pointer select-none transition-all ${
                      isSelected
                        ? 'border-[#c9a84c] ring-1 ring-[#c9a84c]/30 bg-[#0a0a0a]'
                        : isActive
                          ? 'border-[#c9a84c] ring-1 ring-[#c9a84c]/30'
                          : 'hover:border-[#2c2c2c] hover:ring-1 hover:ring-white/5'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1 min-w-0 flex items-center gap-3">
                        {selectMode && (
                          <div className="shrink-0 text-[#c9a84c]">
                            {isSelected ? <CheckSquare size={16} /> : <Square size={16} className="text-[#4a4a4a]" />}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-sm text-[#ece9e3] font-medium truncate">{task.name}</div>
                          {task.tag && (
                            <div className="micro-caps text-[10px] text-[#7a7a7a] mt-1 flex items-center gap-1">
                              <Tag size={8} />{task.tag}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setTaskModal({ open: true, task })} className="p-1.5 text-[#4a4a4a] hover:text-[#ece9e3]"><Edit2 size={12} /></button>
                        <button onClick={() => { if (confirm('Delete card?')) window.api.sendCommand({ type: 'DELETE_TASK', id: task.id }) }} className="p-1.5 text-[#4a4a4a] hover:text-red-500"><Trash2 size={12} /></button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-3">
                      <div className="timer-mono text-lg text-[#ece9e3]">
                        {formatDuration(task.totalSeconds)}
                        {task.mode === 'countdown' && (
                          <span className="text-[#7a7a7a] text-xs ml-2">/ {formatDuration(task.targetSeconds || 0)}</span>
                        )}
                      </div>
                      <div className={`p-2 rounded-full pointer-events-none ${isActive ? 'bg-[#c9a84c] text-[#000]' : 'bg-[#111111] text-[#c9a84c]'}`}>
                        {isActive ? <Pause size={14} /> : <Play size={14} />}
                      </div>
                    </div>

                    <div className="border-t border-[#1a1a1a] pt-2" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setShowChecklistFor(showChecklistFor === task.id ? null : task.id)}
                        className="micro-caps text-[#7a7a7a] flex items-center gap-1 hover:text-[#ece9e3]"
                      >
                        <ListTodo size={10} /> Checklist ({task.checklist?.filter(c => c.done).length || 0}/{task.checklist?.length || 0})
                      </button>
                      {showChecklistFor === task.id && (
                        <div className="mt-2 space-y-1">
                          {task.checklist?.map(item => (
                            <div key={item.id} className="flex items-center gap-2 text-xs">
                              <input
                                type="checkbox"
                                checked={item.done}
                                onChange={() => window.api.sendCommand({ type: 'TOGGLE_CHECKLIST', taskId: task.id, itemId: item.id })}
                                className="accent-[#c9a84c]"
                              />
                              <span className={item.done ? 'text-[#4a4a4a] line-through' : 'text-[#ece9e3]'}>{item.text}</span>
                            </div>
                          ))}
                          <div className="flex gap-2 mt-2">
                            <input
                              value={newChecklistItem}
                              onChange={e => setNewChecklistItem(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') addChecklistItem(task.id) }}
                              placeholder="Add item..."
                              className="flex-1 px-2 py-1 bg-[#0a0a0a] border border-[#1a1a1a] rounded text-xs text-[#ece9e3] outline-none"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              <button
                onClick={() => setTaskModal({ open: true })}
                className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#2c2c2c] text-sm text-[#7a7a7a] hover:border-[#c9a84c] hover:text-[#c9a84c] transition-colors"
              >
                <Plus size={20} />
                <span className="micro-caps">Add Card</span>
              </button>
            </div>
          </>
        ) : (
          <div className="text-center text-[#4a4a4a] micro-caps mt-10">Create a deck to begin.</div>
        )}
      </div>

      {selected.size > 0 && (
        <div className="absolute bottom-4 left-4 right-4 bg-[#0a0a0a] border border-[#c9a84c] rounded-xl p-3 flex items-center justify-between shadow-2xl z-40 fade-in">
          <span className="micro-caps text-[#c9a84c]">{selected.size} selected</span>
          <div className="flex gap-2">
            <button onClick={startGroup} className="px-4 py-1.5 bg-[#c9a84c] text-[#000] rounded-lg micro-caps font-medium flex items-center gap-1.5">
              <Play size={12} /> Start Group
            </button>
            <button onClick={() => { setSelected(new Set()); setSelectMode(false); }} className="px-3 py-1.5 border border-[#1a1a1a] rounded-lg micro-caps text-[#7a7a7a] hover:text-[#ece9e3]">
              Clear
            </button>
          </div>
        </div>
      )}

      {deckModal.open && (
        <DeckModal
          deck={deckModal.deck}
          onClose={() => setDeckModal({ open: false })}
          onSave={(name) => {
            if (!deckModal.deck) {
              window.api.sendCommand({ type: 'ADD_DECK', name, color: DECK_COLORS[Math.floor(Math.random() * DECK_COLORS.length)] })
            }
            setDeckModal({ open: false })
          }}
        />
      )}

      {taskModal.open && activeDeck && (
        <TaskModal
          task={taskModal.task}
          deckId={activeDeck.id}
          onClose={() => setTaskModal({ open: false })}
          onSave={(name, tag, mode, targetSeconds) => {
            if (!taskModal.task) {
              window.api.sendCommand({ type: 'ADD_TASK', deckId: activeDeck.id, name, tag, mode, targetSeconds })
            }
            setTaskModal({ open: false })
          }}
        />
      )}
    </div>
  )
}

function DeckModal({ deck, onClose, onSave }: { deck?: Deck, onClose: () => void, onSave: (name: string) => void }) {
  const [name, setName] = useState(deck?.name || '')
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-[#050505] border border-[#1a1a1a] rounded-xl w-full max-w-sm p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <span className="micro-caps text-[#ece9e3]">{deck ? 'Edit Deck' : 'New Deck'}</span>
          <button onClick={onClose} className="text-[#7a7a7a] hover:text-[#ece9e3]"><X size={16} /></button>
        </div>
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && name.trim() && onSave(name.trim())}
          placeholder="Deck name..."
          className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg outline-none focus:border-[#c9a84c] text-[#ece9e3] mb-4"
        />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 micro-caps text-[#7a7a7a] hover:text-[#ece9e3]">Cancel</button>
          <button onClick={() => name.trim() && onSave(name.trim())} className="px-4 py-2 bg-[#c9a84c] text-[#000] rounded-lg micro-caps font-medium">Save</button>
        </div>
      </div>
    </div>
  )
}

function TaskModal({ task, deckId, onClose, onSave }: { task?: Task, deckId: string, onClose: () => void, onSave: (name: string, tag: string, mode: TimerMode, targetSeconds?: number) => void }) {
  const [name, setName] = useState(task?.name || '')
  const [tag, setTag] = useState(task?.tag || '')
  const [mode, setMode] = useState<TimerMode>(task?.mode || 'stopwatch')
  const [mins, setMins] = useState(task?.targetSeconds ? String(Math.round(task.targetSeconds / 60)) : '25')

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-[#050505] border border-[#1a1a1a] rounded-xl w-full max-w-sm p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <span className="micro-caps text-[#ece9e3]">{task ? 'Edit Card' : 'New Card'}</span>
          <button onClick={onClose} className="text-[#7a7a7a] hover:text-[#ece9e3]"><X size={16} /></button>
        </div>
        <div className="space-y-3">
          <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Card name..." className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg outline-none focus:border-[#c9a84c] text-[#ece9e3]" />
          <input value={tag} onChange={e => setTag(e.target.value)} placeholder="Tag (optional)..." className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg outline-none focus:border-[#c9a84c] text-[#ece9e3]" />
          <div className="flex gap-2">
            <button onClick={() => setMode('stopwatch')} className={`flex-1 py-2 micro-caps rounded-lg border ${mode === 'stopwatch' ? 'border-[#c9a84c] text-[#c9a84c]' : 'border-[#1a1a1a] text-[#7a7a7a]'}`}>Stopwatch</button>
            <button onClick={() => setMode('countdown')} className={`flex-1 py-2 micro-caps rounded-lg border ${mode === 'countdown' ? 'border-[#c9a84c] text-[#c9a84c]' : 'border-[#1a1a1a] text-[#7a7a7a]'}`}>Countdown</button>
          </div>
          {mode === 'countdown' && (
            <div className="flex items-center gap-2">
              <input type="number" value={mins} onChange={e => setMins(e.target.value)} className="w-20 px-3 py-2 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg outline-none focus:border-[#c9a84c] text-[#ece9e3]" />
              <span className="micro-caps text-[#7a7a7a]">minutes</span>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 micro-caps text-[#7a7a7a] hover:text-[#ece9e3]">Cancel</button>
          <button onClick={() => name.trim() && onSave(name.trim(), tag.trim(), mode, mode === 'countdown' ? parseInt(mins) * 60 : undefined)} className="px-4 py-2 bg-[#c9a84c] text-[#000] rounded-lg micro-caps font-medium">Save</button>
        </div>
      </div>
    </div>
  )
}
