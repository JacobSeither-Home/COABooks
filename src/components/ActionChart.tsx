// The Action Chart: every score, ability and item, editable, with the series' carrying limits shown.
import { useState } from 'react'
import { abilityNames, baseCs, maxEp, maxWp, type Bonus, type Character, type CharState } from '../lib/character'
import { ERAS, eraOf } from '../lib/rules/eras'
import Inventory from './Inventory'

interface Props { char: Character; onChange: (c: Character) => void; abilities?: string[] }

export default function ActionChart({ char, onChange, abilities = [] }: Props) {
  const s = char.state
  const era = eraOf(char.book)
  const set = (patch: Partial<CharState>) => onChange({ ...char, state: { ...s, ...patch } })
  const statLabel = (id: string) => era.stats.find((x) => x.id === id)?.label ?? id

  return (
    <div className="chart">
      <div className="stats">
        <Stat label={statLabel('cs')} value={baseCs(s)} sub={baseCs(s) !== s.cs ? `base ${s.cs}` : undefined}
          onStep={(d) => set({ cs: s.cs + d })} />
        <Stat label="ENDURANCE" value={s.ep} sub={`of ${maxEp(s)}`} danger={s.ep <= 6}
          onStep={(d) => set({ ep: Math.min(maxEp(s), s.ep + d) })} />
        {s.wpBase != null ? <Stat label="WILLPOWER" value={s.wp ?? 0} sub={`of ${maxWp(s)}`}
          onStep={(d) => set({ wp: Math.min(maxWp(s), (s.wp ?? 0) + d) })} /> : null}
      </div>
      <details className="sub">
        <summary>Starting scores</summary>
        <div className="row-edit">
          <label>{era.stats[0].short} base <input type="number" inputMode="numeric" value={s.cs} onChange={(e) => set({ cs: +e.target.value })} /></label>
          <label>EP base <input type="number" inputMode="numeric" value={s.epBase} onChange={(e) => set({ epBase: +e.target.value })} /></label>
          {s.wpBase != null ? <label>WP base <input type="number" inputMode="numeric" value={s.wpBase} onChange={(e) => set({ wpBase: +e.target.value })} /></label> : null}
        </div>
      </details>

      <Block title={era.abilityLabel}>
        {era.abilityMode === 'points' ? (
          <div className="skills">
            {(abilities.length ? abilities : Object.keys(s.skills)).map((name) => (
              <div key={name} className="skill">
                <span>{name}</span>
                <div className="stepper">
                  <button onClick={() => set({ skills: { ...s.skills, [name]: Math.max(0, (s.skills[name] ?? era.pointsBase ?? 0) - 1) } })}>−</button>
                  <b>{s.skills[name] ?? era.pointsBase ?? 0}</b>
                  <button onClick={() => set({ skills: { ...s.skills, [name]: (s.skills[name] ?? era.pointsBase ?? 0) + 1 } })}>+</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <AbilityList char={char} onChange={onChange} options={abilities} />
        )}
        {era.weaponBonus ? (
          <TagList label={`${era.weaponBonus.requires}: weapons`} values={s.weaponSkills}
            onChange={(weaponSkills) => set({ weaponSkills })} placeholder="e.g. Sword" />
        ) : null}
      </Block>

      <Block title="Pack">
        <Inventory char={char} onChange={onChange} />
      </Block>

      <Block title="Counters">
        <div className="counters">
          {[...era.counters.filter((c) => c.id !== 'gold' && c.id !== 'meals'), ...Object.keys(s.counters).filter((k) => !era.counters.some((c) => c.id === k) && k !== 'gold' && k !== 'meals').map((k) => ({ id: k, label: k, max: undefined as number | undefined }))].map((c) => (
            <div key={c.id} className="counter">
              <span>{c.label}{c.max ? <small> max {c.max}</small> : null}</span>
              <div className="stepper">
                <button onClick={() => set({ counters: { ...s.counters, [c.id]: Math.max(0, (s.counters[c.id] ?? 0) - 1) } })}>−</button>
                <input type="number" inputMode="numeric" value={s.counters[c.id] ?? 0}
                  onChange={(e) => set({ counters: { ...s.counters, [c.id]: Math.max(0, Math.min(c.max ?? 9999, +e.target.value)) } })} />
                <button onClick={() => set({ counters: { ...s.counters, [c.id]: Math.min(c.max ?? 9999, (s.counters[c.id] ?? 0) + 1) } })}>+</button>
              </div>
            </div>
          ))}
          <AddCounter onAdd={(label) => set({ counters: { ...s.counters, [label]: 0 } })} />
        </div>
      </Block>

      <Block title="Lasting bonuses" note="Lore-circles, ranks, blessings — anything the book says to add to your scores for good.">
        <Bonuses bonuses={s.bonuses} onChange={(bonuses) => {
          const before = maxEp(s)
          const next = { ...s, bonuses }
          const gained = maxEp(next) - before
          set({ bonuses, ep: Math.max(0, Math.min(maxEp(next), s.ep + Math.max(0, gained))) })
        }} />
      </Block>

      {s.noted !== undefined || era.id === 'greystar' ? (
        <Block title="Noted number">
          <input className="wide" type="number" inputMode="numeric" value={s.noted ?? ''} placeholder="When the book says to note a number"
            onChange={(e) => set({ noted: e.target.value === '' ? null : +e.target.value })} />
        </Block>
      ) : null}

      <Block title="Notes">
        <textarea className="wide" rows={4} value={s.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Anything else to remember" />
      </Block>
    </div>
  )
}

function Stat({ label, value, sub, onStep, danger }: { label: string; value: number; sub?: string; onStep: (d: number) => void; danger?: boolean }) {
  return (
    <div className={`stat ${danger ? 'danger' : ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-row">
        <button onClick={() => onStep(-1)} aria-label={`Lower ${label}`}>−</button>
        <div className="stat-value">{value}</div>
        <button onClick={() => onStep(1)} aria-label={`Raise ${label}`}>+</button>
      </div>
      {sub ? <div className="stat-sub">{sub}</div> : null}
    </div>
  )
}

function Block({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return <section className="block"><h4>{title}</h4>{note ? <p className="note">{note}</p> : null}{children}</section>
}

function AbilityList({ char, onChange, options }: { char: Character; onChange: Props['onChange']; options: string[] }) {
  const s = char.state
  const [adding, setAdding] = useState('')
  const owned = abilityNames(s)
  const add = (name: string) => {
    if (!name.trim() || owned.includes(name.trim())) return
    onChange({ ...char, state: { ...s, abilities: [...s.abilities, { name: name.trim(), era: s.era }] } })
    setAdding('')
  }
  return (
    <>
      <ul className="tags">
        {s.abilities.map((a, i) => (
          <li key={i} className={a.era !== s.era ? 'older' : ''} title={ERAS[a.era].abilityLabel}>
            {a.name}
            <button aria-label={`Remove ${a.name}`} onClick={() => onChange({ ...char, state: { ...s, abilities: s.abilities.filter((_, j) => j !== i) } })}>×</button>
          </li>
        ))}
      </ul>
      <div className="add-row">
        {options.length ? (
          <select value={adding} onChange={(e) => add(e.target.value)}>
            <option value="">Add…</option>
            {options.filter((o) => !owned.includes(o)).map((o) => <option key={o}>{o}</option>)}
          </select>
        ) : (
          <><input value={adding} onChange={(e) => setAdding(e.target.value)} placeholder="Add" onKeyDown={(e) => e.key === 'Enter' && add(adding)} />
            <button className="ghost small" onClick={() => add(adding)}>Add</button></>
        )}
      </div>
    </>
  )
}

function TagList({ label, values, onChange, placeholder }: { label: string; values: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [v, setV] = useState('')
  const add = () => { if (v.trim()) { onChange([...values, v.trim()]); setV('') } }
  return (
    <div className="taglist">
      <div className="mini-label">{label}</div>
      <ul className="tags">{values.map((x, i) => <li key={i}>{x}<button onClick={() => onChange(values.filter((_, j) => j !== i))}>×</button></li>)}</ul>
      <div className="add-row"><input value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} /><button className="ghost small" onClick={add}>Add</button></div>
    </div>
  )
}

function Bonuses({ bonuses, onChange }: { bonuses: Bonus[]; onChange: (b: Bonus[]) => void }) {
  const [label, setLabel] = useState('')
  const upd = (i: number, p: Partial<Bonus>) => onChange(bonuses.map((b, j) => j === i ? { ...b, ...p } : b))
  return (
    <>
      <ul className="bonuses">
        {bonuses.map((b, i) => (
          <li key={i}>
            <input value={b.label} onChange={(e) => upd(i, { label: e.target.value })} />
            <label>CS <input type="number" inputMode="numeric" value={b.cs} onChange={(e) => upd(i, { cs: +e.target.value })} /></label>
            <label>EP <input type="number" inputMode="numeric" value={b.ep} onChange={(e) => upd(i, { ep: +e.target.value })} /></label>
            <button className="x" onClick={() => onChange(bonuses.filter((_, j) => j !== i))}>×</button>
          </li>
        ))}
      </ul>
      <div className="add-row"><input value={label} placeholder="e.g. Circle of Fire" onChange={(e) => setLabel(e.target.value)} />
        <button className="ghost small" onClick={() => { if (label.trim()) { onChange([...bonuses, { label: label.trim(), cs: 0, ep: 0, wp: 0 }]); setLabel('') } }}>Add</button></div>
    </>
  )
}

function AddCounter({ onAdd }: { onAdd: (label: string) => void }) {
  const [v, setV] = useState('')
  return <div className="add-row"><input value={v} placeholder="Another counter (e.g. Lune)" onChange={(e) => setV(e.target.value)} />
    <button className="ghost small" onClick={() => { if (v.trim()) { onAdd(v.trim()); setV('') } }}>Add</button></div>
}
