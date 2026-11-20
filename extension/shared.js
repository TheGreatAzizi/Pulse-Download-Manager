/* Shared helpers for the Pulse browser extension. */
;(function () {
  const PORTS = [19527, 19528, 19529, 19530]
  const PROTOCOL = 1

  function t(key, subs) {
    const value = chrome.i18n.getMessage(key, subs)
    return value || key
  }

  function applyI18n(root) {
    const scope = root || document
    for (const el of scope.querySelectorAll('[data-i18n]')) {
      el.textContent = t(el.getAttribute('data-i18n'))
    }
    for (const el of scope.querySelectorAll('[data-i18n-placeholder]')) {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')))
    }
    for (const el of scope.querySelectorAll('[data-i18n-title]')) {
      el.setAttribute('title', t(el.getAttribute('data-i18n-title')))
    }
    for (const el of scope.querySelectorAll('[data-i18n-aria]')) {
      el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')))
    }
  }

  function isRtl() {
    const lang = (chrome.i18n.getUILanguage() || '').toLowerCase()
    return lang.startsWith('fa') || lang.startsWith('ar') || lang.startsWith('he')
  }

  function applyDirection() {
    document.documentElement.dir = isRtl() ? 'rtl' : 'ltr'
    document.documentElement.lang = chrome.i18n.getUILanguage() || 'en'
  }

  function formatBytes(bytes) {
    const n = Number(bytes) || 0
    if (n <= 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let value = n
    let unit = 0
    while (value >= 1024 && unit < units.length - 1) {
      value /= 1024
      unit++
    }
    const digits = value >= 100 || unit === 0 ? 0 : value >= 10 ? 1 : 2
    return value.toFixed(digits) + ' ' + units[unit]
  }

  function formatSpeed(bytes) {
    return formatBytes(bytes) + '/s'
  }

  function parseUrls(text) {
    const found = String(text || '').match(/https?:\/\/[^\s<>"']+/gi) || []
    const seen = new Set()
    const urls = []
    for (const raw of found) {
      const url = raw.replace(/[),.;!?]+$/g, '')
      if (!url || seen.has(url)) continue
      seen.add(url)
      urls.push(url)
    }
    return urls
  }

  /**
   * Chrome can replay download events after a restart. Only take over a
   * download that is still running and that started moments ago, so completed
   * history entries and old interrupted items stay untouched.
   */
  function shouldTakeOver(item, extensionId, maxAgeMs) {
    if (!item || item.state !== 'in_progress') return false
    if (extensionId && item.byExtensionId === extensionId) return false
    const startedAt = Date.parse(String(item.startTime || ''))
    if (!Number.isFinite(startedAt)) return false
    return Date.now() - startedAt <= (maxAgeMs || 15000)
  }

  function hostMatches(hostname, domain) {
    const host = String(hostname || '').toLowerCase()
    const base = String(domain || '')
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .replace(/^www\./, '')
    if (!host || !base) return false
    return host === base || host.endsWith('.' + base)
  }

  function isExcluded(url, domains) {
    try {
      const host = new URL(url).hostname
      return (domains || []).some((domain) => hostMatches(host, domain))
    } catch {
      return false
    }
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  function storageGet(defaults) {
    return new Promise((resolve) => {
      chrome.storage.local.get(defaults, (value) => resolve(value || defaults))
    })
  }

  function storageSet(value) {
    return new Promise((resolve) => {
      chrome.storage.local.set(value, () => resolve())
    })
  }

  function notify(title, message) {
    try {
      chrome.notifications.create(
        'pulse-' + Date.now() + '-' + Math.random().toString(16).slice(2),
        {
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title,
          message
        },
        () => void chrome.runtime.lastError
      )
    } catch {
      /* notifications are best effort */
    }
  }

  function flashBadge(text, color) {
    try {
      chrome.action.setBadgeBackgroundColor({ color: color || '#2f5fd0' })
      chrome.action.setBadgeText({ text: text || '' })
      if (text) {
        setTimeout(() => chrome.action.setBadgeText({ text: '' }), 2200)
      }
    } catch {
      /* badge is best effort */
    }
  }

  globalThis.PulseShared = {
    PORTS,
    PROTOCOL,
    t,
    applyI18n,
    isRtl,
    applyDirection,
    formatBytes,
    formatSpeed,
    parseUrls,
    shouldTakeOver,
    hostMatches,
    isExcluded,
    escapeHtml,
    storageGet,
    storageSet,
    notify,
    flashBadge
  }
})()
