// Runs the app's book parser over an unzipped Project Aon collection and reports what it found.
// Usage: npm run check-books -- /path/to/en/xhtml
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DOMParser } from 'linkedom'
import { parseBook } from '../src/lib/book/parse.ts'

const root = process.argv[2]
const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html') as unknown as Document
const verbose = process.argv.includes('-v')
let problems = 0
for (const series of ['lw', 'gs', 'fw']) {
  for (const dir of readdirSync(join(root, series)).sort()) {
    const folder = join(root, series, dir)
    const files = new Map<string, string>()
    for (const f of readdirSync(folder)) if (f.endsWith('.htm')) files.set(f, readFileSync(join(folder, f), 'utf8'))
    const b = parseBook(`${series}/${dir}`, files, parse)
    const secs = Object.values(b.sections)
    const ends = secs.filter((s) => s.end === 'end').map((s) => s.n)
    const deaths = secs.filter((s) => s.end === 'death').length
    const combats = secs.reduce((n, s) => n + s.combats.length, 0)
    const combatParas = secs.reduce((n, s) => n + (s.html.match(/class="combat"/g)?.length ?? 0), 0)
    const empty = secs.filter((s) => s.html.replace(/<[^>]+>/g, '').trim().length < 20).map((s) => s.n)
    const missing = []; for (let i = 1; i <= b.lastSection; i++) if (!b.sections[i]) missing.push(i)
    const badLinks = secs.flatMap((s) => s.choices.filter((c) => !b.sections[c.to]).map((c) => `${s.n}->${c.to}`))
    console.log(`${b.id.padEnd(11)} ${b.title.slice(0, 26).padEnd(26)} secs=${secs.length} last=${b.lastSection} win=${b.sections[b.lastSection].end} deaths=${deaths} otherEnds=[${ends}] combats=${combats}/${combatParas} abil=${b.abilities.length} pages=${b.pageOrder.length} imgs=${b.images.length}${missing.length ? ' MISSING=' + missing : ''}${empty.length ? ' EMPTY=' + empty : ''}${badLinks.length ? ' BADLINKS=' + badLinks : ''}`)
    if (combats !== combatParas || missing.length || badLinks.length || empty.length) problems++
    if (process.argv.includes("--ends")) for (const n of ends) console.log("   end", n, "::", b.sections[n].html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(-200))
    if (verbose) console.log('   abilities:', b.abilities.join(', '), '\n   pages:', b.pageOrder.join(' '))
  }
}
console.log(problems ? `${problems} book(s) need a look` : 'all books parsed cleanly')
