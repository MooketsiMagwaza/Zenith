import { useState, useEffect, useRef, useMemo } from 'react'
import Fuse from 'fuse.js'
import { AgentState } from '../shared/types'
import { View } from '../App'
import { Search, X, Play, Tag } from 'lucide-react'

type Props = { state: AgentState; setView: (v: View) => void }

export default function SearchView({ state, setView }: Props) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  
  useEffect(() => { inputRef.current?.focus() }, [])

  const items = useMemo(() => state.tasks.map(t => {
    const deck = state.decks.find(d => d.id === t.deckId)
    return { 
      id: t.id, 
      name: t.name, 
      deck: deck?.name || 'Unknown',
      deckColor: deck?.color || '#7a7a7a',
      tag: t.tag 
    }
  }), [state.tasks, state.decks])

  const fuse = useMemo(() => new Fuse(items, { keys: ['name', 'deck', 'tag'], threshold: 0.3 }), [items])
  const results = query ? fuse.search(query).map(r => r.item) : items

  const grouped = useMemo(() => {
    const map = new Map<string, { deck: string, deckColor: string, tasks: typeof items }>()
    results.forEach(item => {
      if (!map.has(item.deck)) {
        map.set(item.deck, { deck: item.deck, deckColor: item.deckColor, tasks: [] })
      }
      map.get(item.deck)!.tasks.push(item)
    })
    return Array.from(map.values())
  }, [results])

  return (
    <div className="h-full flex flex-col bg-[#050505]">
      {/* Search Header */}
      <div className="p-4 border-b border-[#1a1a1a] shrink-0 bg-[#060606]">
        <div className="flex items-center gap-3 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg px-3 py-2.5 focus-within:border-[#c9a84c] transition-colors">
          <Search size={16} className="text-[#7a7a7a] shrink-0" />
          <input 
            ref={inputRef} 
            value={query} 
            onChange={e => setQuery(e.target.value)} 
            placeholder="Search cards, tags, or decks..." 
            className="flex-1 bg-transparent outline-none text-[#ece9e3] text-sm placeholder:text-[#4a4a4a]" 
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-[#4a4a4a] hover:text-[#ece9e3] transition-colors">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4">
        {results.length === 0 && query && (
          <div className="text-center py-20 text-[#4a4a4a] micro-caps">
            No results for "{query}"
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-6">
            {!query && (
              <div className="text-center py-2 text-[#4a4a4a] micro-caps">
                {results.length} total cards
              </div>
            )}
            
            {grouped.map(group => (
              <div key={group.deck}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className="w-2 h-2 rounded-full" style={{ background: group.deckColor }} />
                  <span className="micro-caps text-[#7a7a7a] tracking-wider">{group.deck}</span>
                </div>
                <div className="space-y-1">
                  {group.tasks.map(task => (
                    <button 
                      key={task.id} 
                      onClick={() => { window.api.sendCommand({ type: 'START_SESSION', taskIds: [task.id] }); setView('decks') }} 
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#0a0a0a] border border-transparent hover:border-[#1a1a1a] text-left transition-all group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-[#ece9e3] truncate flex items-center gap-2 group-hover:text-[#c9a84c] transition-colors">
                          {task.name}
                        </div>
                        {task.tag && (
                          <div className="micro-caps text-[10px] text-[#4a4a4a] mt-0.5 flex items-center gap-1">
                            <Tag size={8} /> {task.tag}
                          </div>
                        )}
                      </div>
                      <Play size={14} className="text-[#2c2c2c] group-hover:text-[#c9a84c] transition-colors shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
