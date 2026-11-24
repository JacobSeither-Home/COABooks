// Making a character the way the book says: throw for each score, choose abilities from the book's
// own list, then take equipment with the book's Equipment page alongside.
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import ActionChart from '../components/ActionChart'
import BookHtml from '../components/BookHtml'
import Dice from '../components/Dice'
import { beginBook, blankState, maxEp, type Character } from '../lib/character'
import { useBook, useLibrary } from '../lib/hooks'
import { SERIES_LABEL, eraOf } from '../lib/rules/eras'
import { saveCharacter } from '../lib/store'

const STARTS = new Set(['lw/01fftd', 'lw/06tkot', 'lw/13tplor', 'lw/21votm', 'lw/dotd', 'gs/01gstw', 'fw/01hh'])
type Step = 'book' | 'name' | 'stats' | 'abilities' | 'gear'

export default function NewCharacter() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const books = useLibrary()
  const [bookId, setBookId] = useState<string | null>(params.get('book'))
  const [step, setStep] = useState<Step>(params.get('book') ? 'name' : 'book')
  const book = useBook(bookId ?? undefined)
  const era = bookId ? eraOf(bookId) : null
  const [char, setChar] = useState<Character | null>(() => (params.get('book') ? makeChar(params.get('book')!) : null))
  const [rolls, setRolls] = useState<number[]>([])
  const [weaponRoll, setWeaponRoll] = useState<number | null>(null)

  const choose = (id: string) => {
    setBookId(id)
    setChar(makeChar(id))
    setRolls([]); setStep('name')
  }

  if (!books) return <main className="page"><p>Loading…</p></main>

  if (step === 'book' || !char || !era) {
    return (
      <main className="page narrow">
        <button className="link back" onClick={() => nav('/')}>‹ Library</button>
        <h1 className="title">Where to begin</h1>
        <p className="lede">Start at the beginning of a series, or at the first book of a later era with a new character.</p>
        {(['lw', 'dd', 'gs', 'fw'] as const).map((series) => {
          const list = books.filter((b) => eraOf(b.id).series === series)
          if (!list.length) return null
          return (
            <section key={series} className="shelf">
              <h3>{SERIES_LABEL[series]}</h3>
              <ul className="pick-list">
                {list.map((b) => (
                  <li key={b.id}><button className={STARTS.has(b.id) ? 'start' : ''} onClick={() => choose(b.id)}>
                    <span>{b.title}</span>{STARTS.has(b.id) ? <em>{eraOf(b.id).label}</em> : null}
                  </button></li>
                ))}
              </ul>
            </section>
          )
        })}
      </main>
    )
  }

  const s = char.state
  const update = (c: Character) => setChar(c)
  const back = (to: Step) => <button className="link back" onClick={() => setStep(to)}>‹ Back</button>

  if (step === 'name') {
    return (
      <main className="page narrow">
        {back('book')}
        <div className="eyebrow">{book?.title} · {era.label}</div>
        <h1 className="title">Name your {era.hero === 'Grand Master' ? 'Grand Master' : 'hero'}</h1>
        <input className="wide big-input" value={char.name} onChange={(e) => update({ ...char, name: e.target.value })} autoFocus />
        {book?.pages.tssf ? <details className="rules"><summary>{book.pages.tssf.title}</summary><BookHtml bookId={book.id} html={book.pages.tssf.html} /></details> : null}
        <button className="primary block-btn" disabled={!char.name.trim()} onClick={() => setStep('stats')}>Next</button>
      </main>
    )
  }

  if (step === 'stats') {
    const next = era.stats[rolls.length]
    const onRoll = (n: number) => {
      const stat = era.stats[rolls.length]
      const v = stat.add + n
      const st = { ...s }
      if (stat.id === 'cs') st.cs = v
      if (stat.id === 'ep') { st.epBase = v; st.ep = v }
      if (stat.id === 'wp') { st.wpBase = v; st.wp = v }
      setRolls([...rolls, n]); update({ ...char, state: st })
    }
    return (
      <main className="page narrow">
        {back('name')}
        <h1 className="title">Throw for your scores</h1>
        {book?.pages.gamerulz ? <details className="rules"><summary>The book’s rules</summary><BookHtml bookId={book.id} html={book.pages.gamerulz.html} /></details> : null}
        <ul className="rolled">
          {era.stats.map((st, i) => (
            <li key={st.id} className={i === rolls.length ? 'now' : ''}>
              <span>{st.label}</span>
              <b>{rolls[i] != null ? `${st.add} + ${rolls[i]} = ${st.add + rolls[i]}` : `${st.add} + ?`}</b>
            </li>
          ))}
        </ul>
        {next ? <Dice key={rolls.length} onRoll={onRoll} prompt={`Throw for ${next.label}`} />
          : <button className="primary block-btn" onClick={() => setStep('abilities')}>Next</button>}
        {rolls.length ? <button className="link" onClick={() => { setRolls([]); update({ ...char, state: blankState(era.id) }) }}>Start the throws again</button> : null}
      </main>
    )
  }

  if (step === 'abilities') {
    const list = book?.abilities ?? []
    const page = book && (book.pages.discplnz ?? book.pages.powers ?? book.pages.sskills)
    const picked = s.abilities.map((a) => a.name)
    const spent = Object.values(s.skills).reduce((n, v) => n + v - (era.pointsBase ?? 0), 0)
    const ready = era.abilityMode === 'points' ? spent === era.startPicks : picked.length === era.startPicks
    const toggle = (name: string) => {
      const abilities = picked.includes(name) ? s.abilities.filter((a) => a.name !== name)
        : picked.length < era.startPicks ? [...s.abilities, { name, era: era.id }] : s.abilities
      update({ ...char, state: { ...s, abilities } })
    }
    const skillVal = (n: string) => s.skills[n] ?? era.pointsBase ?? 0
    const needsWeapon = era.weaponBonus && picked.some((p) => p.startsWith(era.weaponBonus!.requires))
    return (
      <main className="page narrow">
        {back('stats')}
        <h1 className="title">{era.abilityLabel}</h1>
        {era.abilityMode === 'points' ? (
          <>
            <p className="lede">Each skill starts at {era.pointsBase}. Add {era.startPicks} more points: {era.startPicks - spent} left.</p>
            <ul className="pick-grid">
              {list.map((n) => (
                <li key={n} className="skill">
                  <span>{n}</span>
                  <div className="stepper">
                    <button disabled={skillVal(n) <= (era.pointsBase ?? 0)} onClick={() => update({ ...char, state: { ...s, skills: { ...s.skills, [n]: skillVal(n) - 1 } } })}>−</button>
                    <b>{skillVal(n)}</b>
                    <button disabled={spent >= era.startPicks} onClick={() => update({ ...char, state: { ...s, skills: { ...s.skills, [n]: skillVal(n) + 1 } } })}>+</button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <p className="lede">Choose {era.startPicks}: {era.startPicks - picked.length} left.</p>
            <ul className="pick-grid">
              {list.map((n) => (
                <li key={n}><button className={picked.includes(n) ? 'on' : ''} onClick={() => toggle(n)}>{n}</button></li>
              ))}
            </ul>
          </>
        )}
        {needsWeapon ? (
          <section className="block">
            <h4>{era.weaponBonus!.requires}</h4>
            <p className="note">The book explains how to choose your weapon{era.id === 'kai' ? ' — for Weaponskill, throw the die and look it up in the list' : 's'}.</p>
            {era.id === 'kai' ? <Dice onRoll={(n) => { setWeaponRoll(n); update({ ...char, state: { ...s, notes: `${s.notes}${s.notes ? '\n' : ''}Weaponskill throw: ${n}` } }) }} prompt="Throw for your weapon" height={130} /> : null}
            {weaponRoll != null ? <p className="rolled-num">You threw <b>{weaponRoll}</b> — find it in the list below.</p> : null}
            <WeaponInput values={s.weaponSkills} onChange={(weaponSkills) => update({ ...char, state: { ...s, weaponSkills } })} />
          </section>
        ) : null}
        {page ? <details className="rules" open><summary>{page.title}</summary><BookHtml bookId={book!.id} html={page.html} /></details> : null}
        <button className="primary block-btn sticky" disabled={!ready} onClick={() => {
          if (era.abilityMode === 'points') update({ ...char, state: { ...s, skills: Object.fromEntries(list.map((n) => [n, skillVal(n)])) } })
          setStep('gear')
        }}>Next</button>
      </main>
    )
  }

  // gear
  return (
    <main className="page narrow">
      {back('abilities')}
      <h1 className="title">Equipment</h1>
      <p className="lede">Follow the book’s Equipment page. Use the die for any random picks.</p>
      {book?.pages.equipmnt ? <details className="rules" open><summary>{book.pages.equipmnt.title}</summary><BookHtml bookId={book.id} html={book.pages.equipmnt.html} /></details> : null}
      <Dice onRoll={() => undefined} prompt="A die for the equipment rolls" height={130} />
      <ActionChart char={char} onChange={update} abilities={book?.abilities} />
      <Begin char={char} onBegin={(c) => { saveCharacter(c); nav(`/play/${c.id}`, { replace: true }) }} />
    </main>
  )
}

function makeChar(id: string): Character {
  const e = eraOf(id)
  return { id: crypto.randomUUID(), series: e.series, name: e.hero, book: id, section: '1', state: blankState(e.id), history: [], finished_books: [], dead: false }
}

function Begin({ char, onBegin }: { char: Character; onBegin: (c: Character) => void }) {
  const ready = useMemo(() => maxEp(char.state) > 0 && char.state.cs > 0, [char])
  return <button className="primary block-btn sticky" disabled={!ready} onClick={() => onBegin(beginBook(char, char.book))}>Begin at section 1</button>
}

function WeaponInput({ values, onChange }: { values: string[]; onChange: (v: string[]) => void }) {
  const [v, setV] = useState('')
  return (
    <div className="add-row">
      <ul className="tags">{values.map((x, i) => <li key={i}>{x}<button onClick={() => onChange(values.filter((_, j) => j !== i))}>×</button></li>)}</ul>
      <input value={v} placeholder="Weapon (e.g. Sword)" onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && v.trim()) { onChange([...values, v.trim()]); setV('') } }} />
      <button className="ghost small" onClick={() => { if (v.trim()) { onChange([...values, v.trim()]); setV('') } }}>Add</button>
    </div>
  )
}

