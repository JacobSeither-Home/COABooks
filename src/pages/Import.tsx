import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { driveConfigured } from '../config'
import { activeAccount, activeClient } from '../lib/accounts'
import { importZip, type ImportProgress } from '../lib/book/importZip'
import { keepStorage } from '../lib/db'
import { connectDrive, driveToken, openDriveFile, pickZip } from '../lib/drive'

export default function Import() {
  const nav = useNavigate()
  const [p, setP] = useState<ImportProgress | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState<string[] | null>(null)
  const busy = !!p && !done && !err
  const token = driveToken()

  const run = async (get: () => Promise<{ stream: ReadableStream<Uint8Array>; size: number }>) => {
    setErr(null); setDone(null); setP({ bytes: 0, total: 0, books: [] })
    try {
      await keepStorage()
      const { stream, size } = await get()
      const saved = await importZip(stream, size, setP)
      setDone(saved)
    } catch (e) {
      const m = (e as Error).message
      if (m === 'expired') { connectDrive(activeAccount()?.email); return }
      setErr(m || 'The import stopped.')
    }
  }

  const fromDrive = async () => {
    if (!token) { connectDrive(activeAccount()?.email); return }
    const db = activeClient()
    // Use the file this reader linked before, if there is one.
    const linked = db ? (await db.from('library_links').select('drive_file_id').maybeSingle()).data?.drive_file_id as string | undefined : undefined
    const doc = linked && confirm('Import the books zip you chose before?') ? { id: linked } : await pickZip(token)
    if (!doc) return
    if (db && doc.id !== linked) await db.from('library_links').upsert({ drive_file_id: doc.id, file_name: 'name' in doc ? doc.name : null })
    await run(() => openDriveFile(token, doc.id))
  }

  const fromFile = async (f: File | undefined) => {
    if (!f) return
    await run(async () => ({ stream: f.stream() as ReadableStream<Uint8Array>, size: f.size }))
  }

  const pct = p && p.total ? Math.round((p.bytes / p.total) * 100) : null

  return (
    <main className="page narrow">
      <button className="link back" onClick={() => nav('/')} disabled={busy}>‹ Library</button>
      <h1 className="title">Import books</h1>
      <p className="lede">Choose the Project Aon zip (the XHTML edition). The books are unpacked on this device and stay here; nothing is uploaded.</p>

      {!busy ? (
        <div className="stack">
          {driveConfigured() ? (
            <button className="primary" onClick={() => void fromDrive().catch((e) => setErr((e as Error).message))}>
              {token ? 'Choose from Google Drive' : 'Connect Google Drive'}
            </button>
          ) : null}
          <label className="ghost file-btn">
            Choose from Files
            <input type="file" accept=".zip,application/zip" onChange={(e) => void fromFile(e.target.files?.[0])} />
          </label>
          <p className="note">On iPhone, “Choose from Files” can also open Google Drive if the Google Drive app is installed.</p>
        </div>
      ) : null}

      {p ? (
        <section className="progress">
          <div className="bar"><div style={{ width: `${pct ?? 0}%` }} /></div>
          <p>{pct != null ? `${pct}% read` : 'Reading…'} · {p.books.length} book{p.books.length === 1 ? '' : 's'} saved{p.current ? ` · unpacking ${p.current}` : ''}</p>
          {busy ? <p className="note">Keep the app open until this finishes.</p> : null}
        </section>
      ) : null}
      {done ? <p className="msg good">Imported {done.length} books. <button className="link" onClick={() => nav('/')}>Go to the library</button></p> : null}
      {err ? <p className="msg bad">{err}</p> : null}
    </main>
  )
}
