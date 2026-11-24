// Characters for the active account. Kept on the device first so reading works without signal, and
// saved to Supabase shortly after each change (and again when the connection comes back).
import { useEffect, useState, useSyncExternalStore } from 'react'
import { activeAccount, activeClient, onAccountsChanged } from './accounts'
import type { Character } from './character'

type Status = 'saved' | 'saving' | 'offline' | 'error'

let chars: Character[] = []
let loadedFor: string | null = null
let status = 'saved' as Status
const dirty = new Set<string>()
const listeners = new Set<() => void>()
const emit = () => { snapshot = { chars, status }; listeners.forEach((f) => f()) }
let snapshot: { chars: Character[]; status: Status } = { chars, status }

const cacheKey = (uid: string) => `coa.chars.${uid}`
const dirtyKey = (uid: string) => `coa.dirty.${uid}`

function persistLocal(uid: string) {
  try {
    localStorage.setItem(cacheKey(uid), JSON.stringify(chars))
    localStorage.setItem(dirtyKey(uid), JSON.stringify([...dirty]))
  } catch { /* full */ }
}

function loadLocal(uid: string) {
  try { chars = JSON.parse(localStorage.getItem(cacheKey(uid)) ?? '[]') } catch { chars = [] }
  dirty.clear()
  try { for (const id of JSON.parse(localStorage.getItem(dirtyKey(uid)) ?? '[]')) dirty.add(id) } catch { /* none */ }
}

const COLUMNS = 'id,user_id,series,name,book,section,state,history,finished_books,dead,start,updated_at'

async function pull() {
  const acct = activeAccount(); const db = activeClient()
  if (!acct || !db) return
  const { data, error } = await db.from('characters').select(COLUMNS).order('updated_at', { ascending: false })
  if (error) { status = navigator.onLine ? 'error' : 'offline'; emit(); return }
  if (activeAccount()?.key !== acct.key) return
  const remote = new Map((data as Character[]).map((c) => [c.id, c]))
  // Unsaved local changes win; everything else comes from the server.
  const merged: Character[] = []
  for (const c of chars) if (dirty.has(c.id)) { merged.push(c); remote.delete(c.id) }
  merged.push(...remote.values())
  chars = merged
  persistLocal(acct.userId)
  emit()
  if (dirty.size) void push()
}

let timer: ReturnType<typeof setTimeout> | null = null
let pushing = false
async function push() {
  const acct = activeAccount(); const db = activeClient()
  if (!acct || !db || pushing) return
  pushing = true
  status = 'saving'; emit()
  try {
    for (const id of [...dirty]) {
      const c = chars.find((x) => x.id === id)
      if (!c) { // deleted
        const { error } = await db.from('characters').delete().eq('id', id)
        if (error) throw error
      } else {
        const { updated_at: _u, ...row } = c
        void _u
        const { error } = await db.from('characters').upsert({ ...row, user_id: acct.userId })
        if (error) throw error
      }
      dirty.delete(id)
      persistLocal(acct.userId)
    }
    status = 'saved'
  } catch {
    status = navigator.onLine ? 'error' : 'offline'
  } finally {
    pushing = false
    emit()
  }
}

function schedule() {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => { timer = null; void push() }, 800)
}

function ensureLoaded() {
  const acct = activeAccount()
  const key = acct?.key ?? null
  if (key === loadedFor) return
  loadedFor = key
  chars = []
  if (acct) { loadLocal(acct.userId); void pull() }
  emit()
}

onAccountsChanged(ensureLoaded)
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { void pull() })
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && dirty.size) void push() })
}

export function useCharacters() {
  ensureLoaded()
  return useSyncExternalStore((f) => { listeners.add(f); return () => { listeners.delete(f) } }, () => snapshot)
}

export function useCharacter(id: string | undefined) {
  const { chars: list } = useCharacters()
  return list.find((c) => c.id === id)
}

export function saveCharacter(c: Character) {
  const acct = activeAccount(); if (!acct) return
  const i = chars.findIndex((x) => x.id === c.id)
  const next = { ...c, updated_at: new Date().toISOString() }
  chars = i < 0 ? [next, ...chars] : chars.map((x) => (x.id === c.id ? next : x))
  dirty.add(c.id)
  persistLocal(acct.userId)
  emit()
  schedule()
}

export function deleteCharacter(id: string) {
  const acct = activeAccount(); if (!acct) return
  chars = chars.filter((c) => c.id !== id)
  dirty.add(id)
  persistLocal(acct.userId)
  emit()
  schedule()
}

export function refresh() { void pull() }

/** Re-render when the active account changes. */
export function useAccount() {
  const [a, setA] = useState(activeAccount())
  useEffect(() => onAccountsChanged(() => setA(activeAccount())), [])
  return a
}
