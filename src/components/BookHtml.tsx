// Shows a section or page from an imported book: images come from the device, section links move
// the reader, and choices that name a Discipline are marked by whether the character has it.
import { useEffect, useRef } from 'react'
import { imageUrl } from '../lib/db'

interface Props {
  bookId: string
  html: string
  onSection?: (n: number) => void
  onPage?: (name: string) => void
  /** Every ability name in this book, and the ones the character has. */
  abilities?: string[]
  owned?: string[]
  className?: string
}

export default function BookHtml({ bookId, html, onSection, onPage, abilities = [], owned = [], className = '' }: Props) {
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
    // Whole choice paragraphs are tap targets.
    el.querySelectorAll<HTMLElement>('p.choice').forEach((p) => {
      const a = p.querySelector<HTMLElement>('a[data-s]')
      if (a) { p.dataset.go = a.dataset.s!; p.setAttribute('role', 'button'); p.tabIndex = 0 }
    })
    return () => { alive = false }
  }, [bookId, html, abilities.join('|'), owned.join('|')])

  const click = (e: React.MouseEvent | React.KeyboardEvent) => {
    if ('key' in e && e.key !== 'Enter') return
    const t = e.target as HTMLElement
    const sect = t.closest<HTMLElement>('[data-s], [data-go]')
    if (sect && onSection) { e.preventDefault(); onSection(parseInt(sect.dataset.s ?? sect.dataset.go!, 10)); return }
    const page = t.closest<HTMLElement>('[data-p]')
    if (page && onPage) { e.preventDefault(); onPage(page.dataset.p!) }
  }

  return <div className={`book-text ${className}`} ref={ref} onClick={click} onKeyDown={click} />
}
