// One fight at a time: Combat Ratio from the Action Chart, a thrown die for each round, losses from
// the book's Combat Results Table, applied straight to the Action Chart.
import { useEffect, useMemo, useState } from 'react'
import type { Enemy } from '../lib/book/parse'
import { availableOptions, combatCs, maxEp, weaponMatches, type Character } from '../lib/character'
import { eraOf, ratioColumn } from '../lib/rules/eras'
import Dice from './Dice'

interface Props {
  char: Character
  enemies: Enemy[]
  immune: boolean
  onChange: (c: Character) => void
}

interface Round { n: number; rn: number; ratio: number; enemyLoss: number | 'K'; heroLoss: number | 'K'; extra: number; evaded: boolean }

export default function Combat({ char, enemies, immune, onChange }: Props) {
  const era = eraOf(char.book)
  const s = char.state
  const [list, setList] = useState<Enemy[]>(() => enemies.length ? enemies.map((e) => ({ ...e })) : [{ name: 'Enemy', cs: 10, ep: 10 }])
  const [idx, setIdx] = useState(0)
  const [enemyEp, setEnemyEp] = useState<number[]>(() => list.map((e) => e.ep))
  const [opts, setOpts] = useState<string[]>([])
  const [modifier, setModifier] = useState(0)
  const [evade, setEvade] = useState(false)
  const [rounds, setRounds] = useState<Round[]>([])
  const [editing, setEditing] = useState(false)
  const [hit, setHit] = useState<{ foe: string; hero: string; k: number } | null>(null)
  const [jolt, setJolt] = useState(false)
  useEffect(() => {
    if (!hit || !(hit.hero.startsWith('−') || hit.hero === 'SLAIN')) return
    setJolt(true)
    const t = setTimeout(() => setJolt(false), 420)
    return () => clearTimeout(t)
  }, [hit])

  // Go into a fight with a weapon in hand: a skilled one if there is one, else the first carried.
  useEffect(() => {
    if (s.wielding !== undefined && (s.wielding === '' || s.weapons.some((w) => w.name === s.wielding))) return
    if (!s.weapons.length) return
    const skilled = s.weapons.find((w) => s.weaponSkills.some((k) => weaponMatches(w.name, k)))
    onChange({ ...char, state: { ...s, wielding: (skilled ?? s.weapons[0]).name } })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const foe = list[idx]
  const options = availableOptions(s, era)
  const live = (id: string) => {
    const o = era.combatOptions.find((x) => x.id === id)!
    if (o.psychic && immune) return false
    if (o.disabledAtOrBelow != null && s.ep <= o.disabledAtOrBelow) return false
    return true
  }
  const using = opts.filter(live)
  const cs = useMemo(() => combatCs(s, era, { options: using, modifier }), [s, era, using.join(), modifier])
  const ratio = cs.total - (foe?.cs ?? 0)
  const heroDead = s.ep <= 0
  const foeDead = (enemyEp[idx] ?? 0) <= 0
  const allDone = enemyEp.every((e) => e <= 0)

  const toggle = (id: string) => {
    const o = era.combatOptions.find((x) => x.id === id)!
    setOpts((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur.filter((x) => !o.group || era.combatOptions.find((y) => y.id === x)?.group !== o.group), id])
  }

  const onRoll = (rn: number) => {
    const [eLoss, hLoss] = era.table[rn][ratioColumn(ratio)]
    const extra = using.reduce((n, id) => n + (era.combatOptions.find((o) => o.id === id)?.epPerRound ?? 0), 0)
    const heroDrop = (hLoss === 'K' ? s.ep : hLoss) + extra
    const ep = Math.max(hLoss === 'K' ? 0 : -99, s.ep - heroDrop)
    if (!evade) {
      const nextEp = [...enemyEp]
      nextEp[idx] = eLoss === 'K' ? 0 : Math.max(0, nextEp[idx] - eLoss)
      setEnemyEp(nextEp)
    }
    setRounds((r) => [...r, { n: r.length + 1, rn, ratio, enemyLoss: evade ? 0 : eLoss, heroLoss: hLoss, extra, evaded: evade }])
    setHit({ foe: evade ? '' : eLoss === 'K' ? 'SLAIN' : eLoss ? `−${eLoss}` : 'miss', hero: hLoss === 'K' ? 'SLAIN' : heroDrop ? `−${heroDrop}` : 'unhurt', k: Date.now() })
    onChange({ ...char, state: { ...s, ep, fought: true }, dead: ep <= 0 ? true : char.dead })
  }

  const setFoe = (patch: Partial<Enemy>) => {
    const l = list.map((e, i) => (i === idx ? { ...e, ...patch } : e))
    setList(l)
    if (patch.ep != null) setEnemyEp(enemyEp.map((v, i) => (i === idx ? patch.ep! : v)))
  }

  const lastEvaded = rounds.at(-1)?.evaded

  return (
    <section className={`combat-panel ${jolt ? 'jolt' : ''}`}>
      <header className="combat-head">
        <div>
          <div className="eyebrow">Combat{list.length > 1 ? ` · ${idx + 1} of ${list.length}` : ''}</div>
          <h3>{foe.name}</h3>
        </div>
        <button className="link" onClick={() => setEditing(!editing)}>{editing ? 'Done' : 'Edit'}</button>
      </header>

      {editing ? (
        <div className="edit-foe">
          <label>Name <input value={foe.name} onChange={(e) => setFoe({ name: e.target.value })} /></label>
          <label>{era.stats[0].short} <input type="number" inputMode="numeric" value={foe.cs} onChange={(e) => setFoe({ cs: +e.target.value })} /></label>
          <label>EP <input type="number" inputMode="numeric" value={foe.ep} onChange={(e) => setFoe({ ep: +e.target.value })} /></label>
          <button className="ghost small" onClick={() => { setList([...list, { name: `Enemy ${list.length + 1}`, cs: 10, ep: 10 }]); setEnemyEp([...enemyEp, 10]) }}>Add enemy</button>
        </div>
      ) : null}

      <div className="versus">
        <div className="side">
          <div className="who">{char.name}</div>
          <div className="big">{cs.total}<span>{era.stats[0].short}</span></div>
          <Bar now={s.ep} max={maxEp(s)} />
          {hit ? <span key={`h${hit.k}`} className={`float ${hit.hero.startsWith('−') || hit.hero === 'SLAIN' ? 'hurt' : 'calm'}`}>{hit.hero}</span> : null}
        </div>
        <div className="ratio">
          <div className="vs">⚔</div>
          <div className="eyebrow">Ratio</div>
          <div className={`big ${ratio >= 0 ? 'good' : 'bad'}`}>{ratio > 0 ? `+${ratio}` : ratio}</div>
        </div>
        <div className="side right">
          <div className="who">{foe.name}</div>
          <div className="big">{foe.cs}<span>{era.stats[0].short}</span></div>
          <Bar now={Math.max(0, enemyEp[idx])} max={foe.ep} foe />
          {hit && hit.foe ? <span key={`f${hit.k}`} className={`float ${hit.foe === 'miss' ? 'calm' : 'dealt'}`}>{hit.foe}</span> : null}
        </div>
      </div>

      <details className="parts">
        <summary>How {cs.total} is made up</summary>
        <ul>{cs.parts.map((p, i) => <li key={i}><span>{p.label}</span><b>{p.value > 0 && i ? `+${p.value}` : p.value}</b></li>)}</ul>
      </details>

      <div className="controls">
        <label className="field">
          <span>Weapon</span>
          <select value={s.wielding ?? ''} onChange={(e) => onChange({ ...char, state: { ...s, wielding: e.target.value } })}>
            <option value="">No weapon</option>
            {s.weapons.map((w, i) => <option key={i} value={w.name}>{w.name}</option>)}
          </select>
        </label>
        <div className="field">
          <span>This fight</span>
          <div className="stepper">
            <button onClick={() => setModifier(modifier - 1)} aria-label="Lower">−</button>
            <b>{modifier > 0 ? `+${modifier}` : modifier}</b>
            <button onClick={() => setModifier(modifier + 1)} aria-label="Raise">+</button>
          </div>
        </div>
        {options.map((o) => (
          <label key={o.id} className={`chip ${!live(o.id) ? 'muted' : ''}`}>
            <input type="checkbox" checked={opts.includes(o.id) && live(o.id)} disabled={!live(o.id)} onChange={() => toggle(o.id)} />
            {o.label} {o.cs > 0 ? `+${o.cs}` : o.cs}{o.epPerRound ? ` (−${o.epPerRound} EP/round)` : ''}
            {o.psychic && immune ? <em> — immune</em> : null}
          </label>
        ))}
        <label className="chip">
          <input type="checkbox" checked={evade} onChange={(e) => setEvade(e.target.checked)} /> Evade this round
        </label>
      </div>
      {immune ? <p className="note">The text says an enemy here is immune to psychic attack, so those options are off.</p> : null}

      {heroDead ? <p className="result bad">Your ENDURANCE has fallen to zero. The adventure is over.</p>
        : lastEvaded ? <p className="result">You evaded. Carry on with the text.</p>
        : foeDead ? (
          <div className="result good">
            {foe.name} is defeated.
            {!allDone && idx < list.length - 1 ? <button className="primary small" onClick={() => { setIdx(idx + 1); setRounds([]) }}>Next: {list[idx + 1].name}</button> : null}
          </div>
        ) : (
          <Dice onRoll={onRoll} prompt={`Throw for round ${rounds.length + 1}`} height={150} />
        )}

      {rounds.length ? (
        <ol className="rounds">
          {rounds.map((r) => (
            <li key={r.n}>
              <span>Round {r.n}</span>
              <span>rolled <b>{r.rn}</b> at {r.ratio > 0 ? `+${r.ratio}` : r.ratio}</span>
              <span>{r.evaded ? 'evaded' : <>foe −{r.enemyLoss === 'K' ? 'killed' : r.enemyLoss}</>}</span>
              <span>you −{r.heroLoss === 'K' ? 'killed' : r.heroLoss}{r.extra ? ` −${r.extra}` : ''}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  )
}

function Bar({ now, max, foe }: { now: number; max: number; foe?: boolean }) {
  const pct = Math.max(0, Math.min(100, (now / Math.max(1, max)) * 100))
  return (
    <div className={`hp ${foe ? 'foe' : ''}`}>
      <div className="hp-track"><i style={{ width: `${pct}%` }} className={pct < 30 ? 'low' : ''} /></div>
      <div className="hp-num"><b>{now}</b>/{max}</div>
    </div>
  )
}
