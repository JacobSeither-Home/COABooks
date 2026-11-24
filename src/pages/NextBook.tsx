// Carrying a character on to the next book: new abilities as the book allows (a whole new set when
// the era changes, e.g. Kai to Magnakai), then equipment, with the book's own pages alongside.
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ActionChart from '../components/ActionChart'
import BookHtml from '../components/BookHtml'
import Dice from '../components/Dice'
import { abilityNames, beginBook, nextBookId, type Character } from '../lib/character'
import { useBook, useLibrary } from '../lib/hooks'
import { eraOf } from '../lib/rules/eras'
import { saveCharacter, useCharacter } from '../lib/store'

export default function NextBook() {
  const { id } = useParams()
  const nav = useNavigate()
  const char = useCharacter(id)
  const library = useLibrary()
  const nextId = char && library ? nextBookId(char.book, library.map((b) => b.id)) : null
  const next = useBook(nextId ?? undefined)
  const [draft, setDraft] = useState<Character | null>(null)
  const [step, setStep] = useState<'abilities' | 'gear'>('abilities')

  if (!char || !library) return <main className="page"><p>Loading…</p></main>
  if (!nextId) return <main className="page narrow"><p>The next book isn’t on this device.</p><button className="link" onClick={() => nav(-1)}>Back</button></main>
  if (!next) return <main className="page"><p>Opening the next book…</p></main>

  const from = eraOf(char.book), to = eraOf(nextId)
  const newEra = from.id !== to.id
  const c = draft ?? { ...char, book: nextId, state: { ...char.state, era: to.id } }
  const s = c.state
  const owned = abilityNames(s)
  const gainedThisEra = s.abilities.filter((a) => a.era === to.id && !char.state.abilities.some((b) => b.name === a.name)).length
  const allowed = newEra ? to.startPicks : to.perBookPicks
  const set = (x: Character) => setDraft(x)
  const page = next.pages.discplnz ?? next.pages.powers ?? next.pages.sskills
  const improved = next.pages.imprvdsc

  if (step === 'abilities') {
    return (
      <main className="page narrow">
        <button className="link back" onClick={() => nav(-1)}>‹ Back</button>
        <div className="eyebrow">Next: {next.title}</div>
        <h1 className="title">{newEra ? `The ${to.label.replace(/ \(.*/, '')} era begins` : 'A new discipline'}</h1>
        <p className="lede">
          {to.abilityMode === 'points'
            ? `The book lets you add ${allowed} Survival Skill points.`
            : newEra ? `Choose ${allowed} ${to.abilityLabel}. Your earlier ones stay on your chart.` : `You may add ${allowed} ${to.abilityLabel.replace(/s$/, '')} for completing ${char.book === nextId ? 'the book' : 'the last book'}.`}
          {' '}The book’s own pages below have the details.
        </p>
        {to.abilityMode === 'points' ? (
          <ul className="pick-grid">
            {next.abilities.map((name) => (
              <li key={name} className="skill"><span>{name}</span>
                <div className="stepper">
                  <button onClick={() => set({ ...c, state: { ...s, skills: { ...s.skills, [name]: Math.max(0, (s.skills[name] ?? 0) - 1) } } })}>−</button>
                  <b>{s.skills[name] ?? 0}</b>
                  <button onClick={() => set({ ...c, state: { ...s, skills: { ...s.skills, [name]: (s.skills[name] ?? 0) + 1 } } })}>+</button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="pick-grid">
            {next.abilities.map((name) => {
              const mine = owned.includes(name)
              const fresh = s.abilities.some((a) => a.name === name && !char.state.abilities.some((b) => b.name === name))
              return (
                <li key={name}><button className={mine ? 'on' : ''} disabled={mine && !fresh}
                  onClick={() => {
                    if (fresh) set({ ...c, state: { ...s, abilities: s.abilities.filter((a) => a.name !== name) } })
                    else if (!mine && gainedThisEra < allowed) set({ ...c, state: { ...s, abilities: [...s.abilities, { name, era: to.id }] } })
                  }}>{name}</button></li>
              )
            })}
          </ul>
        )}
        {to.weaponBonus && newEra ? (
          <p className="note">If you took {to.weaponBonus.requires}, list your weapons on the Action Chart in the next step.</p>
        ) : null}
        {next.pages.gamerulz ? <details className="rules"><summary>{next.pages.gamerulz.title}</summary><BookHtml bookId={next.id} html={next.pages.gamerulz.html} /></details> : null}
        {page ? <details className="rules" open={newEra}><summary>{page.title}</summary><BookHtml bookId={next.id} html={page.html} /></details> : null}
        {improved ? <details className="rules"><summary>{improved.title}</summary><BookHtml bookId={next.id} html={improved.html} /></details> : null}
        {next.pages.levels ? <details className="rules"><summary>{next.pages.levels.title}</summary><BookHtml bookId={next.id} html={next.pages.levels.html} /></details> : null}
        <button className="primary block-btn sticky" onClick={() => setStep('gear')}>Next</button>
      </main>
    )
  }

  return (
    <main className="page narrow">
      <button className="link back" onClick={() => setStep('abilities')}>‹ Back</button>
      <div className="eyebrow">Next: {next.title}</div>
      <h1 className="title">Equipment</h1>
      <p className="lede">Your items carry over. The book may offer more; use the die for any random picks.</p>
      {next.pages.equipmnt ? <details className="rules" open><summary>{next.pages.equipmnt.title}</summary><BookHtml bookId={next.id} html={next.pages.equipmnt.html} /></details> : null}
      <Dice onRoll={() => undefined} prompt="A die for the equipment rolls" height={130} />
      <ActionChart char={c} onChange={set} abilities={next.abilities} />
      <button className="primary block-btn sticky" onClick={() => {
        const done: Character = { ...c, finished_books: [...new Set([...char.finished_books, char.book])] }
        const started = beginBook(done, nextId)
        saveCharacter(started)
        nav(`/play/${char.id}`, { replace: true })
      }}>Begin {next.title}</button>
    </main>
  )
}
