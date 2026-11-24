import { Link, useNavigate } from 'react-router-dom'
import BookCover, { useCover } from '../components/BookCover'
import { maxEp, type Character } from '../lib/character'
import type { BookSummary } from '../lib/db'
import { useLibrary } from '../lib/hooks'
import { SERIES_LABEL, eraOf } from '../lib/rules/eras'
import { deleteCharacter, useAccount, useCharacters } from '../lib/store'

const SERIES_TAG: Record<string, string> = { lw: 'The Kai saga', dd: 'A prequel of the Magicians’ Guild', gs: 'The wizard of the Shianti', fw: 'After the fall' }

export default function Home() {
  const acct = useAccount()
  const { chars, status } = useCharacters()
  const books = useLibrary()
  const nav = useNavigate()
  const byId = new Map((books ?? []).map((b) => [b.id, b]))
  const noBooks = books && !books.length
  const [lead, ...rest] = [...chars].sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))

  return (
    <main className="home">
      <header className="hero">
        <div className="embers" aria-hidden><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
        <div className="hero-top">
          <span className="wordmark">COA<span>Books</span></span>
          <Link to="/accounts" className="who" aria-label="Readers">
            <span className="who-name">{acct?.name}</span>
            <span className="avatar">{acct?.name.slice(0, 1).toUpperCase()}</span>
          </Link>
        </div>
        <h1 className="hero-title">Choose your path.</h1>
        <p className="hero-sub">Every choice is yours. Every throw of the die is fate.</p>
      </header>

      <div className="home-body">
        {noBooks ? (
          <section className="empty-card">
            <h2>Your shelves are empty</h2>
            <p>Import the Project Aon zip from Google Drive or Files to fill them.</p>
            <Link className="primary" to="/import">Import books</Link>
          </section>
        ) : null}

        {lead ? (
          <>
            <LeadCard c={lead} book={byId.get(lead.book)} onOpen={() => nav(`/play/${lead.id}`)} />
            <button className="link small lead-del" onClick={() => { if (confirm(`Delete ${lead.name}? This can't be undone.`)) deleteCharacter(lead.id) }}>Delete {lead.name}</button>
          </>
        ) : null}

        {rest.length ? (
          <section className="party">
            <h2 className="h2">Your adventurers</h2>
            <ul className="chars">
              {rest.map((c) => (
                <li key={c.id} className={c.dead ? 'dead' : ''}>
                  <button className="char" onClick={() => nav(`/play/${c.id}`)} data-series={eraOf(c.book).series}>
                    <div className="char-name">{c.name}</div>
                    <div className="char-book">{byId.get(c.book)?.title ?? c.book} · §{c.section}</div>
                    <EpBar c={c} />
                  </button>
                  <button className="link small" onClick={() => { if (confirm(`Delete ${c.name}? This can't be undone.`)) deleteCharacter(c.id) }}>Delete</button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {books?.length ? <Link className="primary block-btn glow" to="/new">⚔ Begin a new adventure</Link> : null}

        {books?.length ? (
          <section className="library">
            {(['lw', 'dd', 'gs', 'fw'] as const).map((series) => {
              const list = books.filter((b) => eraOf(b.id).series === series)
              if (!list.length) return null
              return (
                <div key={series} className="shelf" data-series={series}>
                  <div className="shelf-head">
                    <h3>{SERIES_LABEL[series]}</h3>
                    <span>{SERIES_TAG[series]}</span>
                  </div>
                  <ol className="covers">
                    {list.map((b, i) => (
                      <li key={b.id}>
                        <Link to={`/book/${encodeURIComponent(b.id)}`}>
                          <BookCover bookId={b.id} file={b.cover} title={b.title} num={series === 'dd' ? '' : String(i + 1)} />
                        </Link>
                      </li>
                    ))}
                  </ol>
                </div>
              )
            })}
            <Link className="link" to="/import">Import again</Link>
          </section>
        ) : null}
        <footer className="foot">{status === 'offline' ? 'Offline — changes will save when you’re back online.' : status === 'error' ? 'Couldn’t save to your account; will retry.' : status === 'saving' ? 'Saving…' : ''}</footer>
      </div>
    </main>
  )
}

function EpBar({ c }: { c: Character }) {
  const max = maxEp(c.state), pct = Math.max(0, Math.min(100, (c.state.ep / Math.max(1, max)) * 100))
  const era = eraOf(c.book)
  return (
    <div className="char-stats">
      <span className="medal">{era.stats[0].short} <b>{c.state.cs}</b></span>
      <span className="ep-line"><span className="ep-bar"><i style={{ width: `${pct}%` }} className={pct < 30 ? 'low' : ''} /></span><b>{c.state.ep}</b>/{max}</span>
      {c.dead ? <span className="bad">fallen</span> : null}
    </div>
  )
}

function LeadCard({ c, book, onOpen }: { c: Character; book?: BookSummary; onOpen: () => void }) {
  const art = useCover(book?.id, book?.cover)
  const era = eraOf(c.book)
  return (
    <button className={`lead ${c.dead ? 'dead' : ''}`} onClick={onOpen} data-series={era.series}>
      {art ? <img className="lead-art" src={art} alt="" /> : null}
      <div className="lead-shade" />
      <div className="lead-body">
        <div className="eyebrow">{c.dead ? 'Fallen in' : 'Continue'} · {book?.title ?? c.book}</div>
        <div className="lead-name">{c.name}</div>
        <div className="lead-meta">{era.label} · section {c.section}{c.finished_books.length ? ` · ${c.finished_books.length} book${c.finished_books.length > 1 ? 's' : ''} won` : ''}</div>
        <EpBar c={c} />
        <span className="lead-go">{c.dead ? 'Try again' : 'Read on'} →</span>
      </div>
    </button>
  )
}
