import { useEffect, useState, useRef } from 'react'
import { AgentState, Task } from '../shared/types'
import { QUOTE_PACKS, WALLPAPERS } from '@shared/constants'
import { getGreeting, getZenKanji, formatDuration } from '@shared/utils'
import { X, ChevronLeft, ChevronRight, Settings, Upload, Link2, Image, Palette, BookOpen } from 'lucide-react'

type Props = { state: AgentState; onClose: () => void }

export default function ZenView({ state, onClose }: Props) {
  const [quoteIdx, setQuoteIdx] = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const [settingsTab, setSettingsTab] = useState<'wallpapers' | 'quotes'>('wallpapers')
  const [customWallUrl, setCustomWallUrl] = useState('')
  const [customQuote, setCustomQuote] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const greeting = getGreeting()
  const kanji = getZenKanji(greeting)
  const quotes = QUOTE_PACKS[state.zenPack] || QUOTE_PACKS.musashi
  const wallpaper = state.zenWallpaper

  // Active session tracking
  const [elapsed, setElapsed] = useState(0)
  const isActive = !!state.active?.startedAt

  useEffect(() => {
    if (!isActive) { setElapsed(0); return }
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - state.active!.startedAt!) / 1000)), 500)
    return () => clearInterval(id)
  }, [isActive, state.active?.startedAt])

  const activeTasks = state.active?.taskIds.map(id => state.tasks.find(t => t.id === id)).filter(Boolean) as Task[] || []
  const isGroup = activeTasks.length > 1
  const activeLabel = activeTasks.length === 1 ? activeTasks[0].name : isGroup ? `${activeTasks[0].name} +${activeTasks.length - 1}` : ''

  useEffect(() => {
    if (state.zenInterval <= 0) return
    const id = setInterval(() => setQuoteIdx(i => (i + 1) % quotes.length), state.zenInterval * 1000)
    return () => clearInterval(id)
  }, [state.zenInterval, quotes.length])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showSettings) setShowSettings(false)
        else onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, showSettings])

  const setPref = (pack: string, interval: number, wall: string) =>
    window.api.sendCommand({ type: 'SET_ZEN_PREFS', pack, interval, wallpaper: wall })

  const addCustomWallUrl = () => {
    if (!customWallUrl.trim()) return
    setPref(state.zenPack, state.zenInterval, customWallUrl.trim())
    setCustomWallUrl('')
  }

  const handleWallpaperUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string
      if (base64) setPref(state.zenPack, state.zenInterval, base64)
    }
    reader.readAsDataURL(file)
  }

  const addCustomQuote = () => {
    if (!customQuote.trim()) return
    setCustomQuote('')
  }

  const wallpaperCategories = [
    { id: 'pastel', name: 'Pastel', colors: WALLPAPERS.pastel },
    { id: 'gradient', name: 'Gradient', gradients: WALLPAPERS.gradient },
    { id: 'curated', name: 'Curated', urls: WALLPAPERS.curated },
    { id: 'unsplash', name: 'Unsplash', urls: [
      'url(https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80)',
      'url(https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&q=80)',
      'url(https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=80)',
      'url(https://images.unsplash.com/photo-1476820865390-c52aeebb9891?w=1920&q=80)'
    ]},
  ]

  return (
    <div
      className="absolute inset-0 flex flex-col pointer-events-auto overflow-hidden"
      style={{
        background: wallpaper,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        zIndex: 70,
      }}
    >
      <div className="absolute inset-0 bg-black/40 pointer-events-none" style={{ zIndex: 0 }} />

      <div className="relative flex justify-between items-center w-full p-4 shrink-0" style={{ zIndex: 10 }}>
        <button
          onClick={onClose}
          className="text-[#ece9e3]/80 hover:text-[#ece9e3] transition-colors p-2 rounded hover:bg-black/20"
        >
          <X size={20} />
        </button>
        <button
          onClick={() => setShowSettings(true)}
          className="micro-caps text-[#ece9e3]/80 hover:text-[#ece9e3] px-3 py-1.5 rounded bg-black/30 hover:bg-black/50 transition-colors flex items-center gap-1.5"
        >
          <Settings size={14} /> Settings
        </button>
      </div>

      <div
        className="relative flex-1 flex flex-col items-center justify-center text-center px-6 w-full"
        style={{ zIndex: 10 }}
      >
        <div
          className="text-7xl font-light text-[#ece9e3]/90 mb-4 transition-all duration-500"
          style={{ fontFamily: 'serif' }}
        >
          {kanji}
        </div>
        <div className="text-2xl font-light italic text-[#ece9e3] mb-6 capitalize">
          {greeting}
        </div>
        <div
          key={quoteIdx}
          className="text-lg text-[#ece9e3]/85 italic max-w-xl leading-relaxed animate-[quoteFade_0.6s_ease-out]"
        >
          {quotes[quoteIdx]}
        </div>
      </div>

      <div
        className="relative flex justify-center gap-6 items-center w-full p-4 pb-8 shrink-0"
        style={{ zIndex: 10 }}
      >
        <button
          onClick={() => setQuoteIdx(i => (i - 1 + quotes.length) % quotes.length)}
          className="p-2 text-[#ece9e3]/70 hover:text-[#ece9e3] hover:bg-black/20 rounded-full transition-all"
          aria-label="Previous quote"
        >
          <ChevronLeft size={24} />
        </button>
        <div className="micro-caps text-[#ece9e3]/60 flex items-center gap-2 text-sm">
          <span>{quoteIdx + 1}</span>
          <span>/</span>
          <span>{quotes.length}</span>
        </div>
        <button
          onClick={() => setQuoteIdx(i => (i + 1) % quotes.length)}
          className="p-2 text-[#ece9e3]/70 hover:text-[#ece9e3] hover:bg-black/20 rounded-full transition-all"
          aria-label="Next quote"
        >
          <ChevronRight size={24} />
        </button>
      </div>

      {isActive && (
        <div className="absolute bottom-16 left-0 right-0 flex flex-col items-center gap-2 pointer-events-none" style={{ zIndex: 10 }}>
          <div className="micro-caps text-[#ece9e3]/50 tracking-widest">{activeLabel}</div>
          <div className="timer-mono text-3xl text-[#ece9e3]/70">{formatDuration(elapsed)}</div>
          {isGroup && (
            <div className="flex gap-3 mt-1">
              {activeTasks.map(t => (
                <span key={t.id} className="micro-caps text-[10px] text-[#ece9e3]/40">{t.name}</span>
              ))}
            </div>
          )}
        </div>
      )}

      <div
        className="absolute bottom-4 left-0 right-0 text-center micro-caps text-[#ece9e3]/30 text-xs pointer-events-none"
        style={{ zIndex: 10 }}
      >
        Press ESC to exit
      </div>

      {showSettings && (
        <div
          className="absolute inset-0 flex items-center justify-center p-6 pointer-events-auto"
          style={{ zIndex: 100, background: 'rgba(0,0,0,0.75)' }}
          onClick={(e) => e.target === e.currentTarget && setShowSettings(false)}
        >
          <div
            className="bg-[#0a0a0a] border border-[#222] rounded-2xl w-full max-w-sm shadow-2xl flex flex-col"
            style={{ maxHeight: '80vh' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a] shrink-0">
              <span className="micro-caps text-[#ece9e3] tracking-widest text-sm">Zen Preferences</span>
              <button
                onClick={() => setShowSettings(false)}
                className="text-[#555] hover:text-[#ece9e3] transition-colors p-1 rounded hover:bg-white/5"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex border-b border-[#1a1a1a] shrink-0">
              <button
                onClick={() => setSettingsTab('wallpapers')}
                className={`flex-1 py-3 micro-caps text-xs transition-colors flex items-center justify-center gap-1.5 ${
                  settingsTab === 'wallpapers'
                    ? 'text-[#c9a84c] border-b-2 border-[#c9a84c]'
                    : 'text-[#555] hover:text-[#ece9e3]'
                }`}
              >
                <Image size={13} /> Wallpapers
              </button>
              <button
                onClick={() => setSettingsTab('quotes')}
                className={`flex-1 py-3 micro-caps text-xs transition-colors flex items-center justify-center gap-1.5 ${
                  settingsTab === 'quotes'
                    ? 'text-[#c9a84c] border-b-2 border-[#c9a84c]'
                    : 'text-[#555] hover:text-[#ece9e3]'
                }`}
              >
                <BookOpen size={13} /> Quotes
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-5">
              {settingsTab === 'wallpapers' ? (
                <>
                  <div>
                    <div className="micro-caps text-[#555] text-xs mb-2">Current</div>
                    <div
                      className="h-16 rounded-lg border border-[#1a1a1a]"
                      style={{ background: wallpaper, backgroundSize: 'cover', backgroundPosition: 'center' }}
                    />
                  </div>

                  {wallpaperCategories.map(cat => (
                    <div key={cat.id}>
                      <div className="micro-caps text-[#555] text-xs mb-2 flex items-center gap-1.5">
                        <Palette size={11} /> {cat.name}
                      </div>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {cat.colors?.map((color, i) => (
                          <button
                            key={i}
                            onClick={() => setPref(state.zenPack, state.zenInterval, color)}
                            className={`w-9 h-9 rounded-lg border-2 transition-all shrink-0 ${
                              wallpaper === color ? 'border-[#c9a84c] scale-105' : 'border-transparent hover:scale-105'
                            }`}
                            style={{ background: color }}
                          />
                        ))}
                        {cat.gradients?.map((grad, i) => (
                          <button
                            key={i}
                            onClick={() => setPref(state.zenPack, state.zenInterval, grad)}
                            className={`w-9 h-9 rounded-lg border-2 transition-all shrink-0 ${
                              wallpaper === grad ? 'border-[#c9a84c] scale-105' : 'border-transparent hover:scale-105'
                            }`}
                            style={{ background: grad }}
                          />
                        ))}
                        {cat.urls?.map((url, i) => {
                          const bgUrl = url.replace('url(', '').replace(')', '').replace(/['"]/g, '')
                          return (
                            <button
                              key={i}
                              onClick={() => setPref(state.zenPack, state.zenInterval, url)}
                              className={`w-9 h-9 rounded-lg border-2 overflow-hidden transition-all shrink-0 ${
                                wallpaper === url ? 'border-[#c9a84c] scale-105' : 'border-transparent hover:scale-105'
                              }`}
                              style={{ backgroundImage: `url(${bgUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                            />
                          )
                        })}
                      </div>
                    </div>
                  ))}

                  <div className="pt-2 border-t border-[#1a1a1a]">
                    <div className="micro-caps text-[#555] text-xs mb-2 flex items-center gap-1.5">
                      <Link2 size={11} /> Custom URL
                    </div>
                    <input
                      value={customWallUrl}
                      onChange={e => setCustomWallUrl(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addCustomWallUrl()}
                      placeholder="https://example.com/image.jpg"
                      className="w-full px-3 py-2 bg-[#111] border border-[#222] rounded-lg outline-none focus:border-[#c9a84c] text-[#ece9e3] text-sm mb-2"
                    />
                    <button
                      onClick={addCustomWallUrl}
                      className="w-full py-2 bg-[#c9a84c] text-black rounded-lg micro-caps text-xs font-semibold hover:bg-[#d4b05a] transition-colors"
                    >
                      Apply URL
                    </button>
                  </div>

                  <div>
                    <div className="micro-caps text-[#555] text-xs mb-2 flex items-center gap-1.5">
                      <Upload size={11} /> Upload Image
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleWallpaperUpload}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-2 border border-dashed border-[#2c2c2c] rounded-lg micro-caps text-xs text-[#555] hover:text-[#ece9e3] hover:border-[#c9a84c] transition-colors"
                    >
                      Choose image file…
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <div className="micro-caps text-[#555] text-xs mb-2">Quote Pack</div>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.keys(QUOTE_PACKS).map(pack => (
                        <button
                          key={pack}
                          onClick={() => setPref(pack, state.zenInterval, state.zenWallpaper)}
                          className={`px-3 py-2 rounded-lg border micro-caps text-xs text-left transition-all ${
                            state.zenPack === pack
                              ? 'border-[#c9a84c] bg-[#111] text-[#ece9e3]'
                              : 'border-[#1a1a1a] text-[#555] hover:border-[#2c2c2c] hover:text-[#ece9e3]'
                          }`}
                        >
                          {pack.charAt(0).toUpperCase() + pack.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="micro-caps text-[#555] text-xs mb-2">Auto-Rotate</div>
                    <div className="flex flex-wrap gap-2">
                      {[0, 10, 20, 30, 60].map(sec => (
                        <button
                          key={sec}
                          onClick={() => setPref(state.zenPack, sec, state.zenWallpaper)}
                          className={`flex-1 min-w-[40px] px-2 py-2 rounded-lg micro-caps text-xs transition-all ${
                            state.zenInterval === sec
                              ? 'bg-[#c9a84c] text-black font-semibold'
                              : 'bg-[#111] text-[#555] hover:text-[#ece9e3] border border-[#1a1a1a]'
                          }`}
                        >
                          {sec === 0 ? 'Off' : `${sec}s`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#1a1a1a]">
                    <div className="micro-caps text-[#555] text-xs mb-2">Add Custom Quote</div>
                    <textarea
                      value={customQuote}
                      onChange={e => setCustomQuote(e.target.value)}
                      placeholder="Enter your quote…"
                      className="w-full px-3 py-2 bg-[#111] border border-[#222] rounded-lg outline-none focus:border-[#c9a84c] text-[#ece9e3] text-sm resize-none h-20 mb-2"
                    />
                    <button
                      onClick={addCustomQuote}
                      className="w-full py-2 bg-[#c9a84c] text-black rounded-lg micro-caps text-xs font-semibold hover:bg-[#d4b05a] transition-colors"
                    >
                      Add Quote
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="px-5 py-4 border-t border-[#1a1a1a] shrink-0">
              <button
                onClick={() => setShowSettings(false)}
                className="w-full py-2 micro-caps text-xs text-[#555] hover:text-[#ece9e3] transition-colors border border-[#1a1a1a] rounded-lg hover:border-[#2c2c2c]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
