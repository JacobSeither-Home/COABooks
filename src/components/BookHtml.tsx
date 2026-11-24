// Shows a section or page from an imported book: images come from the device, section links move
// the reader, and choices that name a Discipline are marked by whether the character has it.
import { useEffect, useRef } from 'react'
import { imageUrl } from '../lib/db'
import { findItems, type ItemGuess } from '../lib/items'

interface Props {
  bookId: string
  html: string
  onSection?: (n: number) => void
  onPage?: (name: string) => void
  /** Every ability name in this book, and the ones the character has. */
  abilities?: string[]
  owned?: string[]
  className?: string
  /** Make items in the text tappable. */
  onItem?: (g: ItemGuess) => void
}

export default function BookHtml({ bookId, html, onSection, onPage, abilities = [], owned = [], className = '', onItem }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current!
    el.innerHTML = html
    let alive = true
    el.querySelectorAll<HTMLImageElement>('img[data-img]').forEach(async (img) => {
      const url = await imageUrl(bookId, img.dataset.img!)
      if (alive && url) { img.src = url; img.loading = 'lazy' } else if (alive) img.remove()
    })
    // Choices that mention a Discipline / Power.
    if (abilities.length) {
      const lower = owned.map((o) => o.toLowerCase())
      el.querySelectorAll<HTMLElement>('p.choice').forEach((p) => {
        const t = p.textContent ?? ''
        const named = abilities.find((a) => t.includes(a.replace(/\s*\(.*\)$/, '')))
        if (!named) return
        const mine = lower.some((o) => o.startsWith(named.replace(/\s*\(.*\)$/, '').toLowerCase()))
        const negated = /\b(do not|don’t|don't|not) (have|possess)|\bwithout\b|\bor if you do not\b/i.test(t)
        p.classList.add(mine !== negated ? 'can' : 'cannot')
        const badge = document.createElement('span')
        badge.className = 'badge'
        badge.textContent = mine ? `You have ${named.replace(/\s*\(.*\)$/, '')}` : `No ${named.replace(/\s*\(.*\)$/, '')}`
        p.appendChild(badge)
      })
    }
    // Items mentioned in the story become tappable.
    if (onItem) {
      el.querySelectorAll<HTMLElement>('p:not(.choice):not(.combat), li').forEach((p) => {
        const text = p.textContent ?? ''
        const found = findItems(text)
        if (!found.length) return
        // Walk the paragraph's text nodes, wrapping each found span (spans never cross nodes we can't split).
        const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT)
        const nodes: Text[] = []
        while (walker.nextNode()) nodes.push(walker.currentNode as Text)
        let offset = 0
        const spans = nodes.map((n) => { const start = offset; offset += n.data.length; return { n, start, end: offset } })
        for (const [s0, e0, guess] of [...found].reverse()) {
          const host = spans.find((x) => s0 >= x.start && e0 <= x.end)
          if (!host || host.n.parentElement?.closest('a, button')) continue
          const local = s0 - host.start
          const mid = host.n.splitText(local)
          mid.splitText(e0 - s0)
          const b = document.createElement('button')
          b.className = 'item-tap'
          b.type = 'button'
          b.dataset.item = JSON.stringify(guess)
          mid.parentNode!.replaceChild(b, mid)
          b.appendChild(mid)
        }
      })
    }
    // Whole choice paragraphs are tap targets.
    el.querySelectorAll<HTMLElement>('p.choice').forEach((p) => {
      const a = p.querySelector<HTMLElement>('a[data-s]')
      if (a) { p.dataset.go = a.dataset.s!; p.setAttribute('role', 'button'); p.tabIndex = 0 }
    })
    return () => { alive = false }
  }, [bookId, html, abilities.join('|'), owned.join('|'), !!onItem])

  const click = (e: React.MouseEvent | React.KeyboardEvent) => {
    if ('key' in e && e.key !== 'Enter') return
    const t = e.target as HTMLElement
    const item = t.closest<HTMLElement>('[data-item]')
    if (item && onItem) { e.preventDefault(); onItem(JSON.parse(item.dataset.item!)); return }
    const sect = t.closest<HTMLElement>('[data-s], [data-go]')
    if (sect && onSection) { e.preventDefault(); onSection(parseInt(sect.dataset.s ?? sect.dataset.go!, 10)); return }
    const page = t.closest<HTMLElement>('[data-p]')
    if (page && onPage) { e.preventDefault(); onPage(page.dataset.p!) }
  }

  return <div className={`book-text ${className}`} ref={ref} onClick={click} onKeyDown={click} />
}
