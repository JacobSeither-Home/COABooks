// Tapping an item in the story: confirm what it is and where it goes, then it's on the Action Chart.
import { useState } from 'react'
import type { Character } from '../lib/character'
import type { ItemGuess, ItemKind } from '../lib/items'
import { eraOf } from '../lib/rules/eras'
import { ItemIcon, applyBag } from './Inventory'

const KINDS: { kind: ItemKind; label: string }[] = [
  { kind: 'weapon', label: 'Weapon' }, { kind: 'backpack', label: 'Backpack' }, { kind: 'special', label: 'Special Item' },
  { kind: 'gold', label: 'Gold' }, { kind: 'meal', label: 'Meal' },
]

export default function ItemPrompt({ guess, char, onDone, onCancel }: { guess: ItemGuess; char: Character; onDone: (c: Character, msg: string) => void; onCancel: () => void }) {
  const [name, setName] = useState(guess.name)
  const [kind, setKind] = useState<ItemKind>(guess.kind)
  const [qty, setQty] = useState(guess.qty)
  const s = char.state
  const era = eraOf(char.book)
  const counted = kind === 'gold' || kind === 'meal'
  const room = kind === 'weapon' ? era.limits.weapons - s.weapons.length
    : kind === 'backpack' ? era.limits.backpack - s.backpack.length - (s.counters.meals ?? 0)
    : kind === 'meal' ? era.limits.backpack - s.backpack.length - (s.counters.meals ?? 0)
    : kind === 'special' && era.limits.special ? era.limits.special - s.special.length : Infinity
  const goldMax = era.counters.find((c) => c.id === 'gold')?.max

  const add = () => {
    let st = s, msg = ''
    if (kind === 'gold') {
      const before = s.counters.gold ?? 0
      const after = Math.min(goldMax ?? 9999, before + qty)
      st = { ...s, counters: { ...s.counters, gold: after } }
      msg = after - before < qty ? `+${after - before} Gold Crowns (your pouch holds ${goldMax})` : `+${qty} Gold Crowns`
    } else if (kind === 'meal') {
      st = { ...s, counters: { ...s.counters, meals: (s.counters.meals ?? 0) + qty } }
      msg = `+${qty} Meal${qty > 1 ? 's' : ''}`
    } else {
      const bag = kind === 'weapon' ? 'weapons' : kind
      const items = Array.from({ length: qty }, () => ({ name: name.trim() }))
      st = applyBag(s, bag, [...s[bag], ...items])
      msg = `${qty > 1 ? `${qty} × ` : ''}${name.trim()} added`
    }
    onDone({ ...char, state: st }, msg)
  }

  return (
    <div className="prompt-wrap" onClick={onCancel}>
      <div className="prompt" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Add to your Action Chart">
        <div className="prompt-icon"><ItemIcon name={name} kind={kind} size={72} /></div>
        <input className="prompt-name" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="seg">
          {KINDS.map((k) => <button key={k.kind} className={k.kind === kind ? 'on' : ''} onClick={() => setKind(k.kind)}>{k.label}</button>)}
        </div>
        <div className="prompt-qty">
          <span>{counted ? 'How many' : 'Quantity'}</span>
          <div className="stepper">
            <button onClick={() => setQty(Math.max(1, qty - 1))}>−</button><b>{qty}</b><button onClick={() => setQty(qty + 1)}>+</button>
          </div>
        </div>
        {room < qty && kind !== 'gold' ? <p className="note bad">{room <= 0 ? 'No room left there.' : `Room for ${room}.`} You can still add it and drop something after.</p> : null}
        <div className="prompt-actions">
          <button className="primary" onClick={add}>Add to Action Chart</button>
          <button className="link" onClick={onCancel}>Not now</button>
        </div>
      </div>
    </div>
  )
}
