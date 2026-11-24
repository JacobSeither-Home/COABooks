// Items in the story text: what counts as one, where it goes on the Action Chart, and which of the
// books' own pictures shows it. The books don't mark items up, so this works from the way they are
// written — capitalised names after "a", "two", "15" and the like, in passages about finding,
// taking or buying — and always asks before adding anything.

export type ItemKind = 'weapon' | 'backpack' | 'special' | 'gold' | 'meal'

export interface ItemGuess { name: string; kind: ItemKind; qty: number }

const NUMBERS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20, single: 1, another: 1, some: 1, several: 2,
}
export const toNumber = (w: string) => (/^\d+$/.test(w) ? parseInt(w, 10) : NUMBERS[w.toLowerCase()] ?? 1)

const WEAPONS = ['Broadsword', 'Short Sword', 'Sword', 'Dagger', 'Axe', 'Mace', 'Spear', 'Warhammer', 'Quarterstaff', 'Bow', 'Sommerswerd', 'Magic Spear', 'Silver Bow', 'Pistol', 'Rifle', 'Shotgun', 'Knife', 'Hunting Knife', 'Crossbow', 'Staff']
const SPECIAL_HINTS = /\b(Key|Map|Helmet|Chainmail|Mail|Waistcoat|Shield|Pendant|Ring|Amulet|Gem|Stone|Crystal|Seal|Medallion|Scroll|Book|Tome|Badge|Pass|Orb|Crown|Sceptre|Rod|Wand|Talisman|Brooch|Box|Mirror|Lens|Lantern|Arrows?|Quiver|Cloak|Boots|Gloves|Belt|Horn|Flute|Lute|Moonstone|Letter|Document|Papers|Permit|Card)\b/
const BACKPACK_HINTS = /\b(Potion|Laumspur|Rope|Blanket|Tinderbox|Torch|Candle|Bottle|Flask|Wine|Ale|Herbs?|Oil|Salve|Elixir|Tonic|Brush|Comb|Comb|Hook|Net|Sack|Bag|Jar|Vial|Water|Canteen|Medi-kit|Food|Rations?)\b/

/** Words that start capitalised names but aren't things you can carry. */
const NOT_ITEMS = new Set(('Lone Wolf Kai Kai Lord Lords Monastery Sommerlund Sommlending Holmgard Darklord Darklords Giak Giaks Drakkar Drakkarim Kraan Kraans ' +
  'Doomwolf Doomwolves Gourgaz Vordak Vordaks Helghast Helghasts King Prince Princess Queen Lord Lady Sir Captain Sergeant Guard Guards Magician Magicians ' +
  'Banedon Rhygar Alyss Vonotar Haakon Gnaag Zakhan Shianti Grey Star Cal Phoenix Action Chart Random Number Table Discipline Disciplines Magnakai Grand Master ' +
  'Combat Skill Endurance Willpower Section Book Rules Lorestone Lorestones Magnamund Durenor Durenese Vassagonia Vassagonian Tyranthea Ruanon Toran ' +
  'Tower Sun Moon Ishir Kai-alchemy Dessi Elder Magi Cener Druid Druids Highway Freeway Hammerdal Port Bax Rhem Gorn Cove Varetta Sommerlund. ' +
  'You Your He She They It Its We If Then When As At In On Of To From For With Without After Before During Inside Outside Near Beyond').split(/\s+/))

export function kindOf(name: string): ItemKind {
  if (/Gold|Crowns?|Lune|Kika|Noble|Ducat/i.test(name)) return 'gold'
  if (/^Meals?$|enough for/i.test(name)) return 'meal'
  if (WEAPONS.some((w) => new RegExp(`\\b${w}s?\\b`, 'i').test(name)) && !SPECIAL_HINTS.test(name)) return 'weapon'
  if (BACKPACK_HINTS.test(name)) return 'backpack'
  if (SPECIAL_HINTS.test(name)) return 'special'
  return 'backpack'
}

const singular = (name: string) => name
  .replace(/\b(Spear|Dagger|Sword|Axe|Mace|Bow|Potion|Key|Gem|Arrow|Knife|Ring|Scroll|Torch)s\b/g, '$1')
  .replace(/\bKnives\b/g, 'Knife')

const ACQUIRE = /\b(find|finds|found|discover|discovers|reveal|reveals|revealed|contain|contains|containing|take|takes|keep|buy|buys|purchase|give|gives|hands?|offers?|pick up|picks up|lying|lies a|sell|sells|costs?|Action Chart|reward|loot|search|Backpack|Special Item|Weapons?)\b/i

/** Spans of text that look like items, as [start, end, guess]. */
export function findItems(text: string): [number, number, ItemGuess][] {
  if (!ACQUIRE.test(text)) return []
  const out: [number, number, ItemGuess][] = []
  const taken = (s: number, e: number) => out.some(([a, b]) => s < b && e > a)
  // Money.
  for (const m of text.matchAll(/\b(\d+|[a-z]+)\s+(Gold Crowns?|Gold Pieces?|Crowns|Lune|Kika|Nobles)\b/g)) {
    const s = m.index!, e = s + m[0].length
    out.push([s, e, { name: 'Gold Crowns', kind: 'gold', qty: toNumber(m[1]) }])
  }
  // Meals.
  for (const m of text.matchAll(/\benough (?:food )?for (\w+) Meals?\b|\b(\w+) Meals?\b/g)) {
    const s = m.index!, e = s + m[0].length
    if (taken(s, e)) continue
    const n = toNumber(m[1] ?? m[2])
    if (!m[1] && !(m[2] in NUMBERS) && !/^\d+$/.test(m[2])) continue
    out.push([s, e, { name: 'Meal', kind: 'meal', qty: n }])
  }
  // Named things after a determiner or a number: "a Silver Key", "2 Spears", "the Sommerswerd".
  const re = /\b(a|an|the|one|two|three|four|five|six|\d+|another|some|this|his|her|its|their)\s+((?:[A-Z][\w’'-]*)(?:\s+(?:of(?:\s+the)?|and)\s+[A-Z][\w’'-]*|\s+[A-Z][\w’'-]*){0,3})/g
  for (const m of text.matchAll(re)) {
    const phrase = m[2].replace(/[’']s$/, '')
    const first = phrase.split(/\s+/)[0]
    if (NOT_ITEMS.has(first) || NOT_ITEMS.has(phrase)) continue
    if (/^(Gold|Meals?|Crowns)$/.test(phrase)) continue
    const s = m.index! + m[0].indexOf(m[2])
    const e = s + phrase.length
    if (taken(s, e)) continue
    const name = singular(phrase)
    out.push([s, e, { name, kind: kindOf(name), qty: /^(a|an|the|one|this|his|her|its|their|another|some)$/i.test(m[1]) ? 1 : toNumber(m[1]) }])
  }
  return out.sort((a, b) => a[0] - b[0])
}

// ---------- Pictures ----------

/** The books' own item pictures, by file, and the words that call for each. */
const ICON_RULES: [RegExp, string[]][] = [
  [/broadsword/i, ['bsword.png', 'sword.png']],
  [/short sword/i, ['ssword.png', 'sword.png']],
  [/sommerswerd|sword/i, ['sword.png']],
  [/dagger|knife/i, ['dagger.png']],
  [/axe/i, ['axe.png']],
  [/mace/i, ['mace.png']],
  [/spear/i, ['spear.png']],
  [/warhammer|hammer/i, ['warhammr.png']],
  [/quarterstaff/i, ['qstaff.png', 'qurtstff.png', 'staff.png']],
  [/staff/i, ['staff.png', 'qstaff.png']],
  [/quiver|arrow/i, ['quiver.png']],
  [/bow/i, ['bow.png']],
  [/laumspur/i, ['laumspur.png', 'potion.png']],
  [/potion|elixir|tonic|salve|draught/i, ['potion.png']],
  [/meal|food|ration/i, ['food.png', 'meals.png']],
  [/rope/i, ['rope.png']],
  [/lantern|torch|lamp/i, ['lantern.png']],
  [/tinderbox/i, ['tindrbox.png']],
  [/pouch|purse/i, ['pouch.png']],
  [/helmet/i, ['helmet.png']],
  [/chainmail|mail|waistcoat/i, ['mail.png']],
  [/shield/i, ['shield.png']],
  [/flute/i, ['flute.png']],
  [/lute/i, ['lute.png']],
  [/seal/i, ['seal.png']],
  [/moonstone/i, ['moonston.png']],
]

/** Every picture the importer keeps for items. */
export const ICON_FILES = new Set(ICON_RULES.flatMap(([, f]) => f))

export function iconFiles(name: string): string[] {
  for (const [re, files] of ICON_RULES) if (re.test(name)) return files
  return []
}
