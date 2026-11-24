// A ten-sided die (0–9, like the Random Number Table) that has to be thrown: press on it, drag, and
// let go. A tap or a slow push doesn't roll it. The number is drawn from the device's secure random
// source the moment it leaves your finger; the tumble across the tray is just for show.
import { useEffect, useRef, useState } from 'react'

interface Props {
  onRoll: (n: number) => void
  /** Shown under the tray before the first throw. */
  prompt?: string
  disabled?: boolean
  height?: number
}

const SIZE = 64
const MIN_SPEED = 0.45 // px per ms at release

function secureDigit() {
  const a = new Uint8Array(1)
  do crypto.getRandomValues(a); while (a[0] >= 250) // no bias: 250 = 25 × 10
  return a[0] % 10
}

export default function Dice({ onRoll, prompt = 'Drag the die and throw it', disabled, height = 170 }: Props) {
  const tray = useRef<HTMLDivElement>(null)
  const die = useRef<HTMLDivElement>(null)
  const [face, setFace] = useState<number | null>(null)
  const [rolling, setRolling] = useState(false)
  const [hint, setHint] = useState(prompt)
  const st = useRef({ x: 0, y: 0, a: 0, drag: false, ox: 0, oy: 0, trail: [] as { x: number; y: number; t: number }[], raf: 0 })
  const roll = useRef(onRoll); roll.current = onRoll

  const place = () => {
    const s = st.current
    if (die.current) die.current.style.transform = `translate(${s.x}px, ${s.y}px) rotate(${s.a}deg)`
  }

  useEffect(() => {
    const t = tray.current!
    const s = st.current
    s.x = t.clientWidth / 2 - SIZE / 2; s.y = t.clientHeight / 2 - SIZE / 2
    place()
    return () => cancelAnimationFrame(s.raf)
  }, [])

  useEffect(() => { setHint(prompt) }, [prompt])

  const down = (e: React.PointerEvent) => {
    if (disabled || rolling) return
    const s = st.current
    const r = tray.current!.getBoundingClientRect()
    s.drag = true
    s.ox = e.clientX - r.left - s.x; s.oy = e.clientY - r.top - s.y
    s.trail = [{ x: e.clientX, y: e.clientY, t: performance.now() }]
    ;(e.target as Element).setPointerCapture(e.pointerId)
    die.current?.classList.add('held')
  }
  const move = (e: React.PointerEvent) => {
    const s = st.current
    if (!s.drag) return
    const r = tray.current!.getBoundingClientRect()
    s.x = clamp(e.clientX - r.left - s.ox, 0, r.width - SIZE)
    s.y = clamp(e.clientY - r.top - s.oy, 0, r.height - SIZE)
    s.a += (e.movementX || 0) * 0.6
    const now = performance.now()
    s.trail.push({ x: e.clientX, y: e.clientY, t: now })
    while (s.trail.length > 2 && now - s.trail[0].t > 90) s.trail.shift()
    place()
  }
  const up = () => {
    const s = st.current
    if (!s.drag) return
    s.drag = false
    die.current?.classList.remove('held')
    const a = s.trail[0], b = s.trail[s.trail.length - 1]
    const dt = Math.max(1, (b?.t ?? 0) - (a?.t ?? 0))
    let vx = ((b?.x ?? 0) - (a?.x ?? 0)) / dt, vy = ((b?.y ?? 0) - (a?.y ?? 0)) / dt
    const speed = Math.hypot(vx, vy)
    if (speed < MIN_SPEED || performance.now() - (b?.t ?? 0) > 120) { setHint('Throw it — drag and let go while moving'); return }
    const capped = Math.min(speed, 3.2)
    vx = (vx / speed) * capped; vy = (vy / speed) * capped
    const result = secureDigit()
    tumble(vx, vy, result)
  }

  const tumble = (vx0: number, vy0: number, result: number) => {
    setRolling(true); setHint('')
    const s = st.current
    const r = tray.current!.getBoundingClientRect()
    let vx = vx0 * 16, vy = vy0 * 16 // px per frame-ish
    let spin = (Math.random() < 0.5 ? -1 : 1) * (14 + Math.hypot(vx, vy) * 1.6)
    let last = performance.now()
    let flips = 0
    const started = last
    const step = (now: number) => {
      const k = Math.min(2.5, (now - last) / 16.7); last = now
      s.x += vx * k; s.y += vy * k; s.a += spin * k
      if (s.x < 0) { s.x = 0; vx = Math.abs(vx) * 0.7; spin *= -0.8; bump() }
      if (s.x > r.width - SIZE) { s.x = r.width - SIZE; vx = -Math.abs(vx) * 0.7; spin *= -0.8; bump() }
      if (s.y < 0) { s.y = 0; vy = Math.abs(vy) * 0.7; bump() }
      if (s.y > r.height - SIZE) { s.y = r.height - SIZE; vy = -Math.abs(vy) * 0.7; bump() }
      const drag = Math.pow(0.955, k)
      vx *= drag; vy *= drag; spin *= Math.pow(0.95, k)
      // The face changes as it tumbles, slowing with it.
      const turning = Math.abs(spin)
      if (turning > 1.2 && Math.random() < Math.min(0.9, turning / 22)) { setFace(Math.floor(Math.random() * 10)); flips++ }
      place()
      const moving = Math.hypot(vx, vy) > 0.15 || turning > 0.6
      if (moving && now - started < 3200) { s.raf = requestAnimationFrame(step); return }
      s.a = Math.round(s.a / 36) * 36 // settle flat
      place()
      setFace(result)
      setRolling(false)
      setHint(prompt)
      void flips
      if (navigator.vibrate) navigator.vibrate(12)
      roll.current(result)
    }
    const bump = () => { if (navigator.vibrate) navigator.vibrate(6) }
    s.raf = requestAnimationFrame(step)
  }

  return (
    <div className={`dice ${disabled ? 'off' : ''}`}>
      <div className="tray" ref={tray} style={{ height }} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <div className={`die ${rolling ? 'rolling' : ''}`} ref={die} onPointerDown={down} role="button" aria-label="Die: drag and release to throw">
          <svg viewBox="0 0 64 64" width={SIZE} height={SIZE} aria-hidden>
            <polygon points="32,2 61,24 52,58 12,58 3,24" className="die-body" />
            <polygon points="32,2 46,30 32,58 18,30" className="die-face" />
            <line x1="3" y1="24" x2="18" y2="30" className="die-edge" /><line x1="61" y1="24" x2="46" y2="30" className="die-edge" />
            <line x1="12" y1="58" x2="18" y2="30" className="die-edge" /><line x1="52" y1="58" x2="46" y2="30" className="die-edge" />
            <text x="32" y="38" textAnchor="middle" className="die-num">{face ?? '?'}</text>
            {face === 6 || face === 9 ? <line x1="26" y1="42" x2="38" y2="42" className="die-underline" /> : null}
          </svg>
        </div>
      </div>
      <div className="dice-hint">{hint}</div>
    </div>
  )
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
