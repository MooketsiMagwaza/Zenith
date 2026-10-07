export const generateId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const formatTime = (totalSeconds: number) => {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => n.toString().padStart(2, "0")).join(":");
};

export const formatDuration = (totalSeconds: number) => {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h === 0 && m === 0) return `${s}s`;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const formatDate = (ts: number) => {
  const d = new Date(ts);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

export const dateKey = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

export const isToday = (ts: number) => dateKey(ts) === dateKey(Date.now());
export const isYesterday = (ts: number) => {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return dateKey(ts) === dateKey(y.getTime());
};

export const friendlyDateLabel = (ts: number) => {
  if (isToday(ts)) return `Today · ${formatDate(ts)}`;
  if (isYesterday(ts)) return `Yesterday · ${formatDate(ts)}`;
  return formatDate(ts);
};

export const formatTimeShort = (ts: number) => {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};
