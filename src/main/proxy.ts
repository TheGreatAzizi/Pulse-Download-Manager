import { ProxyAgent, fetch as undiciFetch } from 'undici'
import { parseProxy, type ProxyConfig } from '@shared/proxy'

/**
 * All application HTTP traffic goes through this module. Node's built-in fetch
 * is backed by undici, which also understands HTTP, HTTPS and SOCKS5 proxies
 * (including proxy authentication) through ProxyAgent. Using an explicit
 * dispatcher keeps the behavior identical on Windows and Linux and avoids
 * changing Chromium's session proxy, which would also affect the renderer.
 */

let activeProxy: ProxyConfig | null = null
let activeUrl = ''
let activeAgent: ProxyAgent | null = null

export function configureProxy(value: string): ProxyConfig | null {
  const parsed = parseProxy(value)
  const next = parsed.ok ? parsed.proxy : null
  const nextUrl = next?.url ?? ''
  if (nextUrl === activeUrl) return activeProxy

  const previous = activeAgent
  activeProxy = next
  activeUrl = nextUrl
  activeAgent = null
  if (previous) void previous.close().catch(() => undefined)
  return activeProxy
}

export function currentProxy(): ProxyConfig | null {
  return activeProxy
}

function dispatcher(): ProxyAgent {
  if (!activeProxy) throw new Error('No proxy is configured.')
  if (!activeAgent) {
    // undici implements SOCKS5 through its ProxyAgent. The socks5h spelling is
    // yt-dlp's way of asking for remote DNS; undici always resolves through the
    // proxy, so both schemes use the same dispatcher URL.
    const uri =
      activeProxy.scheme === 'socks5h'
        ? activeProxy.url.replace(/^socks5h:/i, 'socks5:')
        : activeProxy.url
    activeAgent = new ProxyAgent({ uri, proxyTunnel: false })
  }
  return activeAgent
}

export async function proxiedFetch(
  input: string | URL,
  init: RequestInit = {}
): Promise<Response> {
  if (!activeProxy) return fetch(input, init)
  const response = await undiciFetch(input, {
    ...(init as Record<string, unknown>),
    dispatcher: dispatcher()
  } as Parameters<typeof undiciFetch>[1])
  return response as unknown as Response
}

export async function disposeProxy(): Promise<void> {
  const previous = activeAgent
  activeProxy = null
  activeUrl = ''
  activeAgent = null
  if (previous) await previous.close().catch(() => undefined)
}
