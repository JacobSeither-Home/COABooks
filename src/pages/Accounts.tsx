// Who's reading: everyone signed in on this device, and a way to add another person.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listAccounts, setActive, signInWithGoogle, signInWithPassword, signOut, signUpWithPassword } from '../lib/accounts'
import { useAccount } from '../lib/store'

export default function Accounts({ error }: { error?: string | null }) {
  const active = useAccount()
  const nav = useNavigate()
  const accounts = listAccounts()
  const [mode, setMode] = useState<'list' | 'email'>(accounts.length ? 'list' : 'list')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(error ?? null)

  const google = async () => { setBusy(true); setMsg(null); try { await signInWithGoogle() } catch (e) { setMsg((e as Error).message); setBusy(false) } }
  const withEmail = async (kind: 'in' | 'up') => {
    setBusy(true); setMsg(null)
    try {
      if (kind === 'in') { await signInWithPassword(email, password); nav('/') }
      else {
        const r = await signUpWithPassword(email, password)
        if (r === 'signed-in') nav('/')
        else setMsg('Check that inbox for a confirmation link, then sign in here.')
      }
    } catch (e) { setMsg((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <main className="page narrow">
      <h1 className="title">Readers</h1>
      <p className="lede">Each reader keeps their own characters. Books imported on this device are shared by everyone on it.</p>

      {accounts.length ? (
        <ul className="accounts">
          {accounts.map((a) => (
            <li key={a.key} className={a.key === active?.key ? 'on' : ''}>
              <button className="acct" onClick={() => { setActive(a.key); nav('/') }}>
                <span className="avatar">{a.name.slice(0, 1).toUpperCase()}</span>
                <span><b>{a.name}</b><small>{a.email}</small></span>
                {a.key === active?.key ? <em>Reading</em> : null}
              </button>
              <button className="link" onClick={() => { if (confirm(`Sign ${a.name} out on this device? Their characters stay saved in their account.`)) void signOut(a.key) }}>Sign out</button>
            </li>
          ))}
        </ul>
      ) : null}

      <h2 className="h2">{accounts.length ? 'Add a reader' : 'Sign in'}</h2>
      {mode === 'list' ? (
        <div className="stack">
          <button className="primary" disabled={busy} onClick={google}>Continue with Google</button>
          <button className="ghost" onClick={() => setMode('email')}>Use email and password</button>
        </div>
      ) : (
        <form className="stack" onSubmit={(e) => { e.preventDefault(); void withEmail('in') }}>
          <input type="email" autoComplete="username" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" autoComplete="current-password" placeholder="Password (6+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          <button className="primary" disabled={busy}>Sign in</button>
          <button type="button" className="ghost" disabled={busy} onClick={() => void withEmail('up')}>Create an account</button>
          <button type="button" className="link" onClick={() => setMode('list')}>Back</button>
        </form>
      )}
      {msg ? <p className="msg">{msg}</p> : null}
      {active ? <button className="link back" onClick={() => nav('/')}>Back to the library</button> : null}
    </main>
  )
}
