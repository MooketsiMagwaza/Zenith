import { useEffect, useState } from 'react'
import { AgentState } from '../shared/types'
import { formatDuration } from '../shared/utils'
import { X } from 'lucide-react'

type Props = { state: AgentState; onClose: () => void }

export default function FocusView({ state, onClose }: Props) {
  const [elapsed, setElapsed] = useState(0)
  const isActive = !!state.active?.startedAt

  useEffect(() => {
    if (!isActive) return
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - state.active!.startedAt!) / 1000)), 500)
    return () => clearInterval(id)
  }, [isActive, state.active?.startedAt])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!state.active?.startedAt) {
    return (
      <div className="absolute inset-0 bg-[#000000] z-50 flex flex-col items-center justify-center">
        <button onClick={onClose} className="absolute top-4 right-4 text-[#7a7a7a] hover:text-[#ece9e3]"><X size={24} /></button>
        <div className="text-center">
          <div className="micro-caps text-[#c9a84c] mb-4">FOCUS MODE</div>
          <div className="text-[#7a7a7a] font-light">Start a session first</div>
        </div>
      </div>
    )
  }

  const taskName = state.active?.taskIds[0] ? state.tasks.find(t => t.id === state.active!.taskIds[0])?.name : 'Focus Session'

  return (
    <div className="absolute inset-0 bg-[#000000] z-50 flex flex-col items-center justify-center">
      <button onClick={onClose} className="absolute top-4 right-4 text-[#7a7a7a] hover:text-[#ece9e3]"><X size={24} /></button>
      <div className="text-center">
        <div className="micro-caps text-[#c9a84c] mb-4">FOCUS MODE</div>
        <div className="text-6xl timer-mono text-[#ece9e3] mb-2">{formatDuration(elapsed)}</div>
        <div className="text-xl font-light text-[#7a7a7a]">{taskName}</div>
      </div>
      <div className="absolute bottom-8 micro-caps text-[#4a4a4a]">Press ESC to exit</div>
    </div>
  )
}
