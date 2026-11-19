const { t, applyI18n, applyDirection } = PulseShared

const els = {
  status: document.getElementById('status'),
  statusText: document.getElementById('status-text'),
  connectionDetail: document.getElementById('connection-detail'),
  port: document.getElementById('port'),
  appVersion: document.getElementById('app-version'),
  clients: document.getElementById('clients'),
  test: document.getElementById('test'),
  openPulse: document.getElementById('open-pulse'),
  takeover: document.getElementById('takeover'),
  notifications: document.getElementById('notifications'),
  excluded: document.getElementById('excluded'),
  save: document.getElementById('save'),
  copyExtensions: document.getElementById('copy-extensions'),
  extVersion: document.getElementById('ext-version'),
  toast: document.getElementById('toast')
}

let state = { connected: false, port: 0, appVersion: '', settings: {} }
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

function renderState(next) {
  if (!next) return
  state = { ...state, ...next, settings: next.settings || state.settings }
  const connected = !!state.connected
  els.status.className = 'status ' + (connected ? 'connected' : 'offline')
  els.statusText.textContent = connected ? t('statusConnected') : t('statusOffline')
  els.connectionDetail.textContent = connected
    ? t('connectedTo', [state.appVersion || 'Pulse'])
    : t('offlineHint')
  els.port.textContent = state.port ? String(state.port) : '-'
  els.appVersion.textContent = state.appVersion || '-'
  els.clients.textContent = connected ? t('connected') : t('offline')
  els.takeover.checked = state.settings.takeover !== false
  els.notifications.checked = state.settings.notifications !== false
  if (document.activeElement !== els.excluded) {
    const list = Array.isArray(state.settings.excluded) ? state.settings.excluded : []
    els.excluded.value = list.join('\n')
  }
}

async function load() {
  const next = await send({ type: 'pulse:get-state' })
  if (next) renderState(next)
  const refreshed = await send({ type: 'pulse:refresh' })
  if (refreshed) renderState(refreshed)
}

async function save() {
  const excluded = els.excluded.value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const result = await send({
    type: 'pulse:save-settings',
    settings: {
      takeover: els.takeover.checked,
      notifications: els.notifications.checked,
      excluded
    }
  })
  if (result && result.ok) {
    state.settings = result.settings
    showToast(t('saved'), 'ok')
  } else {
    showToast(t('addFailed'), 'error')
  }
}

async function testConnection() {
  els.test.disabled = true
  const result = await send({ type: 'pulse:test' })
  els.test.disabled = false
  if (result && result.ok) {
    showToast(t('connected'), 'ok')
    await load()
  } else {
    showToast((result && result.error) || t('errOffline'), 'error')
  }
}

async function openPulse() {
  const result = await send({ type: 'pulse:show' })
  if (!result || !result.ok) showToast((result && result.error) || t('errOffline'), 'error')
}

async function openExtensions() {
  try {
    await chrome.tabs.create({ url: 'chrome://extensions' })
  } catch {
    try {
      await navigator.clipboard.writeText('chrome://extensions')
      showToast(t('copiedExtensions'), 'ok')
    } catch {
      showToast('chrome://extensions', 'ok')
    }
  }
}

els.save.addEventListener('click', () => void save())
els.test.addEventListener('click', () => void testConnection())
els.openPulse.addEventListener('click', () => void openPulse())
els.copyExtensions.addEventListener('click', () => void openExtensions())
els.takeover.addEventListener('change', () => void save())
els.notifications.addEventListener('change', () => void save())

applyDirection()
applyI18n()
els.extVersion.textContent = 'v' + chrome.runtime.getManifest().version
void load()

pollTimer = setInterval(() => {
  void send({ type: 'pulse:refresh' }).then((next) => {
    if (next) renderState(next)
  })
}, 3000)

window.addEventListener('unload', () => {
  if (pollTimer) clearInterval(pollTimer)
})
