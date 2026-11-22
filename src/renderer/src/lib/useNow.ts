import { useEffect, useState } from 'react'

/** A shared clock for live countdowns and schedule state badges. */
export function useNow(intervalMs = 1000, enabled = true): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (!enabled) return
    setNow(new Date())
    const timer = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs, enabled])
  return now
}
