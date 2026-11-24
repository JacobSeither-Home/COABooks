import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ActionChart from '../components/ActionChart'
import BookHtml from '../components/BookHtml'
import Combat from '../components/Combat'
import CornerMenu, { ICONS } from '../components/CornerMenu'
import Dice from '../components/Dice'
import Inventory from '../components/Inventory'
import ItemPrompt from '../components/ItemPrompt'
import { abilityNames, baseCs, enterSection, maxEp, maxWp, nextBookId, type Character } from '../lib/character'
import { useBook, useLibrary } from '../lib/hooks'
import type { ItemGuess } from '../lib/items'
import { eraOf } from '../lib/rules/eras'
import { setSetting, useSettings } from '../lib/settings'
import { setSoundOn, soundOn } from '../lib/sound'
import { saveCharacter, useCharacter } from '../lib/store'

type Sheet = null | 'chart' | 'pack' | 'pages' | 'dice' | 'turn' | 'settings' | { page: string }

/** Pages that come before section 1, in reading order, when the book has them. */
const OPENING = ['tssf']

export default function Reader() {
  const { id } = useParams()
  const char = useCharacter(id)
  const book = useBook(char?.book)
  const library = useLibrary()
  const nav = useNavigate()
  const settings = useSettings()
  const [sheet, setSheet] = useState<Sheet>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [turnTo, setTurnTo] = useState('')
  const [fight, setFight] = useState(false)
  const [lastRoll, setLastRoll] = useState<number | null>(null)
  const [item, setItem] = useState<ItemGuess | null>(null)
  const top = useRef<HTMLDivElement>(null)

  useEffect(() => { setFight(false); setLastRoll(null); top.current?.scrollIntoView(); document.querySelectorAll('.leaf').forEach((l) => l.scrollTo(0, 0)) }, [char?.section, char?.book])
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
  const opening = OPENING.filter((p) => book.pages[p])
  const inIntro = char.section === 'intro' && opening.length > 0
  const n = char.section === 'intro' ? 1 : parseInt(char.section, 10)
  const sec = inIntro ? undefined : book.sections[n]
  const save = (c: Character) => saveCharacter(c)
  // The story, then any fight or throw, then the choices.
  const cut = sec ? sec.html.search(/<p class="choice"/) : -1
  const story = sec ? (cut > 0 ? sec.html.slice(0, cut) : sec.html) : ''
  const choices = sec && cut > 0 ? sec.html.slice(cut) : ''

  const go = (to: number) => {
    if (!book.sections[to]) { setToast(`There’s no section ${to} in this book.`); return }
    if (inIntro) { save({ ...char, section: String(to), history: [String(to)] }); return }
    const { char: next, healed } = enterSection(char, String(to))
    save(next)
    if (healed) setToast(`${era.healing?.requires}: +${healed} ENDURANCE`)
  }
  const goBack = () => {
    if (char.history.length < 2) return
    const h = char.history.slice(0, -1)
    save({ ...char, section: h[h.length - 1], history: h })
  }
  const restartBook = () => {
    if (!char.start) return
    save({ ...char, state: structuredClone(char.start), section: opening.length ? 'intro' : '1', history: [], dead: false })
    setSheet(null)
  }
  const imported = (library ?? []).map((b) => b.id)
  const nextId = nextBookId(char.book, imported)
  const dead = char.dead || s.ep <= 0
  const atStart = !inIntro && char.history.length <= 1 && n === 1

  const spots = [
    { id: 'dice', label: 'Die', icon: ICONS.die, onPick: () => setSheet('dice') },
    { id: 'pack', label: 'Pack', icon: ICONS.pack, onPick: () => setSheet('pack') },
    { id: 'chart', label: 'Chart', icon: ICONS.chart, onPick: () => setSheet('chart') },
    { id: 'turn', label: 'Turn to', icon: ICONS.turn, onPick: () => setSheet('turn') },
    { id: 'back', label: 'Back', icon: ICONS.back, onPick: goBack, disabled: char.history.length < 2 },
    { id: 'book', label: 'Book', icon: ICONS.book, onPick: () => setSheet('pages') },
    { id: 'gear', label: 'Options', icon: ICONS.gear, onPick: () => setSheet('settings') },
    { id: 'home', label: 'Library', icon: ICONS.home, onPick: () => nav('/') },
  ]

  return (
    <div className={`reader ${settings.worn ? 'worn' : ''}`} data-series={era.series}>
      {settings.candle ? <div className="candle" aria-hidden><i /><b /></div> : null}
      <div ref={top} />
      <header className="bar">
        <Link to="/" className="icon-btn" aria-label="Library">‹</Link>
        <button className="bar-title" onClick={() => setSheet('pages')}>
          <span className="eyebrow">{book.title}</span>
          <b>{inIntro ? book.pages[opening[0]]?.title : sec ? `Section ${n}` : char.section}</b>
        </button>
        <button className="icon-btn chart-btn" onClick={() => setSheet('chart')} aria-label="Action Chart">
          <span>{era.stats[0].short} {baseCs(s)}</span>
          <span className={s.ep <= 6 ? 'bad' : ''}>EP {s.ep}/{maxEp(s)}</span>
        </button>
      </header>

      <div className="spread" key={`${char.book}-${char.section}`}>
        {inIntro ? (
          <>
            <article className="leaf leaf-story">
              {opening.map((p) => (
                <section key={p} className="opening">
                  <BookHtml bookId={book.id} html={book.pages[p].html} onPage={(x) => setSheet({ page: x })} />
                </section>
              ))}
            </article>
            <aside className="leaf leaf-act">
              <section className="begin-card">
                <div className="eyebrow">{book.title}</div>
                <h3>Your adventure begins</h3>
                <p>Read the story so far, then turn to section 1. The book’s rules and Equipment pages are under Book in the menu.</p>
                <button className="primary glow" onClick={() => go(1)}>Turn to section 1</button>
              </section>
              <ChartGlance char={char} onOpen={() => setSheet('chart')} />
            </aside>
          </>
        ) : sec ? (
          <>
            <article className="leaf leaf-story">
              <div className="sect-head"><span>{n}</span></div>
              <BookHtml bookId={book.id} html={story} onSection={go} onPage={(p) => setSheet({ page: p })}
                abilities={book.abilities} owned={abilityNames(s)} onItem={setItem} />
              {atStart && opening.length ? <button className="link small reread" onClick={() => save({ ...char, section: 'intro' })}>Read the story so far</button> : null}
            </article>
            <aside className="leaf leaf-act">
              {sec.combats.length || fight ? (
                <Combat key={`${char.book}-${n}`} char={char} enemies={sec.combats} immune={!!sec.immune} onChange={save} />
              ) : null}

              {sec.random ? (
                <section className="inline-dice">
                  <div className="eyebrow">Random Number Table</div>
                  <Dice onRoll={setLastRoll} prompt="Throw for the number the text asks for" height={160} />
                  {lastRoll != null ? <p className="rolled-num">You threw <b>{lastRoll}</b></p> : null}
                </section>
              ) : null}

              {choices ? (
                <BookHtml bookId={book.id} html={choices} onSection={go} onPage={(p) => setSheet({ page: p })}
                  abilities={book.abilities} owned={abilityNames(s)} className="choices" />
              ) : null}

              {dead ? (
                <section className="ending bad">
                  <div className="ending-mark">☠</div>
                  <h3>Your adventure ends here</h3>
                  <div className="stack">
                    {char.start ? <button className="primary" onClick={restartBook}>Start {book.title} again</button> : null}
                    {char.history.length > 1 ? <button className="ghost" onClick={() => { save({ ...char, dead: false, state: { ...s, ep: Math.max(1, s.ep) } }); goBack() }}>Go back one section</button> : null}
                  </div>
                  <p className="note">Starting again restores the Action Chart from the start of this book.</p>
                </section>
              ) : sec.end === 'death' ? (
                <section className="ending bad">
                  <div className="ending-mark">☠</div>
                  <h3>Your adventure ends here</h3>
                  <div className="stack">
                    {char.start ? <button className="primary" onClick={restartBook}>Start {book.title} again</button> : null}
                    <button className="ghost" onClick={goBack}>Go back one section</button>
                  </div>
                </section>
              ) : sec.end === 'win' ? (
                <section className="ending good">
                  <div className="ending-mark">✦</div>
                  <h3>{book.title} complete</h3>
                  {nextId ? <button className="primary glow" onClick={() => nav(`/next/${char.id}`)}>Carry on to the next book</button>
                    : <p className="note">{char.book.endsWith('dotd') ? 'This is a stand-alone adventure.' : 'The next book isn’t on this device, or this is the last one.'}</p>}
                </section>
              ) : sec.end === 'end' ? (
                <div className="no-link">
                  <p>No link onward here. If the text gives you a number, turn to it.</p>
                  <button className="ghost small" onClick={() => setSheet('turn')}>Turn to…</button>
                </div>
              ) : null}

              {!sec.combats.length && !fight ? <button className="link add-fight" onClick={() => setFight(true)}>⚔ Fight here</button> : null}

              <ChartGlance char={char} onOpen={() => setSheet('pack')} />
            </aside>
          </>
        ) : (
          <p className="leaf">Section {char.section} isn’t in this book.</p>
        )}
      </div>

      <CornerMenu spots={spots} />

      {toast ? <div className="toast">{toast}</div> : null}
      {item ? <ItemPrompt guess={item} char={char} onCancel={() => setItem(null)} onDone={(c, msg) => { save(c); setItem(null); setToast(msg) }} /> : null}

      {sheet ? (
        <div className="sheet-wrap" onClick={() => setSheet(null)}>
          <div className={`sheet ${sheet === 'turn' ? 'small' : ''}`} onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <b>{sheet === 'chart' ? `${char.name} · Action Chart` : sheet === 'pack' ? `${char.name} · Pack` : sheet === 'pages' ? book.title
                : sheet === 'dice' ? 'Random Number' : sheet === 'turn' ? 'Turn to section' : sheet === 'settings' ? 'Settings' : book.pages[sheet.page]?.title}</b>
              <button className="link" onClick={() => setSheet(typeof sheet === 'object' ? 'pages' : null)}>{typeof sheet === 'object' ? 'Back' : 'Done'}</button>
            </div>
            <div className="sheet-body">
              {sheet === 'chart' ? (
                <>
                  <ActionChart char={char} onChange={save} abilities={book.abilities} />
                  {char.start ? <button className="link danger" onClick={() => { if (confirm(`Start ${book.title} again with the Action Chart as it was at the start?`)) restartBook() }}>Start this book again</button> : null}
                </>
              ) : sheet === 'pack' ? (
                <Inventory char={char} onChange={save} />
              ) : sheet === 'pages' ? (
                <ul className="page-list">
                  {book.pageOrder.map((p) => <li key={p}><button onClick={() => setSheet({ page: p })}>{book.pages[p].title}</button></li>)}
                </ul>
              ) : sheet === 'dice' ? (
                <>
                  <Dice onRoll={setLastRoll} height={220} />
                  {lastRoll != null ? <p className="rolled-num">You threw <b>{lastRoll}</b></p> : null}
                </>
              ) : sheet === 'turn' ? (
                <form className="turn-form" onSubmit={(e) => { e.preventDefault(); const t = parseInt(turnTo, 10); if (t) { go(t); setTurnTo(''); setSheet(null) } }}>
                  <input autoFocus inputMode="numeric" pattern="[0-9]*" placeholder={`1–${book.lastSection}`} value={turnTo} onChange={(e) => setTurnTo(e.target.value.replace(/\D/g, ''))} />
                  <button className="primary" disabled={!turnTo}>Go</button>
                </form>
              ) : sheet === 'settings' ? (
                <SettingsPanel />
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

function SettingsPanel() {
  const st = useSettings()
  const [sound, setSound] = useState(soundOn())
  return (
    <div className="settings">
      <Toggle label="Candlelight" note="A flickering glow from off the edge of the page." on={st.candle} set={(v) => setSetting('candle', v)} />
      <Toggle label="Worn pages" note="Aged paper at the edges. The words stay crisp either way." on={st.worn} set={(v) => setSetting('worn', v)} />
      <Toggle label="Dice sound" note="Clacks on the felt and knocks on the rim." on={sound} set={(v) => { setSound(v); setSoundOn(v) }} />
    </div>
  )
}

function Toggle({ label, note, on, set }: { label: string; note: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <label className="toggle">
      <span><b>{label}</b><small>{note}</small></span>
      <input type="checkbox" role="switch" checked={on} onChange={(e) => set(e.target.checked)} />
      <i aria-hidden />
    </label>
  )
}

/** Beside the story: the Action Chart at a glance. */
function ChartGlance({ char, onOpen }: { char: Character; onOpen: () => void }) {
  const s = char.state
  const era = eraOf(char.book)
  const max = maxEp(s)
  const pct = Math.max(0, Math.min(100, (s.ep / Math.max(1, max)) * 100))
  return (
    <button className="glance" onClick={onOpen}>
      <div className="glance-head"><span className="eyebrow">Action Chart</span><span className="link small">Pack ›</span></div>
      <div className="glance-stats">
        <div className="medal big"><span>{era.stats[0].short}</span><b>{baseCs(s)}</b></div>
        <div className="glance-ep">
          <div className="ep-line"><span className="ep-bar"><i style={{ width: `${pct}%` }} className={pct < 30 ? 'low' : ''} /></span><b>{s.ep}</b>/{max} EP</div>
          {s.wpBase != null ? <div className="ep-line wp"><span className="ep-bar"><i style={{ width: `${Math.max(0, Math.min(100, ((s.wp ?? 0) / Math.max(1, maxWp(s))) * 100))}%` }} /></span><b>{s.wp}</b>/{maxWp(s)} WP</div> : null}
        </div>
      </div>
      {s.abilities.length ? <div className="glance-row"><span>{era.abilityLabel}</span>{s.abilities.map((a) => a.name.replace(/\s*\(.*\)$/, '')).join(' · ')}</div> : null}
      {Object.keys(s.skills).length ? <div className="glance-row"><span>{era.abilityLabel}</span>{Object.entries(s.skills).map(([k, v]) => `${k} ${v}`).join(' · ')}</div> : null}
      {s.weapons.length ? <div className="glance-row"><span>Weapons</span>{s.weapons.map((w) => w.name).join(' · ')}</div> : null}
      {s.backpack.length || s.counters.meals ? <div className="glance-row"><span>Backpack</span>{[...s.backpack.map((w) => w.name), ...(s.counters.meals ? [`${s.counters.meals} Meal${s.counters.meals > 1 ? 's' : ''}`] : [])].join(' · ')}</div> : null}
      {s.special.length ? <div className="glance-row"><span>Special</span>{s.special.map((w) => w.name).join(' · ')}</div> : null}
      <div className="glance-row counters">{era.counters.filter((c) => c.id !== 'meals').map((c) => <span key={c.id}>{c.label} <b>{s.counters[c.id] ?? 0}</b></span>)}</div>
    </button>
  )
}
