export type Lane = 'work' | 'followup' | 'life'
export type Horizon = 'today' | 'tomorrow' | 'later'

export interface RouteItem {
  id: string
  title: string
  lane: Lane
  horizon: Horizon
  done: boolean
  createdAt: string
  completedAt?: string
}

export interface DailyNote {
  day: string
  energy: number
  win: string
  carry: string
}

export interface RouteState {
  version: 1
  items: RouteItem[]
  notes: Record<string, DailyNote>
}

export const emptyState = (): RouteState => ({ version: 1, items: [], notes: {} })

export function todayKey(now = new Date()): string {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function completion(items: RouteItem[]): { done: number; total: number; percent: number } {
  const today = items.filter((item) => item.horizon === 'today')
  const done = today.filter((item) => item.done).length
  return { done, total: today.length, percent: today.length ? Math.round((done / today.length) * 100) : 0 }
}

export function rollTomorrowForward(items: RouteItem[]): RouteItem[] {
  return items.map((item) => item.horizon === 'tomorrow' && !item.done ? { ...item, horizon: 'today' } : item)
}

export function createItem(title: string, lane: Lane, horizon: Horizon, now = new Date()): RouteItem {
  return {
    id: crypto.randomUUID(),
    title: title.trim(),
    lane,
    horizon,
    done: false,
    createdAt: now.toISOString(),
  }
}

export function isRouteState(value: unknown): value is RouteState {
  if (!value || typeof value !== 'object') return false
  const state = value as Partial<RouteState>
  return state.version === 1 && Array.isArray(state.items) && !!state.notes && typeof state.notes === 'object'
}
