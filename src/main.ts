import './style.css'
import { completion, createItem, rollTomorrowForward, todayKey, type Horizon, type Lane, type RouteItem, type RouteState } from './model'
import { loadState, parseBackup, saveState, serializeBackup } from './storage'

const appElement = document.querySelector<HTMLDivElement>('#app')
if (!appElement) throw new Error('缺少应用容器')
const app: HTMLDivElement = appElement

let state: RouteState = loadState()
let activeHorizon: Horizon = 'today'
let toastTimer = 0

const laneMeta: Record<Lane, { label: string; hint: string }> = {
  work: { label: '推进工作', hint: '真正推动结果的一步' },
  followup: { label: '等待与跟进', hint: '需要别人回复或再次确认' },
  life: { label: '照顾生活', hint: '健康、家庭和自己的事' },
}

const horizonLabel: Record<Horizon, string> = { today: '今天', tomorrow: '明天', later: '以后' }

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char] ?? char)
}

function persist(): void {
  saveState(state)
  render()
}

function showToast(message: string): void {
  const toast = document.querySelector<HTMLElement>('[data-toast]')
  if (!toast) return
  toast.textContent = message
  toast.dataset.visible = 'true'
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => { toast.dataset.visible = 'false' }, 2600)
}

function renderItem(item: RouteItem): string {
  return `<li class="route-item ${item.done ? 'is-done' : ''}">
    <button class="check" data-action="toggle" data-id="${item.id}" aria-label="${item.done ? '恢复' : '完成'}：${escapeHtml(item.title)}">
      <span aria-hidden="true">${item.done ? '✓' : ''}</span>
    </button>
    <span class="item-title">${escapeHtml(item.title)}</span>
    <button class="item-menu" data-action="move" data-id="${item.id}" aria-label="移动${escapeHtml(item.title)}到下一个日期">${horizonLabel[item.horizon]} →</button>
    <button class="delete" data-action="delete" data-id="${item.id}" aria-label="删除${escapeHtml(item.title)}">×</button>
  </li>`
}

function render(): void {
  const progress = completion(state.items)
  const now = new Date()
  const dateLabel = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(now)
  const greeting = now.getHours() < 11 ? '早上好' : now.getHours() < 18 ? '下午好' : '晚上好'
  const today = todayKey(now)
  const note = state.notes[today] ?? { day: today, energy: 3, win: '', carry: '' }

  app.innerHTML = `<div class="ambient ambient-one"></div><div class="ambient ambient-two"></div>
    <header class="topbar">
      <a class="brand" href="#main" aria-label="今日航线首页"><span class="brand-mark">↗</span><span>今日航线</span></a>
      <div class="top-actions">
        <button class="quiet-button" data-action="backup">备份</button>
        <button class="quiet-button" data-action="import">导入</button>
        <input data-import-file type="file" accept="application/json" hidden />
      </div>
    </header>
    <main id="main">
      <section class="hero">
        <div>
          <p class="eyebrow">${dateLabel}</p>
          <h1>${greeting}。<br><span>今天走哪条航线？</span></h1>
          <p class="hero-copy">把必须完成、等人回复和生活中的事放在眼前。少装一点，多完成一点。</p>
        </div>
        <div class="progress-card" aria-label="今日完成 ${progress.percent}%">
          <div class="progress-ring" style="--progress:${progress.percent * 3.6}deg"><span>${progress.percent}<small>%</small></span></div>
          <div><strong>${progress.done} / ${progress.total}</strong><span>今日完成</span></div>
        </div>
      </section>

      <section class="capture-card" aria-labelledby="capture-title">
        <div class="capture-heading"><div><p class="eyebrow">快速收进来</p><h2 id="capture-title">下一件要记住什么？</h2></div><span class="shortcut">⌘ / Ctrl + K</span></div>
        <form data-capture-form>
          <label class="sr-only" for="new-item">事项内容</label>
          <input id="new-item" name="title" maxlength="100" autocomplete="off" placeholder="例如：回复印尼客户的质控问题" required />
          <label><span>归到</span><select name="lane"><option value="work">推进工作</option><option value="followup">等待与跟进</option><option value="life">照顾生活</option></select></label>
          <label><span>时间</span><select name="horizon"><option value="today">今天</option><option value="tomorrow">明天</option><option value="later">以后</option></select></label>
          <button class="primary-button" type="submit">加入航线</button>
        </form>
      </section>

      <nav class="horizon-tabs" aria-label="日期筛选">
        ${(['today', 'tomorrow', 'later'] as Horizon[]).map((key) => `<button data-horizon="${key}" aria-current="${activeHorizon === key ? 'page' : 'false'}">${horizonLabel[key]}<span>${state.items.filter((item) => item.horizon === key && !item.done).length}</span></button>`).join('')}
      </nav>

      <section class="lanes" aria-label="事项列表">
        ${(Object.keys(laneMeta) as Lane[]).map((lane) => {
          const items = state.items.filter((item) => item.lane === lane && item.horizon === activeHorizon)
          return `<article class="lane-card lane-${lane}">
            <div class="lane-head"><div><span class="lane-dot"></span><h2>${laneMeta[lane].label}</h2></div><span>${items.filter((item) => !item.done).length} 件</span></div>
            <p>${laneMeta[lane].hint}</p>
            <ul>${items.length ? items.map(renderItem).join('') : `<li class="empty-state"><span>这里还很安静</span><small>从上方加入一件事</small></li>`}</ul>
          </article>`
        }).join('')}
      </section>

      <section class="closing-card" aria-labelledby="closing-title">
        <div class="closing-intro"><p class="eyebrow">每日收尾</p><h2 id="closing-title">让今天有个落点</h2><p>内容只保存在当前设备。导出备份，才能安全带到另一台设备。</p></div>
        <form data-note-form>
          <fieldset><legend>今天的能量</legend><div class="energy-options">${[1,2,3,4,5].map((level) => `<label><input type="radio" name="energy" value="${level}" ${note.energy === level ? 'checked' : ''}><span>${level}</span></label>`).join('')}</div></fieldset>
          <label>今天值得记住的一件事<textarea name="win" rows="2" maxlength="240" placeholder="一个进展、判断或瞬间">${escapeHtml(note.win)}</textarea></label>
          <label>明天接着走<textarea name="carry" rows="2" maxlength="240" placeholder="只留最重要的一步">${escapeHtml(note.carry)}</textarea></label>
          <div class="closing-actions"><button class="secondary-button" type="submit">保存收尾</button><button class="text-button" type="button" data-action="roll">把明天未完成事项移到今天</button></div>
        </form>
      </section>
    </main>
    <footer><span>离线优先 · 数据留在设备</span><span>今日航线 v0.1</span></footer>
    <div class="toast" data-toast data-visible="false" role="status"></div>`
}

app.addEventListener('submit', (event) => {
  event.preventDefault()
  const form = event.target as HTMLFormElement
  if (form.matches('[data-capture-form]')) {
    const data = new FormData(form)
    const title = String(data.get('title') ?? '').trim()
    if (!title) return
    state.items.unshift(createItem(title, data.get('lane') as Lane, data.get('horizon') as Horizon))
    persist()
    showToast('已加入航线')
    document.querySelector<HTMLInputElement>('#new-item')?.focus()
  }
  if (form.matches('[data-note-form]')) {
    const data = new FormData(form)
    const day = todayKey()
    state.notes[day] = { day, energy: Number(data.get('energy') ?? 3), win: String(data.get('win') ?? ''), carry: String(data.get('carry') ?? '') }
    persist()
    showToast('今天的收尾已保存')
  }
})

app.addEventListener('click', (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>('button')
  if (!target) return
  const horizon = target.dataset.horizon as Horizon | undefined
  if (horizon) { activeHorizon = horizon; render(); return }
  const action = target.dataset.action
  const id = target.dataset.id
  if (action === 'toggle' && id) {
    state.items = state.items.map((item) => item.id === id ? { ...item, done: !item.done, completedAt: !item.done ? new Date().toISOString() : undefined } : item)
    persist()
  }
  if (action === 'delete' && id) { state.items = state.items.filter((item) => item.id !== id); persist() }
  if (action === 'move' && id) {
    const next: Record<Horizon, Horizon> = { today: 'tomorrow', tomorrow: 'later', later: 'today' }
    state.items = state.items.map((item) => item.id === id ? { ...item, horizon: next[item.horizon] } : item)
    persist()
  }
  if (action === 'roll') { state.items = rollTomorrowForward(state.items); activeHorizon = 'today'; persist(); showToast('明天未完成事项已移到今天') }
  if (action === 'backup') {
    const blob = new Blob([serializeBackup(state)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `今日航线-备份-${todayKey()}.json`
    link.click()
    URL.revokeObjectURL(url)
    showToast('备份已下载')
  }
  if (action === 'import') document.querySelector<HTMLInputElement>('[data-import-file]')?.click()
})

app.addEventListener('change', async (event) => {
  const input = event.target as HTMLInputElement
  if (!input.matches('[data-import-file]') || !input.files?.[0]) return
  const imported = parseBackup(await input.files[0].text())
  if (!imported) { showToast('无法识别这个备份文件'); input.value = ''; return }
  state = imported
  persist()
  showToast('备份导入成功')
  input.value = ''
})

document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    document.querySelector<HTMLInputElement>('#new-item')?.focus()
  }
})

render()

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'))
}
