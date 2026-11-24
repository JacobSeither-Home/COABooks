// Rules for each series and era, taken from the books' own rules pages (gamerulz, discplnz, powers,
// sskills, equipmnt, cmbtrulz). Only what the app calculates lives here; everything else is read from
// the book itself in the reader.
import { FREEWAY, STANDARD, type CRT } from './crt'

export type Series = 'lw' | 'gs' | 'fw' | 'dd'
export type EraId = 'kai' | 'magnakai' | 'grandmaster' | 'neworder' | 'greystar' | 'freeway' | 'dotd'
export type StatId = 'cs' | 'ep' | 'wp'

export interface CombatOption {
  id: string
  label: string
  cs: number
  /** ENDURANCE lost each round the option is used. */
  epPerRound?: number
  /** Can't be used at or below this ENDURANCE. */
  disabledAtOrBelow?: number
  /** Ability name (substring) the hero must have. */
  requires: string
  /** Options in the same group can't be used together. */
  group?: string
  /** Psychic attack: switched off when the section says the enemy is immune. */
  psychic?: boolean
}

export interface Era {
  id: EraId
  series: Series
  label: string
  hero: string
  /** Base and roll for each stat at character creation: value = add + random number (0-9). */
  stats: { id: StatId; label: string; short: string; add: number }[]
  abilityLabel: string
  /** 'pick' = choose N named abilities; 'points' = spend points across a fixed list (Freeway Warrior). */
  abilityMode: 'pick' | 'points'
  startPicks: number
  perBookPicks: number
  /** Freeway Warrior: every skill starts with this many points. */
  pointsBase?: number
  limits: { weapons: number; backpack: number; special?: number }
  counters: { id: string; label: string; max?: number; start?: string }[]
  weaponBonus?: { requires: string; cs: number; note: string }
  unarmed: { cs: number; waivedBy?: string }
  combatOptions: CombatOption[]
  healing?: { requires: string; perSection: number; capPerBook?: number }
  table: CRT
  /** What the book calls the hero's loss column. */
  heroLossLabel: string
}

const KAI_STATS = [
  { id: 'cs' as const, label: 'COMBAT SKILL', short: 'CS', add: 10 },
  { id: 'ep' as const, label: 'ENDURANCE', short: 'EP', add: 20 },
]
const GM_STATS = [
  { id: 'cs' as const, label: 'COMBAT SKILL', short: 'CS', add: 25 },
  { id: 'ep' as const, label: 'ENDURANCE', short: 'EP', add: 30 },
]
const GOLD = { id: 'gold', label: 'Gold Crowns', max: 50 }
const MEALS = { id: 'meals', label: 'Meals' }

export const ERAS: Record<EraId, Era> = {
  kai: {
    id: 'kai', series: 'lw', label: 'Kai (Books 1–5)', hero: 'Lone Wolf',
    stats: KAI_STATS, abilityLabel: 'Kai Disciplines', abilityMode: 'pick', startPicks: 5, perBookPicks: 1,
    limits: { weapons: 2, backpack: 8 }, counters: [GOLD, MEALS],
    weaponBonus: { requires: 'Weaponskill', cs: 2, note: 'Weaponskill with this weapon' },
    unarmed: { cs: -4 },
    combatOptions: [
      { id: 'mindblast', label: 'Mindblast', cs: 2, requires: 'Mindblast', group: 'psi', psychic: true },
    ],
    healing: { requires: 'Healing', perSection: 1 },
    table: STANDARD, heroLossLabel: 'LW',
  },
  magnakai: {
    id: 'magnakai', series: 'lw', label: 'Magnakai (Books 6–12)', hero: 'Lone Wolf',
    stats: KAI_STATS, abilityLabel: 'Magnakai Disciplines', abilityMode: 'pick', startPicks: 3, perBookPicks: 1,
    limits: { weapons: 2, backpack: 8 }, counters: [GOLD, MEALS],
    weaponBonus: { requires: 'Weaponmastery', cs: 3, note: 'Weaponmastery with this weapon' },
    unarmed: { cs: -4 },
    combatOptions: [
      { id: 'psisurge', label: 'Psi-surge', cs: 4, epPerRound: 2, disabledAtOrBelow: 6, requires: 'Psi-surge', group: 'psi', psychic: true },
      { id: 'mindblast', label: 'Mindblast', cs: 2, requires: 'Psi-surge', group: 'psi', psychic: true },
      { id: 'kaimindblast', label: 'Mindblast (Kai)', cs: 2, requires: 'Mindblast', group: 'psi', psychic: true },
    ],
    healing: { requires: 'Curing', perSection: 1 },
    table: STANDARD, heroLossLabel: 'LW',
  },
  grandmaster: {
    id: 'grandmaster', series: 'lw', label: 'Grand Master (Books 13–20)', hero: 'Lone Wolf',
    stats: GM_STATS, abilityLabel: 'Grand Master Disciplines', abilityMode: 'pick', startPicks: 4, perBookPicks: 1,
    limits: { weapons: 2, backpack: 10, special: 12 }, counters: [GOLD, MEALS],
    weaponBonus: { requires: 'Grand Weaponmastery', cs: 5, note: 'Grand Weaponmastery with this weapon' },
    unarmed: { cs: -4, waivedBy: 'Grand Weaponmastery' },
    combatOptions: [
      { id: 'kaisurge', label: 'Kai-surge', cs: 8, epPerRound: 1, requires: 'Kai-surge', group: 'psi', psychic: true },
      { id: 'mindblast', label: 'Mindblast', cs: 4, requires: 'Kai-surge', group: 'psi', psychic: true },
    ],
    healing: { requires: 'Deliverance', perSection: 1 },
    table: STANDARD, heroLossLabel: 'LW',
  },
  neworder: {
    id: 'neworder', series: 'lw', label: 'New Order (Books 21–29)', hero: 'Grand Master',
    stats: GM_STATS, abilityLabel: 'Grand Master Disciplines', abilityMode: 'pick', startPicks: 5, perBookPicks: 1,
    limits: { weapons: 2, backpack: 10, special: 12 }, counters: [GOLD, MEALS],
    weaponBonus: { requires: 'Grand Weaponmastery', cs: 5, note: 'Grand Weaponmastery with this weapon' },
    unarmed: { cs: -4, waivedBy: 'Grand Weaponmastery' },
    combatOptions: [
      { id: 'kaisurge', label: 'Kai-surge', cs: 8, epPerRound: 1, requires: 'Kai-surge', group: 'psi', psychic: true },
      { id: 'mindblast', label: 'Mindblast', cs: 4, requires: 'Kai-surge', group: 'psi', psychic: true },
    ],
    healing: { requires: 'Deliverance', perSection: 1, capPerBook: 10 },
    table: STANDARD, heroLossLabel: 'GM',
  },
  greystar: {
    id: 'greystar', series: 'gs', label: 'Grey Star', hero: 'Grey Star',
    stats: [
      { id: 'cs', label: 'COMBAT SKILL', short: 'CS', add: 10 },
      { id: 'wp', label: 'WILLPOWER', short: 'WP', add: 20 },
      { id: 'ep', label: 'ENDURANCE', short: 'EP', add: 20 },
    ],
    abilityLabel: 'Magical Powers', abilityMode: 'pick', startPicks: 5, perBookPicks: 1,
    limits: { weapons: 2, backpack: 8 },
    counters: [{ id: 'gold', label: 'Gold' }, MEALS],
    unarmed: { cs: -8 },
    combatOptions: [
      { id: 'nostaff', label: 'Without the Wizard’s Staff (weapon in hand)', cs: -6, requires: '', group: 'staff' },
    ],
    table: STANDARD, heroLossLabel: 'GS',
  },
  freeway: {
    id: 'freeway', series: 'fw', label: 'Freeway Warrior', hero: 'Cal Phoenix',
    stats: [
      { id: 'cs', label: 'CLOSE COMBAT SKILL', short: 'CCS', add: 10 },
      { id: 'ep', label: 'ENDURANCE', short: 'EP', add: 20 },
    ],
    abilityLabel: 'Survival Skills', abilityMode: 'points', startPicks: 4, perBookPicks: 4, pointsBase: 3,
    limits: { weapons: 2, backpack: 10 },
    counters: [
      { id: 'medikit', label: 'Medi-kit units', start: 'Random number (0 = 10) + 2' },
      { id: 'ammo9', label: '9mm rounds', max: 40 },
      { id: 'ammo762', label: '7.62mm rounds', max: 20 },
      { id: 'ammo12', label: '12-gauge rounds', max: 10 },
      MEALS,
    ],
    unarmed: { cs: 0 },
    combatOptions: [],
    table: FREEWAY, heroLossLabel: 'CP',
  },
  dotd: {
    id: 'dotd', series: 'dd', label: 'Dawn of the Darklords', hero: 'Magician',
    stats: KAI_STATS, abilityLabel: 'Brotherhood Spells', abilityMode: 'pick', startPicks: 5, perBookPicks: 0,
    limits: { weapons: 2, backpack: 8 }, counters: [GOLD, MEALS],
    unarmed: { cs: -4 },
    combatOptions: [],
    table: STANDARD, heroLossLabel: 'You',
  },
}

export const SERIES_LABEL: Record<Series, string> = {
  lw: 'Lone Wolf', gs: 'World of Lone Wolf (Grey Star)', fw: 'Freeway Warrior', dd: 'Dawn of the Darklords',
}

/** 'lw/06tkot' -> era. */
export function eraOf(bookId: string): Era {
  const [series, dir] = bookId.split('/')
  if (series === 'gs') return ERAS.greystar
  if (series === 'fw') return ERAS.freeway
  if (dir === 'dotd') return ERAS.dotd
  const n = parseInt(dir, 10)
  if (n <= 5) return ERAS.kai
  if (n <= 12) return ERAS.magnakai
  if (n <= 20) return ERAS.grandmaster
  return ERAS.neworder
}

export function seriesOf(bookId: string): Series {
  return eraOf(bookId).series
}

/** Column in the Combat Results Table for a Combat Ratio. */
export function ratioColumn(r: number): number {
  if (r <= -11) return 0
  if (r >= 11) return 12
  if (r === 0) return 6
  return r < 0 ? 6 - Math.ceil(-r / 2) : 6 + Math.ceil(r / 2)
}

export function has(abilities: string[], name: string): boolean {
  if (!name) return true
  const n = name.toLowerCase()
  return abilities.some((a) => a.toLowerCase().startsWith(n))
}
