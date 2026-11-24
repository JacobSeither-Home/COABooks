// What the hero carries, as slots: Weapons, Backpack (Meals take a slot each, as the rules say),
// Special Items, and the belt pouch of gold. Each slot shows the book's own picture of the item
// when the books have one, or a simple drawn mark when they don't.
import { useEffect, useState } from 'react'
import { itemCount, maxEp, maxWp, type Character, type CharState, type Item } from '../lib/character'
import { iconUrl } from '../lib/db'
import { iconFiles, kindOf, type ItemKind } from '../lib/items'
import { eraOf } from '../lib/rules/eras'

type Bag = 'weapons' | 'backpack' | 'special'

export function ItemIcon({ name, kind, size = 44 }: { name: string; kind?: ItemKind; size?: number }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => { let alive = true; iconUrl(iconFiles(name)).then((u) => { if (alive) setUrl(u) }); return () => { alive = false } }, [name])
  if (url) return <img className="item-pic" src={url} alt="" style={{ maxHeight: size }} />
  return <Glyph kind={kind ?? kindOf(name)} size={size} />
}

/** Drawn stand-ins for items the books have no picture of. */
function Glyph({ kind, size }: { kind: ItemKind; size: number }) {
  const s = { width: size, height: size }
  const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 3, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (kind) {
    case 'weapon': return <svg viewBox="0 0 48 48" style={s} className="glyph" aria-hidden><path d="M10 38 L34 14 M34 14 l4 -6 l-6 4 M16 28 l4 4 M8 40 l4 -2 l-2 4 z" {...stroke} /></svg>
    case 'gold': return <svg viewBox="0 0 48 48" style={s} className="glyph" aria-hidden><ellipse cx="24" cy="30" rx="13" ry="5" {...stroke} /><path d="M11 30 v-6 M37 30 v-6" {...stroke} /><ellipse cx="24" cy="24" rx="13" ry="5" {...stroke} /><ellipse cx="24" cy="17" rx="10" ry="4" {...stroke} /></svg>
    case 'meal': return <svg viewBox="0 0 48 48" style={s} className="glyph" aria-hidden><path d="M10 26 h28 a14 10 0 0 1 -28 0 z M18 18 c0 -4 4 -4 4 -8 M26 18 c0 -4 4 -4 4 -8" {...stroke} /></svg>
    case 'special': return <svg viewBox="0 0 48 48" style={s} className="glyph" aria-hidden><path d="M24 6 l5 12 l13 1 l-10 8 l4 13 l-12 -7 l-12 7 l4 -13 l-10 -8 l13 -1 z" {...stroke} /></svg>
    default: return <svg viewBox="0 0 48 48" style={s} className="glyph" aria-hidden><path d="M14 18 h20 l3 22 h-26 z M18 18 c0 -8 12 -8 12 0" {...stroke} /></svg>
  }
}

interface Props { char: Character; onChange: (c: Character) => void }

export default function Inventory({ char, onChange }: Props) {
  const s = char.state
  const era = eraOf(char.book)
  const [open, setOpen] = useState<{ bag: Bag; i: number } | null>(null)
  const [adding, setAdding] = useState<Bag | null>(null)
  const counts = itemCount(s)
  const meals = s.counters.meals ?? 0
  const gold = era.counters.find((c) => c.id === 'gold')

  const put = (bag: Bag, items: Item[]) => onChange({ ...char, state: applyBag(s, bag, items) })

  const section = (bag: Bag, title: string, limit: number | undefined, items: Item[], extra: React.ReactNode[] = []) => {
    const used = items.length + extra.length
    const slots = Math.max(limit ?? 0, used + 1)
    return (
      <section className="inv-group">
        <h4>{title} <small className={limit != null && used > limit ? 'over' : ''}>{used}{limit != null ? ` / ${limit}` : ''}</small></h4>
        <div className={`slots ${bag}`}>
          {items.map((it, i) => (
            <button key={`i${i}`} className={`slot full ${open?.bag === bag && open.i === i ? 'on' : ''}`} onClick={() => setOpen(open?.bag === bag && open.i === i ? null : { bag, i })}>
              <ItemIcon name={it.name} kind={bag === 'weapons' ? 'weapon' : bag === 'special' ? 'special' : undefined} />
              <span className="slot-name">{it.name}</span>
              {it.cs || it.ep ? <span className="slot-bonus">{it.cs ? `${it.cs > 0 ? '+' : ''}${it.cs} CS ` : ''}{it.ep ? `${it.ep > 0 ? '+' : ''}${it.ep} EP` : ''}</span> : null}
            </button>
          ))}
          {extra}
          {Array.from({ length: slots - used }, (_, k) => (
            <button key={`e${k}`} className="slot empty" onClick={() => setAdding(bag)} aria-label={`Add to ${title}`}>
              {k === 0 ? <span className="plus">+</span> : null}
            </button>
          ))}
        </div>
        {open?.bag === bag && items[open.i] ? (
          <ItemEditor item={items[open.i]} bag={bag}
            onSave={(item) => { put(bag, items.map((x, j) => (j === open.i ? item : x))); setOpen(null) }}
            onDrop={() => { put(bag, items.filter((_, j) => j !== open.i)); setOpen(null) }}
            onMove={(to) => { const item = items[open.i]; const st = applyBag(s, bag, items.filter((_, j) => j !== open.i)); onChange({ ...char, state: applyBag(st, to, [...st[to], item]) }); setOpen(null) }} />
        ) : null}
        {adding === bag ? <AddItem bag={bag} onAdd={(item) => { put(bag, [...items, item]); setAdding(null) }} onCancel={() => setAdding(null)} /> : null}
      </section>
    )
  }

  const mealSlots = Array.from({ length: meals }, (_, k) => (
    <button key={`m${k}`} className="slot full meal" onClick={() => { if (confirm('Eat or drop a Meal?')) onChange({ ...char, state: { ...s, counters: { ...s.counters, meals: meals - 1 } } }) }}>
      <ItemIcon name="Meal" kind="meal" /><span className="slot-name">Meal</span>
    </button>
  ))

  return (
    <div className="inventory">
      {gold ? (
        <div className="purse">
          <ItemIcon name="Gold" kind="gold" size={40} />
          <div className="purse-body"><span className="eyebrow">{gold.label}</span><b>{s.counters.gold ?? 0}</b>{gold.max ? <small> / {gold.max}</small> : null}</div>
          <div className="stepper">
            <button onClick={() => onChange({ ...char, state: { ...s, counters: { ...s.counters, gold: Math.max(0, (s.counters.gold ?? 0) - 1) } } })}>−</button>
            <button onClick={() => onChange({ ...char, state: { ...s, counters: { ...s.counters, gold: Math.min(gold.max ?? 9999, (s.counters.gold ?? 0) + 1) } } })}>+</button>
          </div>
        </div>
      ) : null}
      {section('weapons', 'Weapons', era.limits.weapons, s.weapons)}
      {section('backpack', 'Backpack', era.limits.backpack, s.backpack, mealSlots)}
      <div className="meal-row">
        <span>Meals</span>
        <div className="stepper">
          <button onClick={() => onChange({ ...char, state: { ...s, counters: { ...s.counters, meals: Math.max(0, meals - 1) } } })}>−</button>
          <b>{meals}</b>
          <button onClick={() => onChange({ ...char, state: { ...s, counters: { ...s.counters, meals: meals + 1 } } })}>+</button>
        </div>
      </div>
      {section('special', 'Special Items', era.limits.special, s.special)}
      {counts.backpack > era.limits.backpack ? <p className="note bad">Your Backpack holds {era.limits.backpack}. Something has to go.</p> : null}
    </div>
  )
}

/** Put a bag's items back, raising or lowering ENDURANCE/WILLPOWER as items with bonuses come and go. */
export function applyBag(s: CharState, bag: Bag, items: Item[]): CharState {
  const next: CharState = { ...s, [bag]: items }
  const gained = maxEp(next) - maxEp(s)
  next.ep = Math.max(0, Math.min(maxEp(next), s.ep + Math.max(0, gained)))
  if (next.wpBase != null) next.wp = Math.min(maxWp(next), (s.wp ?? 0) + Math.max(0, maxWp(next) - maxWp(s)))
  return next
}

function ItemEditor({ item, bag, onSave, onDrop, onMove }: { item: Item; bag: Bag; onSave: (i: Item) => void; onDrop: () => void; onMove: (to: Bag) => void }) {
  const [it, setIt] = useState(item)
  return (
    <div className="item-sheet">
      <div className="item-sheet-head"><ItemIcon name={it.name} size={56} /><input value={it.name} onChange={(e) => setIt({ ...it, name: e.target.value })} /></div>
      <div className="row-edit">
        <label>CS <input type="number" inputMode="numeric" value={it.cs ?? 0} onChange={(e) => setIt({ ...it, cs: +e.target.value || undefined })} /></label>
        <label>EP <input type="number" inputMode="numeric" value={it.ep ?? 0} onChange={(e) => setIt({ ...it, ep: +e.target.value || undefined })} /></label>
        <label className="grow">Note <input value={it.note ?? ''} onChange={(e) => setIt({ ...it, note: e.target.value || undefined })} /></label>
      </div>
      <div className="item-actions">
        <button className="primary small" onClick={() => onSave(it)}>Save</button>
        {(['weapons', 'backpack', 'special'] as Bag[]).filter((b) => b !== bag).map((b) => (
          <button key={b} className="ghost small" onClick={() => onMove(b)}>Move to {b === 'special' ? 'Special' : b === 'weapons' ? 'Weapons' : 'Backpack'}</button>
        ))}
        <button className="link danger" onClick={onDrop}>Drop</button>
      </div>
    </div>
  )
}

function AddItem({ bag, onAdd, onCancel }: { bag: Bag; onAdd: (i: Item) => void; onCancel: () => void }) {
  const [name, setName] = useState('')
  return (
    <form className="item-sheet" onSubmit={(e) => { e.preventDefault(); if (name.trim()) onAdd({ name: name.trim() }) }}>
      <div className="item-sheet-head">{name ? <ItemIcon name={name} size={56} kind={bag === 'weapons' ? 'weapon' : bag === 'special' ? 'special' : undefined} /> : null}
        <input autoFocus value={name} placeholder={bag === 'weapons' ? 'e.g. Sword' : bag === 'special' ? 'e.g. Silver Key' : 'e.g. Rope'} onChange={(e) => setName(e.target.value)} /></div>
      <div className="item-actions"><button className="primary small">Add</button><button type="button" className="link" onClick={onCancel}>Cancel</button></div>
    </form>
  )
}
