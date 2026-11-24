import { Link, useNavigate } from 'react-router-dom'
import { maxEp } from '../lib/character'
import { useLibrary } from '../lib/hooks'
import { SERIES_LABEL, eraOf } from '../lib/rules/eras'
import { deleteCharacter, useAccount, useCharacters } from '../lib/store'

export default function Home() {
  const acct = useAccount()
  const { chars, status } = useCharacters()
  const books = useLibrary()
  const nav = useNavigate()
  const titles = new Map((books ?? []).map((b) => [b.id, b.title]))
  const noBooks = books && !books.length

  return (
    <main className="page">
      <header className="top">
        <div>
          <div className="eyebrow">COA Books</div>
          <h1 className="title">Adventures</h1>
        </div>
        <Link to="/accounts" className="who" aria-label="Readers">
          <span className="avatar">{acct?.name.slice(0, 1).toUpperCase()}</span>
          <span className="who-name">{acct?.name}</span>
        </Link>
      </header>

      {noBooks ? (
        <section className="empty-card">
          <h2>No books on this device yet</h2>
          <p>Import the Project Aon zip from your Google Drive or your Files.</p>
          <Link className="primary" to="/import">Import books</Link>
        </section>
      ) : null}

      {chars.length ? (
        <ul className="chars">
          {chars.map((c) => {
            const era = eraOf(c.book)
            return (
              <li key={c.id} className={c.dead ? 'dead' : ''}>
                <button className="char" onClick={() => nav(`/play/${c.id}`)}>
                  <div className="char-name">{c.name}</div>
                  <div className="char-book">{titles.get(c.book) ?? c.book} · section {c.section}</div>
                  <div className="char-stats">
                    <span>{era.stats[0].short} {c.state.cs}</span>
                    <span>EP {c.state.ep}/{maxEp(c.state)}</span>
                    {c.finished_books.length ? <span>{c.finished_books.length} book{c.finished_books.length > 1 ? 's' : ''} done</span> : null}
                    {c.dead ? <span className="bad">fallen</span> : null}
                  </div>
                </button>
                <button className="link small" onClick={() => { if (confirm(`Delete ${c.name}? This can't be undone.`)) deleteCharacter(c.id) }}>Delete</button>
              </li>
            )
          })}
        </ul>
      ) : books?.length ? <p className="lede">No adventurers yet.</p> : null}

      {books?.length ? <Link className="primary block-btn" to="/new">New adventure</Link> : null}

      {books?.length ? (
        <section className="library">
          <h2 className="h2">Library <small>{books.length} books</small></h2>
          {(['lw', 'dd', 'gs', 'fw'] as const).map((series) => {
            const list = books.filter((b) => eraOf(b.id).series === series)
            if (!list.length) return null
            return (
              <div key={series} className="shelf">
                <h3>{SERIES_LABEL[series]}</h3>
                <ol>{list.map((b) => <li key={b.id}><Link to={`/book/${encodeURIComponent(b.id)}`}>{b.title}</Link></li>)}</ol>
              </div>
            )
          })}
          <Link className="link" to="/import">Import again</Link>
        </section>
      ) : null}
      <footer className="foot">{status === 'offline' ? 'Offline — changes will save when you’re back online.' : status === 'error' ? 'Couldn’t save to your account; will retry.' : status === 'saving' ? 'Saving…' : ''}</footer>
    </main>
  )
}
