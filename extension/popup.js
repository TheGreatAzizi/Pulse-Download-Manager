const { t, applyI18n, applyDirection, formatBytes, formatSpeed, escapeHtml } = PulseShared

const els = {
  version: document.getElementById('version'),
  status: document.getElementById('status'),
  statusText: document.getElementById('status-text'),
  offline: document.getElementById('offline'),
  retry: document.getElementById('retry'),
  openPulseOffline: document.getElementById('open-pulse-offline'),
  tabTitle: document.getElementById('tab-title'),
  tabUrl: document.getElementById('tab-url'),
  sendPage: document.getElementById('send-page'),
  url: document.getElementById('url'),
  add: document.getElementById('add'),
  speed: document.getElementById('speed'),
  taskList: document.getElementById('task-list'),
  empty: document.getElementById('empty'),
  takeover: document.getElementById('takeover'),
  settings: document.getElementById('settings'),
  openPulse: document.getElementById('open-pulse'),
  toast: document.getElementById('toast')
}

let state = { connected: false, port: 0, appVersion: '', active: 0, speed: 0, tasks: [], settings: {} }
let currentTab = null
let toastTimer = null
let pollTimer = null

function send(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      void chrome.runtime.lastError
      resolve(response)
    })
  })
}

function showToast(message, kind) {
  els.toast.textContent = message
  els.toast.className = 'toast ' + (kind || '')
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    els.toast.className = 'toast hidden'
  }, 2800)
}

function setBusy(button, busy) {
  if (!button) return
  button.disabled = busy || !state.connected
}

function applyState(next) {
  if (!next) return
  state = { ...state, ...next, settings: next.settings || state.settings }
  const connected = !!state.connected
  els.status.className = 'status ' + (connected ? 'connected' : 'offline')
  els.statusText.textContent = connected ? t('statusConnected') : t('statusOffline')
  els.offline.classList.toggle('hidden', connected)
  els.version.textContent = 'v' + (state.appVersion || chrome.runtime.getManifest().version)
  els.sendPage.disabled = !connected || !currentTab || !/^https?:/i.test(currentTab.url || '')
  els.add.disabled = !connected
  els.takeover.checked = state.settings.takeover !== false
  renderTasks(state.tasks || [])
  els.speed.textContent = connected && state.speed ? formatSpeed(state.speed) : ''
}

function renderTasks(tasks) {
  const active = tasks.filter((task) =>
    ['queued', 'connecting', 'downloading'].includes(task.status)
  )
  els.taskList.innerHTML = ''
  els.empty.classList.toggle('hidden', active.length > 0)
  for (const task of active.slice(0, 4)) {
    const percent =
      task.size > 0 ? Math.min(100, Math.round((Number(task.downloaded || 0) / task.size) * 100)) : 0
    const statusText =
      task.status === 'queued'
        ? t('statusQueued')
        : task.status === 'connecting'
          ? t('statusConnecting')
          : percent + '%'
    const meta =
      task.size > 0
        ? formatBytes(task.downloaded) + ' / ' + formatBytes(task.size)
        : formatBytes(task.downloaded)
    const speed = task.speed ? ' · ' + formatSpeed(task.speed) : ''
    const node = document.createElement('div')
    node.className = 'task'
    node.innerHTML =
      '<div class="task-top">' +
      '<span class="task-name" title="' +
      escapeHtml(task.name) +
      '">' +
      escapeHtml(task.name) +
      '</span>' +
      '<span class="task-pct">' +
      escapeHtml(statusText) +
      '</span>' +
      '</div>' +
      '<div class="bar"><span style="width:' +
      percent +
      '%"></span></div>' +
      '<div class="task-meta" dir="ltr">' +
      escapeHtml(meta + speed) +
      '</div>'
    els.taskList.appendChild(node)
  }
}

async function refresh() {
  const next = await send({ type: 'pulse:refresh' })
  if (next) applyState(next)
}

async function loadTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  currentTab = tabs && tabs[0] ? tabs[0] : null
  if (!currentTab) return
  els.tabTitle.textContent = currentTab.title || currentTab.url || ''
  els.tabUrl.textContent = currentTab.url || ''
  els.tabUrl.title = currentTab.url || ''
  els.sendPage.disabled = !state.connected || !/^https?:/i.test(currentTab.url || '')
}

async function sendPage() {
  if (!currentTab || !/^https?:/i.test(currentTab.url || '')) {
    showToast(t('invalidUrl'), 'error')
    return
  }
  setBusy(els.sendPage, true)
  const result = await send({ type: 'pulse:send-page' })
  setBusy(els.sendPage, false)
  if (result && result.ok) {
    showToast(t('added'), 'ok')
    await refresh()
  } else {
    showToast((result && result.error) || t('addFailed'), 'error')
  }
}

async function addUrl() {
  const value = els.url.value.trim()
  let valid = false
  try {
    const parsed = new URL(value)
    valid = parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    valid = false
  }
  if (!valid) {
    showToast(t('invalidUrl'), 'error')
    return
  }
  els.add.disabled = true
  const result = await send({ type: 'pulse:add', url: value })
  els.add.disabled = !state.connected
  if (result && result.ok) {
    els.url.value = ''
    showToast(t('added'), 'ok')
    await refresh()
  } else {
    showToast((result && result.error) || t('addFailed'), 'error')
  }
}

async function openPulse() {
  const result = await send({ type: 'pulse:show' })
  if (!result || !result.ok) {
    showToast((result && result.error) || t('errOffline'), 'error')
  }
}

els.sendPage.addEventListener('click', () => void sendPage())
els.add.addEventListener('click', () => void addUrl())
els.url.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') void addUrl()
})
els.retry.addEventListener('click', () => {
  void send({ type: 'pulse:refresh' }).then((next) => {
    if (next) applyState(next)
  })
})
els.openPulse.addEventListener('click', () => void openPulse())
els.openPulseOffline.addEventListener('click', () => void openPulse())
els.settings.addEventListener('click', () => chrome.runtime.openOptionsPage())
els.takeover.addEventListener('change', () => {
  state.settings.takeover = els.takeover.checked
  void send({ type: 'pulse:set-takeover', value: els.takeover.checked })
})

applyDirection()
applyI18n()
els.version.textContent = 'v' + chrome.runtime.getManifest().version

void loadTab()
void send({ type: 'pulse:get-state' }).then((next) => {
  if (next) applyState(next)
  void refresh()
})

pollTimer = setInterval(() => {
  void refresh()
}, 1800)

window.addEventListener('unload', () => {
  if (pollTimer) clearInterval(pollTimer)
})
