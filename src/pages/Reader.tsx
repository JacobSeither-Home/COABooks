import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ActionChart from '../components/ActionChart'
import BookHtml from '../components/BookHtml'
import Combat from '../components/Combat'
import Dice from '../components/Dice'
import { abilityNames, baseCs, enterSection, maxEp, nextBookId, type Character } from '../lib/character'
import { useBook, useLibrary } from '../lib/hooks'
import { eraOf } from '../lib/rules/eras'
import { saveCharacter, useCharacter } from '../lib/store'

type Sheet = null | 'chart' | 'pages' | 'dice' | { page: string }

export default function Reader() {
  const { id } = useParams()
  const char = useCharacter(id)
  const book = useBook(char?.book)
  const library = useLibrary()
  const nav = useNavigate()
  const [sheet, setSheet] = useState<Sheet>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [turnTo, setTurnTo] = useState('')
  const [fight, setFight] = useState(false)
  const [lastRoll, setLastRoll] = useState<number | null>(null)
  const top = useRef<HTMLDivElement>(null)

  useEffect(() => { setFight(false); setLastRoll(null); top.current?.scrollIntoView() }, [char?.section, char?.book])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2600); return () => clearTimeout(t) }, [toast])

  if (!char) return <main className="page"><p>That adventurer isn’t on this account. <Link to="/">Library</Link></p></main>
  if (book === undefined) return <main className="page"><p>Opening the book…</p></main>
  if (book === null) return (
    <main className="page narrow">
      <p>{char.name} is in a book that isn’t on this device yet.</p>
      <Link className="primary" to="/import">Import books</Link>
    </main>
  )

  const era = eraOf(char.book)
  const s = char.state
  const n = parseInt(char.section, 10)
  const sec = book.sections[n]
  const save = (c: Character) => saveCharacter(c)
  // The story, then any fight or throw, then the choices.
  const cut = sec ? sec.html.search(/<p class="choice"/) : -1
  const story = sec ? (cut > 0 ? sec.html.slice(0, cut) : sec.html) : ''
  const choices = sec && cut > 0 ? sec.html.slice(cut) : ''

  const go = (to: number) => {
    if (!book.sections[to]) { setToast(`There’s no section ${to} in this book.`); return }
    const { char: next, healed } = enterSection(char, String(to))
    save(next)
    if (healed) setToast(`${eraOf(char.book).healing?.requires}: +${healed} ENDURANCE`)
  }
  const goBack = () => {
    if (char.history.length < 2) return
    const h = char.history.slice(0, -1)
    save({ ...char, section: h[h.length - 1], history: h })
  }
  const restartBook = () => {
    if (!char.start) return
    save({ ...char, state: structuredClone(char.start), section: '1', history: ['1'], dead: false })
    setSheet(null)
  }
  const imported = (library ?? []).map((b) => b.id)
  const nextId = nextBookId(char.book, imported)
  const dead = char.dead || s.ep <= 0

  return (
    <div className="reader">
      <div ref={top} />
      <header className="bar">
        <Link to="/" className="icon-btn" aria-label="Library">‹</Link>
        <button className="bar-title" onClick={() => setSheet('pages')}>
          <span className="eyebrow">{book.title}</span>
          <b>{sec ? `Section ${n}` : char.section}</b>
        </button>
        <button className="icon-btn chart-btn" onClick={() => setSheet('chart')} aria-label="Action Chart">
          <span>{era.stats[0].short} {baseCs(s)}</span>
          <span className={s.ep <= 6 ? 'bad' : ''}>EP {s.ep}/{maxEp(s)}</span>
        </button>
      </header>

      <main className="section">
        {sec ? (
          <>
            <h2 className="sect-num">{n}</h2>
            <BookHtml bookId={book.id} html={story} onSection={go} onPage={(p) => setSheet({ page: p })}
              abilities={book.abilities} owned={abilityNames(s)} />

            {sec.combats.length || fight ? (
              <Combat key={`${char.book}-${n}`} char={char} enemies={sec.combats} immune={!!sec.immune} onChange={save} />
            ) : (
              <button className="link add-fight" onClick={() => setFight(true)}>Fight here</button>
            )}

            {sec.random ? (
              <section className="inline-dice">
                <div className="eyebrow">Random Number Table</div>
                <Dice onRoll={setLastRoll} prompt="Throw for the number the text asks for" height={140} />
                {lastRoll != null ? <p className="rolled-num">You threw <b>{lastRoll}</b></p> : null}
              </section>
            ) : null}

            {choices ? (
              <BookHtml bookId={book.id} html={choices} onSection={go} onPage={(p) => setSheet({ page: p })}
                abilities={book.abilities} owned={abilityNames(s)} className="choices" />
            ) : null}

            {dead ? (
              <section className="ending bad">
                <h3>Your adventure ends here</h3>
                <div className="stack">
                  {char.start ? <button className="primary" onClick={restartBook}>Start {book.title} again</button> : null}
                  {char.history.length > 1 ? <button className="ghost" onClick={() => { save({ ...char, dead: false, state: { ...s, ep: Math.max(1, s.ep) } }); goBack() }}>Go back one section</button> : null}
                </div>
                <p className="note">Starting again restores the Action Chart from the start of this book.</p>
              </section>
            ) : sec.end === 'death' ? (
              <section className="ending bad">
                <h3>Your adventure ends here</h3>
                <div className="stack">
                  {char.start ? <button className="primary" onClick={restartBook}>Start {book.title} again</button> : null}
                  <button className="ghost" onClick={goBack}>Go back one section</button>
                </div>
              </section>
            ) : sec.end === 'win' ? (
              <section className="ending good">
                <h3>{book.title} complete</h3>
                {nextId ? <button className="primary" onClick={() => nav(`/next/${char.id}`)}>Carry on to the next book</button>
                  : <p className="note">{char.book.endsWith('dotd') ? 'This is a stand-alone adventure.' : 'The next book isn’t on this device, or this is the last one.'}</p>}
              </section>
            ) : sec.end === 'end' ? (
              <p className="note center">No link onward here. If the text gives you a number, enter it below.</p>
            ) : null}
          </>
        ) : (
          <p>Section {char.section} isn’t in this book.</p>
        )}
      </main>

      <nav className="dock">
        <button className="icon-btn" onClick={goBack} disabled={char.history.length < 2} aria-label="Previous section">↶</button>
        <form className="turn" onSubmit={(e) => { e.preventDefault(); const t = parseInt(turnTo, 10); if (t) { go(t); setTurnTo('') } }}>
          <input inputMode="numeric" pattern="[0-9]*" placeholder="Turn to…" value={turnTo} onChange={(e) => setTurnTo(e.target.value.replace(/\D/g, ''))} />
          <button className="primary small" disabled={!turnTo}>Go</button>
        </form>
        <button className="icon-btn" onClick={() => setSheet('dice')} aria-label="Die">⬟</button>
      </nav>

      {toast ? <div className="toast">{toast}</div> : null}

      {sheet ? (
        <div className="sheet-wrap" onClick={() => setSheet(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <b>{sheet === 'chart' ? `${char.name} · Action Chart` : sheet === 'pages' ? book.title : sheet === 'dice' ? 'Random Number' : book.pages[sheet.page]?.title}</b>
              <button className="link" onClick={() => setSheet(typeof sheet === 'object' ? 'pages' : null)}>{typeof sheet === 'object' ? 'Back' : 'Done'}</button>
            </div>
            <div className="sheet-body">
              {sheet === 'chart' ? (
                <>
                  <ActionChart char={char} onChange={save} abilities={book.abilities} />
                  {char.start ? <button className="link danger" onClick={() => { if (confirm(`Start ${book.title} again with the Action Chart as it was at the start?`)) restartBook() }}>Start this book again</button> : null}
                </>
              ) : sheet === 'pages' ? (
                <ul className="page-list">
                  {book.pageOrder.map((p) => <li key={p}><button onClick={() => setSheet({ page: p })}>{book.pages[p].title}</button></li>)}
                </ul>
              ) : sheet === 'dice' ? (
                <>
                  <Dice onRoll={setLastRoll} />
                  {lastRoll != null ? <p className="rolled-num">You threw <b>{lastRoll}</b></p> : null}
                </>
              ) : book.pages[sheet.page] ? (
                <BookHtml bookId={book.id} html={book.pages[sheet.page].html} onPage={(p) => setSheet({ page: p })} />
              ) : <p>That page isn’t in this book.</p>}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
