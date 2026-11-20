/**
 * Proxy address parsing shared by the main process and the settings UI.
 * Keep this module free of Node specific imports so the renderer can use it.
 */

export type ProxyScheme = 'http' | 'https' | 'socks5' | 'socks5h'

export interface ProxyConfig {
  /** Normalized address, safe to pass to yt-dlp. */
  url: string
  scheme: ProxyScheme
  host: string
  port: number
  username: string
  password: string
}

export type ProxyErrorCode = 'invalid' | 'scheme' | 'port' | 'credentials'

export type ProxyParseResult =
  | { ok: true; proxy: ProxyConfig | null }
  | { ok: false; error: ProxyErrorCode }

const SCHEMES: Record<string, ProxyScheme> = {
  'http:': 'http',
  'https:': 'https',
  'socks:': 'socks5',
  'socks5:': 'socks5',
  'socks5h:': 'socks5h'
}

/**
 * Accepts proxy addresses with or without a scheme. An empty value means a
 * direct connection. Credentials may be embedded in the address, which is the
 * format understood by yt-dlp:
 *
 *   socks5://user:password@127.0.0.1:1080
 */
export function parseProxy(value: string | null | undefined): ProxyParseResult {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return { ok: true, proxy: null }

  if (/\s/.test(raw)) return { ok: false, error: 'invalid' }

  const text = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `http://${raw}`
  let url: URL
  try {
    url = new URL(text)
  } catch {
    return { ok: false, error: 'invalid' }
  }

  const scheme = SCHEMES[url.protocol.toLowerCase()]
  if (!scheme) return { ok: false, error: 'scheme' }

  if ((url.pathname && url.pathname !== '/') || url.search || url.hash) {
    return { ok: false, error: 'invalid' }
  }

  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (!host) return { ok: false, error: 'invalid' }

  if (!url.port) return { ok: false, error: 'port' }
  const port = Number(url.port)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { ok: false, error: 'port' }
  }

  let username = ''
  let password = ''
  try {
    username = decodeURIComponent(url.username)
    password = decodeURIComponent(url.password)
  } catch {
    return { ok: false, error: 'credentials' }
  }

  if (!username && password) return { ok: false, error: 'credentials' }
  if (/[\u0000-\u001f\u007f]/.test(username) || /[\u0000-\u001f\u007f]/.test(password)) {
    return { ok: false, error: 'credentials' }
  }

  const hostPart = host.includes(':') ? `[${host}]` : host
  const auth = username
    ? `${encodeURIComponent(username)}${password ? `:${encodeURIComponent(password)}` : ''}@`
    : ''

  return {
    ok: true,
    proxy: {
      url: `${scheme}://${auth}${hostPart}:${port}`,
      scheme,
      host,
      port,
      username,
      password
    }
  }
}

/** A short label for the settings UI, without credentials. */
export function proxyEndpoint(proxy: ProxyConfig): string {
  const host = proxy.host.includes(':') ? `[${proxy.host}]` : proxy.host
  return `${proxy.scheme.toUpperCase()} ${host}:${proxy.port}`
}
