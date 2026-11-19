importScripts('shared.js')

const {
  PORTS,
  PROTOCOL,
  t,
  parseUrls,
  isExcluded,
  notify,
  flashBadge,
  storageGet,
  storageSet
} = PulseShared

const DEFAULT_SETTINGS = { takeover: true, notifications: true, excluded: [] }
const MAX_BATCH = 50

let settings = { ...DEFAULT_SETTINGS }
let socket = null
let connected = false
let connecting = false
let lastPort = 0
let appVersion = ''
let reconnectTimer = null
let reconnectAttempt = 0
let nextRequestId = 1
const pending = new Map()
const skipOnce = new Map()

let state = {
  connected: false,
  port: 0,
  appVersion: '',
  active: 0,
  speed: 0,
  tasks: []
}

function setState(patch) {
  state = { ...state, ...patch }
}

function sendRaw(payload) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return false
  try {
    socket.send(JSON.stringify(payload))
    return true
  } catch {
    return false
  }
}

function request(payload, timeoutMs) {
  return new Promise((resolve) => {
    if (!connected) {
      resolve({ ok: false, error: t('errOffline') })
      return
    }
    const requestId = String(nextRequestId++)
    const timer = setTimeout(() => {
      pending.delete(requestId)
      resolve({ ok: false, error: t('errTimeout') })
    }, timeoutMs || 9000)
    pending.set(requestId, { resolve, timer })
    if (!sendRaw({ ...payload, requestId })) {
      clearTimeout(timer)
      pending.delete(requestId)
      resolve({ ok: false, error: t('errOffline') })
    }
  })
}

function rejectPending() {
  for (const [, entry] of pending) {
    clearTimeout(entry.timer)
    entry.resolve({ ok: false, error: t('errOffline') })
  }
  pending.clear()
}

function scheduleReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer)
  const delay = Math.min(15000, 900 * Math.pow(1.6, reconnectAttempt++))
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    if (!connected) connect()
  }, delay)
}

function handleMessage(event) {
  let message
  try {
    message = JSON.parse(String(event.data))
  } catch {
    return
  }
  if (!message || typeof message.type !== 'string') return

  if (message.type === 'welcome') {
    appVersion = String(message.appVersion || '')
    setState({ connected: true, port: Number(message.port) || lastPort, appVersion })
    return
  }

  if (message.type === 'status') {
    setState({
      connected: true,
      appVersion: String(message.appVersion || appVersion || ''),
      active: Number(message.active) || 0,
      speed: Number(message.speed) || 0,
      tasks: Array.isArray(message.tasks) ? message.tasks : []
    })
    return
  }

  if (message.type === 'pong') {
    if (message.requestId && pending.has(message.requestId)) {
      const entry = pending.get(message.requestId)
      pending.delete(message.requestId)
      clearTimeout(entry.timer)
      entry.resolve({ ok: true })
    }
    return
  }

  if (message.requestId && pending.has(message.requestId)) {
    const entry = pending.get(message.requestId)
    pending.delete(message.requestId)
    clearTimeout(entry.timer)
    if (message.type === 'error') {
      entry.resolve({ ok: false, error: String(message.message || t('addFailed')) })
    } else {
      entry.resolve({ ok: true, ...message })
    }
  }
}

function bindSocket(ws) {
  ws.addEventListener('message', handleMessage)
  ws.addEventListener('close', () => {
    if (socket !== ws) return
    socket = null
    connected = false
    setState({ connected: false, port: 0, active: 0, speed: 0, tasks: [] })
    rejectPending()
    scheduleReconnect()
  })
  ws.addEventListener('error', () => {
    /* the close event drives reconnection */
  })
}

function tryPorts(order, index) {
  if (index >= order.length) {
    connecting = false
    scheduleReconnect()
    return
  }
  const port = order[index]
  let ws
  try {
    ws = new WebSocket('ws://127.0.0.1:' + port)
  } catch {
    tryPorts(order, index + 1)
    return
  }

  let settled = false
  const timer = setTimeout(() => {
    if (settled) return
    settled = true
    try {
      ws.close()
    } catch {
      /* ignore */
    }
    tryPorts(order, index + 1)
  }, 1400)

  ws.addEventListener('open', () => {
    if (settled) return
    settled = true
    clearTimeout(timer)
    socket = ws
    connected = true
    connecting = false
    lastPort = port
    reconnectAttempt = 0
    bindSocket(ws)
    sendRaw({ type: 'hello', protocol: PROTOCOL, version: chrome.runtime.getManifest().version })
    setState({ connected: true, port })
    void refreshStatus()
  })

  ws.addEventListener('error', () => {
    if (settled) return
    settled = true
    clearTimeout(timer)
    try {
      ws.close()
    } catch {
      /* ignore */
    }
    tryPorts(order, index + 1)
  })
}

function connect() {
  if (connecting) return
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return
  }
  connecting = true
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  const start = lastPort ? Math.max(0, PORTS.indexOf(lastPort)) : 0
  const order = PORTS.slice(start).concat(PORTS.slice(0, start))
  tryPorts(order, 0)
}

async function ensureConnected(timeoutMs) {
  if (connected) return true
  connect()
  const deadline = Date.now() + (timeoutMs || 2000)
  while (!connected && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 120))
  }
  return connected
}

async function refreshStatus() {
  if (!connected) return state
  const result = await request({ type: 'status' })
  if (result.ok) {
    setState({
      connected: true,
      appVersion: String(result.appVersion || appVersion || ''),
      active: Number(result.active) || 0,
      speed: Number(result.speed) || 0,
      tasks: Array.isArray(result.tasks) ? result.tasks : []
    })
  }
  return state
}

async function cookieHeader(url) {
  try {
    const cookies = await chrome.cookies.getAll({ url })
    return cookies.map((cookie) => cookie.name + '=' + cookie.value).join('; ')
  } catch {
    return ''
  }
}

function validUrl(value) {
  try {
    const parsed = new URL(String(value || ''))
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

async function addDownload(input) {
  const url = String(input.url || '').trim()
  if (!validUrl(url)) return { ok: false, error: t('invalidUrl') }
  if (!(await ensureConnected(2000))) return { ok: false, error: t('errOffline') }
  const cookies = input.cookies === undefined ? await cookieHeader(url) : input.cookies
  return request({
    type: 'add',
    url,
    fileName: input.fileName || '',
    referrer: input.referrer || '',
    cookies: cookies || '',
    userAgent: navigator.userAgent
  })
}

async function addBatch(urls, referrer) {
  const unique = [...new Set((urls || []).filter(validUrl))].slice(0, MAX_BATCH)
  if (!unique.length) return { ok: false, error: t('noLinks') }
  if (!(await ensureConnected(2000))) return { ok: false, error: t('errOffline') }
  const items = await Promise.all(
    unique.map(async (url) => ({ url, cookies: await cookieHeader(url) }))
  )
  return request(
    {
      type: 'addBatch',
      items,
      referrer: referrer || '',
      userAgent: navigator.userAgent
    },
    20000
  )
}

function feedback(result, name) {
  if (result.ok) {
    flashBadge('✓', '#2563eb')
    if (settings.notifications) {
      notify(t('notifSentTitle'), t('notifSent', [name || t('added')]))
    }
    return
  }
  flashBadge('!', '#dc2626')
  if (settings.notifications) {
    notify(t('notifFailedTitle'), result.error || t('notifFailed'))
  }
}

async function sendWithFeedback(url, referrer) {
  const result = await addDownload({ url, referrer })
  feedback(result, result.name || url)
  return result
}

async function sendCurrentPage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab || !tab.url || !validUrl(tab.url)) {
    feedback({ ok: false, error: t('invalidUrl') })
    return { ok: false, error: t('invalidUrl') }
  }
  const result = await addDownload({ url: tab.url, referrer: tab.url })
  feedback(result, tab.title || tab.url)
  return result
}

async function collectLinks(tab) {
  if (!tab || !tab.id) return []
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () =>
        Array.from(document.querySelectorAll('a[href]'))
          .map((anchor) => anchor.href)
          .filter((href) => /^https?:/i.test(href))
    })
    const list = results && results[0] && Array.isArray(results[0].result) ? results[0].result : []
    return [...new Set(list)].slice(0, MAX_BATCH)
  } catch {
    return []
  }
}

function createMenus() {
  chrome.contextMenus.removeAll(() => {
    const items = [
      { id: 'pulse-link', title: t('menuLink'), contexts: ['link'] },
      { id: 'pulse-image', title: t('menuImage'), contexts: ['image'] },
      { id: 'pulse-media', title: t('menuMedia'), contexts: ['video', 'audio'] },
      { id: 'pulse-page', title: t('menuPage'), contexts: ['page'] },
      { id: 'pulse-selection', title: t('menuSelection'), contexts: ['selection'] },
      { id: 'pulse-all-links', title: t('menuAllLinks'), contexts: ['page', 'frame'] }
    ]
    for (const item of items) {
      chrome.contextMenus.create(item, () => void chrome.runtime.lastError)
    }
  })
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const referrer = info.pageUrl || (tab && tab.url) || ''
  if (info.menuItemId === 'pulse-link' && info.linkUrl) {
    void sendWithFeedback(info.linkUrl, referrer)
    return
  }
  if ((info.menuItemId === 'pulse-image' || info.menuItemId === 'pulse-media') && info.srcUrl) {
    void sendWithFeedback(info.srcUrl, referrer)
    return
  }
  if (info.menuItemId === 'pulse-page' && referrer) {
    void sendWithFeedback(referrer, referrer)
    return
  }
  if (info.menuItemId === 'pulse-selection') {
    const urls = parseUrls(info.selectionText)
    if (!urls.length) {
      if (settings.notifications) notify(t('notifFailedTitle'), t('notifNoLinks'))
      return
    }
    void addBatch(urls, referrer).then((result) => {
      if (result.ok) {
        flashBadge('✓', '#2563eb')
        if (settings.notifications) {
          notify(t('notifSentTitle'), t('notifBatch', [String(result.added || urls.length)]))
        }
      } else {
        feedback(result)
      }
    })
    return
  }
  if (info.menuItemId === 'pulse-all-links') {
    void collectLinks(tab).then((urls) => {
      if (!urls.length) {
        if (settings.notifications) notify(t('notifFailedTitle'), t('notifNoLinks'))
        return
      }
      return addBatch(urls, referrer).then((result) => {
        if (result.ok) {
          flashBadge('✓', '#2563eb')
          if (settings.notifications) {
            notify(t('notifSentTitle'), t('notifBatch', [String(result.added || urls.length)]))
          }
        } else {
          feedback(result)
        }
      })
    })
  }
})

chrome.commands.onCommand.addListener((command) => {
  if (command === 'send-page') void sendCurrentPage()
})

chrome.downloads.onCreated.addListener((item) => {
  void (async () => {
    if (!settings.takeover) return
    if (!validUrl(item.url)) return
    if (isExcluded(item.url, settings.excluded)) return
    const skippedAt = skipOnce.get(item.url)
    if (skippedAt && Date.now() - skippedAt < 10000) {
      skipOnce.delete(item.url)
      return
    }
    if (!(await ensureConnected(2500))) return

    const fileName = item.filename ? item.filename.split(/[\\/]/).pop() : ''
    try {
      await chrome.downloads.cancel(item.id)
    } catch {
      /* the download may have finished already */
    }
    try {
      await chrome.downloads.erase({ id: item.id })
    } catch {
      /* ignore */
    }

    const result = await addDownload({
      url: item.url,
      fileName,
      referrer: item.referrer || '',
      cookies: await cookieHeader(item.url)
    })

    if (result.ok) {
      flashBadge('✓', '#2563eb')
      return
    }

    skipOnce.set(item.url, Date.now())
    try {
      await chrome.downloads.download({ url: item.url, conflictAction: 'uniquify' })
    } catch {
      /* ignore */
    }
    if (settings.notifications) notify(t('notifFailedTitle'), result.error || t('notifFailed'))
  })()
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message.type !== 'string') return

  if (message.type === 'pulse:get-state') {
    sendResponse({
      connected,
      port: state.port,
      appVersion: state.appVersion,
      active: state.active,
      speed: state.speed,
      tasks: state.tasks,
      settings
    })
    return true
  }

  if (message.type === 'pulse:refresh') {
    void refreshStatus().then((next) =>
      sendResponse({
        connected,
        port: next.port,
        appVersion: next.appVersion,
        active: next.active,
        speed: next.speed,
        tasks: next.tasks,
        settings
      })
    )
    return true
  }

  if (message.type === 'pulse:add') {
    void addDownload({ url: message.url, referrer: message.referrer || '' }).then(sendResponse)
    return true
  }

  if (message.type === 'pulse:send-page') {
    void sendCurrentPage().then(sendResponse)
    return true
  }

  if (message.type === 'pulse:show') {
    void request({ type: 'show' }).then(sendResponse)
    return true
  }

  if (message.type === 'pulse:test') {
    void request({ type: 'ping' }).then(sendResponse)
    return true
  }

  if (message.type === 'pulse:set-takeover') {
    settings.takeover = !!message.value
    void storageSet({ takeover: settings.takeover })
    sendResponse({ ok: true, settings })
    return true
  }

  if (message.type === 'pulse:save-settings') {
    const next = message.settings || {}
    settings = {
      takeover: next.takeover === undefined ? settings.takeover : !!next.takeover,
      notifications:
        next.notifications === undefined ? settings.notifications : !!next.notifications,
      excluded: Array.isArray(next.excluded) ? next.excluded : settings.excluded
    }
    void storageSet(settings)
    sendResponse({ ok: true, settings })
    return true
  }
})

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return
  if (changes.takeover) settings.takeover = !!changes.takeover.newValue
  if (changes.notifications) settings.notifications = !!changes.notifications.newValue
  if (changes.excluded) settings.excluded = changes.excluded.newValue || []
})

chrome.runtime.onInstalled.addListener((details) => {
  createMenus()
  connect()
  if (details.reason === 'install') {
    void chrome.runtime.openOptionsPage()
  }
})

chrome.runtime.onStartup.addListener(() => {
  createMenus()
  connect()
})

chrome.alarms.create('pulse-reconnect', { periodInMinutes: 1 })
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'pulse-reconnect' && !connected) connect()
})

void storageGet(DEFAULT_SETTINGS).then((loaded) => {
  settings = {
    takeover: loaded.takeover !== false,
    notifications: loaded.notifications !== false,
    excluded: Array.isArray(loaded.excluded) ? loaded.excluded : []
  }
  createMenus()
  connect()
})
