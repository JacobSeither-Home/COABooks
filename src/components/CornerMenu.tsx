// The reader's menu: an emblem in the bottom-right corner. Tapped, the ring grows into a bar of
// tools along the bottom edge (as CAzen's corner mark does) and puts itself away once a tool is
// chosen or the page is touched anywhere else.
import { useEffect, useRef, useState } from 'react'

export interface Spot { id: string; label: string; icon: React.ReactNode; onPick: () => void; disabled?: boolean }

export default function CornerMenu({ spots }: { spots: Spot[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', away, true)
    return () => document.removeEventListener('pointerdown', away, true)
  }, [open])

  return (
    <nav className={`corner ${open ? 'open' : ''}`} ref={ref} aria-label="Tools">
      <button className="corner-mark" aria-expanded={open} aria-label={open ? 'Hide tools' : 'Show tools'} onClick={() => setOpen(!open)}>
        <Emblem />
      </button>
      <div className="corner-bar" {...(open ? {} : { inert: '' as unknown as boolean })}>
        {spots.map((s) => (
          <button key={s.id} className="corner-spot" disabled={s.disabled} onClick={() => { setOpen(false); s.onPick() }}>
            {s.icon}<span>{s.label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}

/** An original mark: a flame inside a ring of twelve rays. */
export function Emblem({ size = 34 }: { size?: number }) {
  const rays = Array.from({ length: 12 }, (_, i) => {
    const a = (i * Math.PI) / 6
    const r1 = 17.5, r2 = i % 2 ? 20.5 : 22.5
    return <line key={i} x1={24 + r1 * Math.sin(a)} y1={24 - r1 * Math.cos(a)} x2={24 + r2 * Math.sin(a)} y2={24 - r2 * Math.cos(a)} />
  })
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden className="emblem">
      <defs>
        <radialGradient id="em-fire" cx="50%" cy="65%" r="60%">
          <stop offset="0" stopColor="#fff6d6" /><stop offset=".45" stopColor="#ffc35a" /><stop offset="1" stopColor="#d9641e" />
        </radialGradient>
      </defs>
      <circle cx="24" cy="24" r="15.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">{rays}</g>
      <path className="emblem-flame" d="M24 11 C28 17 31 20 31 26 a7 7 0 0 1 -14 0 c0 -4 2 -6 4 -8 c0 3 1 5 3 6 c-1 -5 0 -9 0 -13 z" fill="url(#em-fire)" />
    </svg>
  )
}

const ic = (d: string) => <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden><path d={d} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
export const ICONS = {
  die: ic('M12 2 L21 9 L18 20 H6 L3 9 Z M12 2 L16 11 L12 20 L8 11 Z M3 9 L8 11 M21 9 L16 11'),
  pack: ic('M6 8 h12 l1 12 H5 Z M9 8 V6 a3 3 0 0 1 6 0 v2 M5 13 h14'),
  chart: ic('M5 3 h11 l3 3 v15 H5 Z M8 9 h8 M8 13 h8 M8 17 h5'),
  turn: ic('M4 12 h13 M13 7 l5 5 l-5 5'),
  back: ic('M20 12 H7 M11 7 l-5 5 l5 5'),
  book: ic('M3 5 c3 -1 6 -1 9 1 c3 -2 6 -2 9 -1 v14 c-3 -1 -6 -1 -9 1 c-3 -2 -6 -2 -9 -1 Z M12 6 v14'),
  home: ic('M3 11 L12 4 l9 7 M6 10 v10 h12 V10'),
  gear: ic('M12 9 a3 3 0 1 0 0.01 0 M12 2 v3 M12 19 v3 M2 12 h3 M19 12 h3 M5 5 l2 2 M17 17 l2 2 M5 19 l2 -2 M17 7 l2 -2'),
}
