import { networkInterfaces } from 'node:os'
import type { NetworkAdapter, Settings } from '@shared/types'

/**
 * Physical adapters that can carry a download. Virtual, loopback and tunnel
 * interfaces are skipped: binding a transfer to a Hyper-V or Docker address
 * usually produces a connection that cannot reach the internet.
 */
const VIRTUAL_DEVICE =
  /virtual|vEthernet|VMware|VirtualBox|Hyper-V|Loopback|Docker|WSL|Bluetooth|Npcap|TAP[- ]|TUN|Tailscale|ZeroTier|Radmin|Hamachi|WireGuard|VPN/i

function adapterKind(device: string): NetworkAdapter['kind'] {
  if (/wi-?fi|wlan|wireless/i.test(device)) return 'wifi'
  if (/ethernet|eth\d|enp\d|ens\d|eno\d/i.test(device)) return 'ethernet'
  return 'other'
}

function adapterName(device: string, address: string): string {
  const label = device.replace(/\s+/g, ' ').trim() || 'Network'
  return `${label} (${address})`
}

/** Active physical IPv4 adapters, ordered Wi-Fi, Ethernet, then the rest. */
export function listNetworkAdapters(): NetworkAdapter[] {
  const adapters: NetworkAdapter[] = []
  for (const [device, addresses] of Object.entries(networkInterfaces())) {
    if (!addresses || VIRTUAL_DEVICE.test(device)) continue
    for (const info of addresses) {
      const family = String(info.family)
      if (info.internal || (family !== 'IPv4' && family !== '4')) continue
      const address = info.address
      if (!address || address.startsWith('169.254.') || address === '0.0.0.0') continue
      adapters.push({
        id: address,
        device,
        name: adapterName(device, address),
        address,
        family: 'IPv4',
        kind: adapterKind(device)
      })
    }
  }
  const order: Record<NetworkAdapter['kind'], number> = { wifi: 0, ethernet: 1, other: 2 }
  return adapters.sort((a, b) => order[a.kind] - order[b.kind] || a.name.localeCompare(b.name))
}

/**
 * Addresses that should receive HTTP segments. Two adapters are the minimum
 * for aggregation; with one adapter the normal single-network path is used.
 */
export function selectedNetworkAdapters(
  settings: Pick<Settings, 'multiNetwork' | 'networkAdapters'>
): string[] {
  if (!settings.multiNetwork) return []
  const available = listNetworkAdapters()
  const chosen = Array.isArray(settings.networkAdapters) ? settings.networkAdapters : []
  const usable = chosen.length
    ? available.filter((adapter) => chosen.includes(adapter.address))
    : available
  return usable.length > 1 ? usable.map((adapter) => adapter.address) : []
}
