import { emptyState, isRouteState, type RouteState } from './model'

const STORAGE_KEY = 'today-route-state-v1'

export function loadState(storage: Storage = localStorage): RouteState {
  const raw = storage.getItem(STORAGE_KEY)
  if (!raw) return emptyState()
  try {
    const parsed: unknown = JSON.parse(raw)
    return isRouteState(parsed) ? parsed : emptyState()
  } catch {
    return emptyState()
  }
}

export function saveState(state: RouteState, storage: Storage = localStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function serializeBackup(state: RouteState): string {
  return JSON.stringify({ exportedAt: new Date().toISOString(), app: '今日航线', data: state }, null, 2)
}

export function parseBackup(raw: string): RouteState | null {
  try {
    const parsed = JSON.parse(raw) as { data?: unknown }
    return isRouteState(parsed.data) ? parsed.data : null
  } catch {
    return null
  }
}
