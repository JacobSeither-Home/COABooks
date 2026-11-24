// A character's Action Chart and place in the books, and the rules arithmetic that reads it.
import { ERAS, eraOf, has, type EraId, type Era, type Series } from './rules/eras'

export interface Item { name: string; cs?: number; ep?: number; wp?: number; note?: string }
export interface Bonus { label: string; cs: number; ep: number; wp: number }
export interface Ability { name: string; era: EraId }

export interface CharState {
  era: EraId
  /** Base scores, before items and bonuses. */
  cs: number
  epBase: number
  ep: number
  wpBase?: number
  wp?: number
  abilities: Ability[]
  /** Freeway Warrior survival skill points. */
  skills: Record<string, number>
  /** Weapons the hero is skilled in (Weaponskill / Weaponmastery). */
  weaponSkills: string[]
  weapons: Item[]
  backpack: Item[]
  special: Item[]
  counters: Record<string, number>
  bonuses: Bonus[]
  notes: string
  /** Grey Star: "note down this number". */
  noted?: number | null
  /** Weapon held in combat (name), '' = bare hands. */
  wielding?: string
  /** Healing used this book (New Order caps it). */
  healed: number
  /** A combat round was fought in the current section. */
  fought: boolean
}

export interface Character {
  id: string
  user_id?: string
  series: Series
  name: string
  book: string
  section: string
  state: CharState
  /** Sections visited in the current book, oldest first. */
  history: string[]
  finished_books: string[]
  dead: boolean
  /** The Action Chart as it was when the current book began, for starting the book again. */
  start?: CharState
  updated_at?: string
}

export function blankState(eraId: EraId): CharState {
  const era = ERAS[eraId]
  return {
    era: eraId, cs: 0, epBase: 0, ep: 0, wpBase: era.stats.some((s) => s.id === 'wp') ? 0 : undefined, wp: undefined,
    abilities: [], skills: {}, weaponSkills: [], weapons: [], backpack: [], special: [],
    counters: Object.fromEntries(era.counters.map((c) => [c.id, 0])), bonuses: [], notes: '', healed: 0, fought: false,
  }
}

const sum = (xs: (number | undefined)[]) => xs.reduce<number>((n, x) => n + (x ?? 0), 0)
const carried = (s: CharState) => [...s.special, ...s.backpack]

export function maxEp(s: CharState) { return s.epBase + sum(s.bonuses.map((b) => b.ep)) + sum(carried(s).map((i) => i.ep)) }
export function maxWp(s: CharState) { return (s.wpBase ?? 0) + sum(s.bonuses.map((b) => b.wp)) + sum(carried(s).map((i) => i.wp)) }
/** COMBAT SKILL outside combat: base + lasting bonuses + Special Items that add to it. */
export function baseCs(s: CharState) { return s.cs + sum(s.bonuses.map((b) => b.cs)) + sum(s.special.map((i) => i.cs)) }

export const abilityNames = (s: CharState) => s.abilities.map((a) => a.name)
export const hasAbility = (s: CharState, name: string) => has(abilityNames(s), name)

export interface CsPart { label: string; value: number }

/** COMBAT SKILL for one fight, with each part listed. */
export function combatCs(s: CharState, era: Era, opts: { options: string[]; modifier: number }): { total: number; parts: CsPart[] } {
  const parts: CsPart[] = [{ label: 'COMBAT SKILL', value: s.cs }]
  for (const b of s.bonuses) if (b.cs) parts.push({ label: b.label, value: b.cs })
  for (const i of s.special) if (i.cs) parts.push({ label: i.name, value: i.cs })
  const weapon = s.weapons.find((w) => w.name === s.wielding)
  if (!weapon) {
    const waived = era.unarmed.waivedBy && hasAbility(s, era.unarmed.waivedBy)
    if (era.unarmed.cs && !waived) parts.push({ label: 'No weapon', value: era.unarmed.cs })
  } else {
    if (weapon.cs) parts.push({ label: weapon.name, value: weapon.cs })
    const skilled = s.weaponSkills.some((w) => weaponMatches(weapon.name, w))
    if (era.weaponBonus && skilled && hasAbility(s, era.weaponBonus.requires)) parts.push({ label: era.weaponBonus.note, value: era.weaponBonus.cs })
  }
  for (const id of opts.options) {
    const o = era.combatOptions.find((x) => x.id === id)
    if (o) parts.push({ label: o.label, value: o.cs })
  }
  if (opts.modifier) parts.push({ label: 'This fight', value: opts.modifier })
  return { total: sum(parts.map((p) => p.value)), parts }
}

/** "Broadsword" is skilled by "Broadsword" but not "Sword"; "Short Sword" counts as "Sword". */
export function weaponMatches(item: string, skill: string) {
  const a = item.toLowerCase().trim(), b = skill.toLowerCase().trim()
  if (!b) return false
  if (a === b) return true
  if (b === 'sword') return /\bsword\b/.test(a) && !/broadsword/.test(a)
  return new RegExp(`\\b${b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(a)
}

export function availableOptions(s: CharState, era: Era) {
  return era.combatOptions.filter((o) => hasAbility(s, o.requires) || (o.id === 'kaimindblast' && hasAbility(s, 'Mindblast')))
}

/** Next book in the same series, if it's been imported. */
export function nextBookId(bookId: string, imported: string[]): string | null {
  const [series, dir] = bookId.split('/')
  if (dir === 'dotd') return null
  const n = parseInt(dir, 10)
  const prefix = String(n + 1).padStart(2, '0')
  return imported.find((id) => id.startsWith(`${series}/${prefix}`)) ?? null
}

/** Moving on to another section: apply healing if the last section had no fighting. */
export function enterSection(c: Character, to: string): { char: Character; healed: number } {
  const era = eraOf(c.book)
  const s = { ...c.state }
  let healed = 0
  if (era.healing && !s.fought && hasAbility(s, era.healing.requires) && s.ep > 0 && s.ep < maxEp(s)) {
    const cap = era.healing.capPerBook
    if (!cap || s.healed < cap) { healed = era.healing.perSection; s.ep = Math.min(maxEp(s), s.ep + healed); s.healed += healed }
  }
  s.fought = false
  return { char: { ...c, section: to, state: s, history: [...c.history, to].slice(-400) }, healed }
}

/** Start a book: full ENDURANCE and WILLPOWER, healing count reset, a copy kept for restarting. */
export function beginBook(c: Character, bookId: string, hasOpening = true): Character {
  const era = eraOf(bookId)
  const s: CharState = { ...c.state, era: era.id, healed: 0, fought: false }
  s.ep = maxEp(s)
  if (s.wpBase != null) s.wp = maxWp(s)
  for (const k of era.counters) s.counters[k.id] ??= 0
  return { ...c, book: bookId, section: hasOpening ? 'intro' : '1', history: hasOpening ? [] : ['1'], dead: false, state: s, start: structuredClone(s) }
}

export function itemCount(s: CharState) {
  return { weapons: s.weapons.length, backpack: s.backpack.length + (s.counters.meals ?? 0), special: s.special.length }
}
