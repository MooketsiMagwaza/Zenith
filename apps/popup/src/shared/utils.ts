export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60
  return [h, m, s].map(n => n.toString().padStart(2, '0')).join(':')
}
export function isDueToday(ts: number): boolean {
  const now = new Date(), start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return ts >= start && ts < start + 86400000
}
export function dateKey(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`
}
export function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'still up'
  if (h < 12) return 'good morning'
  if (h < 18) return 'good afternoon'
  if (h < 22) return 'good evening'
  return 'late night'
}
export function getZenKanji(greeting: string): string {
  const map: Record<string, string> = { 'good morning':'朝', 'good afternoon':'昼', 'good evening':'夕', 'late night':'夜', 'still up':'夢' }
  return map[greeting] || '心'
}
