import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { AgentState } from '../shared/types'
import { View } from '../App'
import { ChevronDown, Search, X } from 'lucide-react'

type Props = { state: AgentState; setView: (v: View) => void }

export default function JournalView({ state }: Props) {
  const [targetKey, setTargetKey] = useState<string>('')
  const [content, setContent] = useState('')
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [saving, setSaving] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const currentJournal = targetKey ? state.journals.find(j => {
    const [type, id] = targetKey.split(':')
    return type === 'task' ? j.taskId === id : j.deckId === id
  }) : null

  const currentTarget = targetKey ? (() => {
    const [type, id] = targetKey.split(':')
    if (type === 'deck') {
      const d = state.decks.find(d => d.id === id)
      return { name: d?.name, color: d?.color, type: 'deck' as const }
    } else {
      const t = state.tasks.find(t => t.id === id)
      const d = state.decks.find(d => d.id === t?.deckId)
      return { name: t?.name, color: d?.color, type: 'task' as const }
    }
  })() : null

  // Load content when target changes
  useEffect(() => {
    if (targetKey) {
      setContent(currentJournal?.content || '')
      setMode(currentJournal?.content ? 'preview' : 'edit')
    }
  }, [targetKey])

  // Auto-save logic
  useEffect(() => {
    if (!targetKey) return
    
    // Don't trigger save if content matches what's already in the store
    const currentContent = currentJournal?.content || ''
    if (content === currentContent) {
      setSaving(false)
      return
    }

    setSaving(true)
    
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    
    saveTimerRef.current = setTimeout(() => {
      const [targetType, targetId] = targetKey.split(':') as ['task' | 'deck', string]
      window.api.sendCommand({ type: 'UPSERT_JOURNAL', content: content.trim(), targetId, targetType })
      setSaving(false)
    }, 1000) // 1 second debounce

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [content, targetKey, currentJournal])

  // Immediate save on unmount or target switch to prevent data loss
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      if (targetKey && content !== (currentJournal?.content || '')) {
        const [targetType, targetId] = targetKey.split(':') as ['task' | 'deck', string]
        window.api.sendCommand({ type: 'UPSERT_JOURNAL', content: content.trim(), targetId, targetType })
      }
    }
  }, [targetKey, content, currentJournal])

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0

  return (
    <div className="h-full flex flex-col overflow-hidden relative bg-[#050505]">
      {/* Editor Header */}
      <div className="p-3 border-b border-[#1a1a1a] flex items-center justify-between shrink-0 bg-[#060606]/80 backdrop-blur z-10">
        <button 
          onClick={() => setShowPicker(true)} 
          className="flex items-center gap-2 min-w-0 hover:opacity-80 transition-opacity"
        >
          <span className="w-2.5 h-2.5 rounded-full shrink-0 border border-[#1a1a1a]" style={{ background: currentTarget?.color || '#2c2c2c' }} />
          <span className="text-sm text-[#ece9e3] font-medium truncate max-w-[160px]">
            {currentTarget?.name || 'Select Target'}
          </span>
          <ChevronDown size={14} className="text-[#7a7a7a] shrink-0" />
        </button>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-0.5">
            <button 
              onClick={() => setMode('edit')} 
              className={`px-2.5 py-1 rounded-md micro-caps text-[10px] transition-colors ${mode === 'edit' ? 'bg-[#111111] text-[#ece9e3]' : 'text-[#7a7a7a]'}`}
            >
              Edit
            </button>
            <button 
              onClick={() => setMode('preview')} 
              className={`px-2.5 py-1 rounded-md micro-caps text-[10px] transition-colors ${mode === 'preview' ? 'bg-[#111111] text-[#ece9e3]' : 'text-[#7a7a7a]'}`}
            >
              Preview
            </button>
          </div>
        </div>
      </div>

      {/* Main Editor Area */}
      <main className="flex-1 overflow-y-auto">
        {targetKey ? (
          <div className="h-full p-5 markdown-body">
            {mode === 'preview' ? (
              content.trim() ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
              ) : (
                <div className="text-[#4a4a4a] italic text-sm">Nothing to preview yet. Switch to Edit to start writing.</div>
              )
            ) : (
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                className="w-full h-full bg-transparent outline-none text-[#ece9e3] resize-none leading-relaxed font-light text-sm placeholder:text-[#4a4a4a]"
                autoFocus
                placeholder="Write in markdown... (e.g. # Heading, **bold**, - lists)"
              />
            )}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center px-6">
            <div className="w-12 h-12 rounded-full bg-[#0a0a0a] border border-[#1a1a1a] flex items-center justify-center mb-4">
              <Search size={20} className="text-[#4a4a4a]" />
            </div>
            <div className="text-[#ece9e3] font-medium mb-1">No Target Selected</div>
            <div className="text-[#7a7a7a] text-sm mb-4 max-w-[240px]">
              Select a deck or card to start writing your journal entry.
            </div>
            <button 
              onClick={() => setShowPicker(true)}
              className="px-4 py-2 bg-[#c9a84c] text-[#000] rounded-lg micro-caps font-semibold hover:bg-[#d4b55d] transition-colors"
            >
              Choose Target
            </button>
          </div>
        )}
      </main>

      {/* Footer Status Bar */}
      {targetKey && (
        <div className="px-4 py-2 border-t border-[#1a1a1a] flex items-center justify-between text-[10px] micro-caps text-[#4a4a4a] bg-[#060606] shrink-0">
          <span>{wordCount} words</span>
          <span className={`transition-colors ${saving ? 'text-[#c9a84c]' : 'text-[#4a4a4a]'}`}>
            {saving ? 'Saving...' : 'Saved'}
          </span>
        </div>
      )}

      {/* Target Picker Modal */}
      {showPicker && (
        <div className="absolute inset-0 z-50 bg-black/80 flex flex-col fade-in" onClick={() => setShowPicker(false)}>
          <div className="p-3 border-b border-[#1a1a1a] flex items-center gap-2 bg-[#050505]" onClick={e => e.stopPropagation()}>
            <Search size={16} className="text-[#7a7a7a] shrink-0" />
            <input 
              autoFocus 
              placeholder="Search decks and cards..." 
              className="flex-1 bg-transparent outline-none text-[#ece9e3] text-sm placeholder:text-[#4a4a4a]" 
            />
            <button onClick={() => setShowPicker(false)} className="text-[#7a7a7a] hover:text-[#ece9e3] p-1"><X size={16} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-4 bg-[#050505]" onClick={e => e.stopPropagation()}>
            {state.decks.map(deck => (
              <div key={deck.id}>
                <button 
                  onClick={() => { setTargetKey(`deck:${deck.id}`); setShowPicker(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors border ${
                    targetKey === `deck:${deck.id}` 
                      ? 'bg-[#c9a84c]/10 border-[#c9a84c]/30 text-[#c9a84c]' 
                      : 'border-transparent text-[#ece9e3] hover:bg-[#0a0a0a]'
                  }`}
                >
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: deck.color }} />
                  <span className="truncate">{deck.name}</span>
                  <span className="ml-auto micro-caps text-[9px] text-[#7a7a7a] tracking-wider">DECK</span>
                </button>
                
                {state.tasks.filter(t => t.deckId === deck.id).length > 0 && (
                  <div className="ml-4 mt-1 space-y-1 border-l border-[#1a1a1a] pl-3">
                    {state.tasks.filter(t => t.deckId === deck.id).map(task => (
                      <button
                        key={task.id}
                        onClick={() => { setTargetKey(`task:${task.id}`); setShowPicker(false); }}
                        className={`w-full text-left px-3 py-2 rounded-md text-xs transition-colors flex items-center justify-between ${
                          targetKey === `task:${task.id}` 
                            ? 'bg-[#c9a84c]/10 text-[#c9a84c]' 
                            : 'text-[#7a7a7a] hover:bg-[#0a0a0a] hover:text-[#ece9e3]'
                        }`}
                      >
                        <span className="truncate">{task.name}</span>
                        {task.tag && <span className="micro-caps text-[8px] text-[#4a4a4a] ml-2 shrink-0">{task.tag}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
