import { describe, expect, it } from 'vitest'
import { completion, emptyState, isRouteState, rollTomorrowForward, type RouteItem } from './model'
import { parseBackup, serializeBackup } from './storage'

const item = (overrides: Partial<RouteItem> = {}): RouteItem => ({
  id: '1', title: '事项', lane: 'work', horizon: 'today', done: false, createdAt: '2026-08-12T00:00:00.000Z', ...overrides,
})

describe('route model', () => {
  it('只计算今日事项的完成率', () => {
    expect(completion([item({ done: true }), item({ id: '2' }), item({ id: '3', horizon: 'later', done: true })]))
      .toEqual({ done: 1, total: 2, percent: 50 })
  })

  it('把未完成的明日事项滚动到今天', () => {
    const result = rollTomorrowForward([item({ horizon: 'tomorrow' }), item({ id: '2', horizon: 'tomorrow', done: true })])
    expect(result[0].horizon).toBe('today')
    expect(result[1].horizon).toBe('tomorrow')
  })

  it('备份可以往返且拒绝错误格式', () => {
    const state = emptyState()
    expect(parseBackup(serializeBackup(state))).toEqual(state)
    expect(parseBackup('{"wrong":true}')).toBeNull()
    expect(isRouteState({ version: 2, items: [], notes: {} })).toBe(false)
  })
})
