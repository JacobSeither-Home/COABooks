// Several people can be signed in on one device. Each account keeps its own Supabase session under
// its own storage key, and one of them is active at a time.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_KEY, SUPABASE_URL } from '../config'

export interface DeviceAccount { key: string; userId: string; email: string; name: string }

const LIST = 'coa.accounts'
const ACTIVE = 'coa.active'
const PENDING = 'coa.pendingAccount'

const read = <T,>(k: string, fallback: T): T => { try { return JSON.parse(localStorage.getItem(k) ?? '') as T } catch { return fallback } }
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* storage full or blocked */ } }

const clients = new Map<string, SupabaseClient>()
export function clientFor(key: string, detectSessionInUrl = false): SupabaseClient {
  let c = clients.get(key)
  if (!c) {
    c = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { storageKey: `coa-auth-${key}`, flowType: 'pkce', detectSessionInUrl, persistSession: true, autoRefreshToken: true },
    })
    clients.set(key, c)
  }
  return c
}

export const listAccounts = () => read<DeviceAccount[]>(LIST, [])
export const activeKey = () => read<string | null>(ACTIVE, null)

const listeners = new Set<() => void>()
export const onAccountsChanged = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f) } }
const changed = () => listeners.forEach((f) => f())

export function setActive(key: string | null) { write(ACTIVE, key); changed() }

export function activeAccount(): DeviceAccount | null {
  const k = activeKey()
  return listAccounts().find((a) => a.key === k) ?? null
}
export function activeClient(): SupabaseClient | null {
  const a = activeAccount()
  return a ? clientFor(a.key) : null
}

function remember(key: string, user: { id: string; email?: string; user_metadata?: Record<string, unknown> }) {
  const name = String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email?.split('@')[0] ?? 'Reader')
  // The same person signing in twice keeps one entry.
  const others = listAccounts().filter((a) => a.userId !== user.id)
  const dup = listAccounts().find((a) => a.userId === user.id && a.key !== key)
  if (dup) localStorage.removeItem(`coa-auth-${dup.key}`)
  write(LIST, [...others, { key, userId: user.id, email: user.email ?? '', name }])
  setActive(key)
}

const newKey = () => Math.random().toString(36).slice(2, 10)
const returnUrl = () => location.origin + location.pathname

export async function signInWithGoogle() {
  const key = newKey()
  write(PENDING, key)
  const { error } = await clientFor(key).auth.signInWithOAuth({
    provider: 'google', options: { redirectTo: returnUrl(), queryParams: { prompt: 'select_account' } },
  })
  if (error) throw error
}

export async function signInWithPassword(email: string, password: string) {
  const key = newKey()
  const { data, error } = await clientFor(key).auth.signInWithPassword({ email, password })
  if (error) throw error
  remember(key, data.user)
}

export async function signUpWithPassword(email: string, password: string): Promise<'signed-in' | 'check-email'> {
  const key = newKey()
  const { data, error } = await clientFor(key).auth.signUp({ email, password, options: { emailRedirectTo: returnUrl() } })
  if (error) throw error
  if (data.session && data.user) { remember(key, data.user); return 'signed-in' }
  return 'check-email'
}

/** On load: finish a Google sign-in that redirected back here (?code=…). */
export async function finishRedirectSignIn(): Promise<string | null> {
  const params = new URLSearchParams(location.search)
  const key = read<string | null>(PENDING, null)
  if (!params.has('code') && !params.has('error')) return null
  localStorage.removeItem(PENDING)
  const clean = () => history.replaceState(null, '', location.pathname + location.hash)
  if (params.has('error')) { clean(); return params.get('error_description') ?? params.get('error') }
  if (!key) { clean(); return null }
  const c = clientFor(key)
  const { data, error } = await c.auth.exchangeCodeForSession(params.get('code')!)
  clean()
  if (error) return error.message
  remember(key, data.user)
  return null
}

export async function signOut(key: string) {
  try { await clientFor(key).auth.signOut({ scope: 'local' }) } catch { /* offline */ }
  localStorage.removeItem(`coa-auth-${key}`)
  write(LIST, listAccounts().filter((a) => a.key !== key))
  if (activeKey() === key) setActive(listAccounts()[0]?.key ?? null)
  changed()
}
