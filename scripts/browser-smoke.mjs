import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const cdpBase = process.env.CDP_BASE ?? 'http://127.0.0.1:9223'
const appUrl = process.env.APP_URL ?? 'http://127.0.0.1:4173/'
const screenshotName = process.env.SCREENSHOT_NAME ?? 'mobile-390.png'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

if (!/^[a-zA-Z0-9._-]+\.png$/.test(screenshotName)) throw new Error('SCREENSHOT_NAME 必须是安全的 PNG 文件名')

const target = await fetch(`${cdpBase}/json/new?${encodeURIComponent(appUrl)}`, { method: 'PUT' }).then((response) => {
  if (!response.ok) throw new Error(`无法创建浏览器页面：${response.status}`)
  return response.json()
})

const socket = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true })
  socket.addEventListener('error', reject, { once: true })
})

let requestId = 0
const pending = new Map()
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data)
  if (!message.id || !pending.has(message.id)) return
  const { resolve, reject } = pending.get(message.id)
  pending.delete(message.id)
  if (message.error) reject(new Error(message.error.message))
  else resolve(message.result)
})

function send(method, params = {}) {
  const id = ++requestId
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function evaluate(expression, awaitPromise = false) {
  const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise })
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text)
  return response.result.value
}

try {
  await send('Page.enable')
  await send('Network.enable')
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
    screenWidth: 390,
    screenHeight: 844,
  })
  await send('Page.navigate', { url: appUrl })
  await delay(800)
  await evaluate('localStorage.clear(); location.reload()')
  await delay(800)

  const viewport = await evaluate(`({
    innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    title: document.title,
    h1: document.querySelector('h1')?.innerText ?? ''
  })`)
  if (viewport.title !== '今日航线' || !viewport.h1.includes('今天走哪条航线')) throw new Error('首页核心内容未正确渲染')
  if (viewport.scrollWidth > viewport.innerWidth) throw new Error(`手机视口横向溢出：${viewport.scrollWidth} > ${viewport.innerWidth}`)

  const testTitle = '验证跨设备备份流程'
  await evaluate(`(() => {
    const input = document.querySelector('#new-item')
    input.value = ${JSON.stringify(testTitle)}
    input.closest('form').requestSubmit()
  })()`)
  await delay(200)
  const savedBeforeReload = await evaluate(`document.body.innerText.includes(${JSON.stringify(testTitle)}) && localStorage.getItem('today-route-state-v1').includes(${JSON.stringify(testTitle)})`)
  if (!savedBeforeReload) throw new Error('新增事项未写入页面与本地存储')

  await send('Page.reload')
  await delay(700)
  const savedAfterReload = await evaluate(`document.body.innerText.includes(${JSON.stringify(testTitle)})`)
  if (!savedAfterReload) throw new Error('刷新后事项丢失')

  await evaluate(`navigator.serviceWorker.ready.then(() => true)`, true)
  await send('Page.reload')
  await delay(500)
  await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 })
  await send('Page.reload')
  await delay(700)
  const offlineTitle = await evaluate('document.title')
  if (offlineTitle !== '今日航线') throw new Error('断网后应用未能打开')
  await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })

  const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  const artifactDir = path.join(root, 'artifacts', 'validation')
  await mkdir(artifactDir, { recursive: true })
  await writeFile(path.join(artifactDir, screenshotName), Buffer.from(screenshot.data, 'base64'))

  console.log(JSON.stringify({
    passed: true,
    viewport,
    persistence: 'passed',
    offline: 'passed',
    screenshot: `artifacts/validation/${screenshotName}`,
  }, null, 2))
} finally {
  await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }).catch(() => {})
  socket.close()
  await fetch(`${cdpBase}/json/close/${target.id}`).catch(() => {})
}
