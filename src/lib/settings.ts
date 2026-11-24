import { useEffect, useState } from 'react'

export interface Settings { candle: boolean; worn: boolean }
const KEY = 'coa.settings'
const DEFAULTS: Settings = { candle: true, worn: true }

function read(): Settings {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') } } catch { return DEFAULTS }
}
const listeners = new Set<() => void>()

export function setSetting<K extends keyof Settings>(k: K, v: Settings[K]) {
  try { localStorage.setItem(KEY, JSON.stringify({ ...read(), [k]: v })) } catch { /* ignore */ }
  listeners.forEach((f) => f())
}

export function useSettings(): Settings {
  const [s, setS] = useState(read)
  useEffect(() => { const f = () => setS(read()); listeners.add(f); return () => { listeners.delete(f) } }, [])
  return s
}
