// Turns one Project Aon XHTML book (its files, already unzipped) into the app's book record.
// Runs on the device at import time. Works with both page layouts in the collection: the current one
// (<article> … <div class="maintext">) and the older one used by Grey Star, Freeway Warrior and
// Dawn of the Darklords (<div id="body"> … <div class="maintext">, illustrations framed in tables).

export interface Enemy { name: string; cs: number; ep: number }
export interface Choice { to: number; text: string }
export type Ending = 'death' | 'win' | 'end'

export interface Section {
  n: number
  html: string
  choices: Choice[]
  combats: Enemy[]
  end?: Ending
  /** The text says an enemy here is immune to psychic attack. */
  immune?: boolean
  /** The text asks for a number from the Random Number Table. */
  random?: boolean
}

export interface Page { name: string; title: string; html: string }

export interface Book {
  id: string // 'lw/01fftd'
  title: string
  order: number
  sections: Record<number, Section>
  lastSection: number
  pages: Record<string, Page>
  /** Front-matter pages in Table of Contents order. */
  pageOrder: string[]
  /** Discipline / power / skill names from the book's own list. */
  abilities: string[]
  /** Image files the html refers to (data-img). */
  images: string[]
  importedAt: number
}

type ParseHtml = (html: string) => Document

const KEEP_TAGS = new Set([
  'p', 'br', 'em', 'strong', 'i', 'b', 'span', 'a', 'ul', 'ol', 'li', 'figure', 'img', 'table', 'thead',
  'tbody', 'tr', 'td', 'th', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'div', 'dl', 'dt', 'dd', 'cite',
  'sup', 'sub', 'hr', 'caption', 'small',
])
const DROP_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'nav', 'map', 'area'])
const FRAME_IMG = /^(brdr|left|right|toc|title|back|palogo|lonewolf|bckgrnd|navigation)/i

const sectNum = (href: string) => {
  const m = /^sect(\d+)\.htm$/.exec(href)
  return m ? parseInt(m[1], 10) : null
}
const norm = (s: string) => s.replace(/ /g, ' ').replace(/\s+/g, ' ').trim()

const DEATH = [
  /\b(life|quest|mission|adventure|journey|story|existence)s?\b[^.!?]{0,80}\b(ends?|ended|is over|are over|comes? to an? (sudden |untimely |tragic |abrupt )?end|end here|is at an end|is finished)\b/i,
  /\byou (are|have) (now )?(dead|died|perished)\b/i,
  /\byour (body|corpse) /i,
  /\b(you have failed in your (mission|quest)|you are slain|meet your doom|your (physical )?death\b|with your life\b|you die\b|you perish|you are killed|lose your life|failed (in )?your (mission|quest)|terminates? here|you have failed)/i,
]

export function mainOf(doc: Document): Element | null {
  return doc.querySelector('.numbered .maintext, .frontmatter .maintext, .maintext') ??
    doc.querySelector('article') ?? doc.querySelector('#body') ?? doc.body
}

/** Copy `src` into a clean element tree: known tags only, links and images rewritten, no scripts. */
function clean(src: Element, doc: Document, images: Set<string>): string {
  const out = doc.createElement('div')
  const walk = (from: Node, to: Element) => {
    from.childNodes.forEach((node) => {
      if (node.nodeType === 3) { to.appendChild(doc.createTextNode(node.textContent ?? '')); return }
      if (node.nodeType !== 1) return
      const el = node as Element
      const tag = el.tagName.toLowerCase()
      if (DROP_TAGS.has(tag)) return
      if (el.id === 'page-navigation' || el.classList?.contains('navigation') || el.classList?.contains('copyright')) return
      // Old layout: an illustration framed by a table of border images -> a plain figure.
      if (tag === 'table' && el.querySelector('img[src^="brdr"]')) {
        const fig = doc.createElement('figure')
        el.querySelectorAll('img').forEach((img) => {
          const s = img.getAttribute('src') ?? ''
          if (!FRAME_IMG.test(s)) { const i = doc.createElement('img'); i.setAttribute('data-img', s); i.setAttribute('alt', ''); images.add(s); fig.appendChild(i) }
        })
        if (fig.childNodes.length) to.appendChild(fig)
        return
      }
      if (tag === 'img') {
        const s = el.getAttribute('src') ?? ''
        if (!s || FRAME_IMG.test(s) || /^https?:/.test(s)) return
        const i = doc.createElement('img'); i.setAttribute('data-img', s); i.setAttribute('alt', el.getAttribute('alt') ?? '')
        images.add(s); to.appendChild(i); return
      }
      if (tag === 'a') {
        const href = el.getAttribute('href') ?? ''
        const n = sectNum(href)
        if (n != null) {
          const a = doc.createElement('a'); a.setAttribute('data-s', String(n)); walk(el, a); to.appendChild(a); return
        }
        const page = /^([a-z0-9]+)\.htm$/i.exec(href)
        if (page && !/^ill\d/.test(page[1])) {
          const a = doc.createElement('a'); a.setAttribute('data-p', page[1]); walk(el, a); to.appendChild(a); return
        }
        // Links to image files or outside sites: keep the contents only.
        walk(el, to); return
      }
      if (!KEEP_TAGS.has(tag)) { walk(el, to); return }
      const copy = doc.createElement(tag)
      const cls = el.getAttribute('class')
      if (cls) copy.setAttribute('class', cls.replace(/[^\w\- ]/g, ''))
      for (const at of ['colspan', 'rowspan']) { const v = el.getAttribute(at); if (v) copy.setAttribute(at, v) }
      walk(el, copy)
      to.appendChild(copy)
    })
  }
  walk(src, out)
  return out.innerHTML
}

function parseEnemy(text: string): Enemy | null {
  const t = norm(text)
  const m = /^(.*?)[:\s]*(?:CLOSE\s+)?COMBAT\s+SKILL\s*:?\s*(-?\d+)[^\d]*?ENDURANCE\s*(?:\([^)]*\))?\s*:?\s*(\d+)/i.exec(t)
  if (!m) return null
  return { name: m[1].replace(/[:\s]+$/, '') || 'Enemy', cs: parseInt(m[2], 10), ep: parseInt(m[3], 10) }
}

export function parseSection(n: number, doc: Document, images: Set<string>): Section {
  const main = mainOf(doc)!
  main.querySelector('h3')?.remove() // the section number heading
  const choices: Choice[] = []
  main.querySelectorAll('p.choice').forEach((p) => {
    p.querySelectorAll('a[href]').forEach((a) => {
      const to = sectNum(a.getAttribute('href') ?? '')
      if (to != null) choices.push({ to, text: norm(p.textContent ?? '') })
    })
  })
  // Some sections link onward from ordinary paragraphs rather than class="choice".
  if (!choices.length) {
    main.querySelectorAll('a[href]').forEach((a) => {
      const to = sectNum(a.getAttribute('href') ?? '')
      if (to != null) choices.push({ to, text: norm(a.parentElement?.textContent ?? a.textContent ?? '') })
    })
  }
  const combats: Enemy[] = []
  main.querySelectorAll('p.combat').forEach((p) => { const e = parseEnemy(p.textContent ?? ''); if (e) combats.push(e) })
  const text = norm(main.textContent ?? '')
  const sec: Section = { n, html: clean(main, doc, images), choices, combats }
  if (/immune to (Mindblast|Psi-surge|Kai-surge|psychic|all (forms of )?psychic|Mindforce)/i.test(text)) sec.immune = true
  if (/Random Number Table/i.test(text)) sec.random = true
  if (!choices.length) {
    const paras = [...main.querySelectorAll('p')].map((p) => norm(p.textContent ?? '')).filter(Boolean)
    const tail = paras.slice(-2).join(' ')
    // Code puzzles and "return to the number you noted" sections have no link but carry on.
    const puzzle = /\b(turn to the (entry|section)|entry number|section number|number (that|which) (they|it) indicate|return to the (adventure|section|entry) number|same as your total)/i.test(text)
    sec.end = !puzzle && DEATH.some((r) => r.test(tail)) ? 'death' : 'end'
  }
  return sec
}

export function parsePage(name: string, doc: Document, images: Set<string>): Page {
  const main = mainOf(doc)!
  const h = main.querySelector('h2, h3')
  const title = norm(h?.textContent ?? '') || norm(doc.title ?? '').replace(/^.*?:\s*/, '') || name
  return { name, title, html: clean(main, doc, images) }
}

function abilitiesOf(doc: Document): string[] {
  const main = mainOf(doc)!
  const h5 = [...main.querySelectorAll('h5')].map((h) => norm(h.textContent ?? ''))
  const list = h5.length >= 5 ? h5 : [...main.querySelectorAll('h4')].map((h) => norm(h.textContent ?? ''))
  return list.filter((t) => t && !/^(Kai (and|&) Magnakai Disciplines|Magical Powers|New Order Kai Grand Master Disciplines|Wizard’s Staff|Wizard's Staff)$/i.test(t) && !/^The /.test(t))
}

const ORDER: Record<string, number> = { lw: 0, dd: 100, gs: 200, fw: 300 }

/** files: name -> text for every .htm in the book folder. */
export function parseBook(id: string, files: Map<string, string>, parseHtml: ParseHtml): Book {
  const images = new Set<string>()
  const sections: Record<number, Section> = {}
  const pages: Record<string, Page> = {}
  let abilities: string[] = []
  let title = id
  let pageOrder: string[] = []
  for (const [file, html] of files) {
    const name = file.replace(/\.htm$/, '')
    if (/^ill\d+$/.test(name)) continue
    const doc = parseHtml(html)
    const n = sectNum(file)
    if (n != null) { sections[n] = parseSection(n, doc, images); continue }
    if (name === 'title') title = norm(doc.title ?? '').replace(/:\s*Title Page$/i, '') || id
    if (['discplnz', 'powers', 'sskills'].includes(name)) {
      const found = abilitiesOf(doc)
      if (found.length > abilities.length) abilities = found
    }
    if (name === 'toc') {
      pageOrder = [...(mainOf(doc)?.querySelectorAll('a[href]') ?? [])]
        .map((a) => /^([a-z0-9]+)\.htm$/i.exec(a.getAttribute('href') ?? '')?.[1])
        .filter((x): x is string => !!x && !/^sect\d/.test(x) && !/^ill\d/.test(x))
    }
    pages[name] = parsePage(name, doc, images)
  }
  pageOrder = [...new Set(pageOrder.filter((p) => pages[p]))]
  const nums = Object.keys(sections).map(Number)
  const lastSection = Math.max(...nums)
  // The highest-numbered section is the book's successful ending (it often says "your quest ends here").
  if (sections[lastSection] && !sections[lastSection].choices.length) sections[lastSection].end = 'win'
  const [series, dir] = id.split('/')
  const order = (dir === 'dotd' ? ORDER.dd : ORDER[series] ?? 900) + (parseInt(dir, 10) || 0)
  return { id, title, order, sections, lastSection, pages, pageOrder, abilities, images: [...images], importedAt: Date.now() }
}
