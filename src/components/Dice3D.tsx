// A real ten-sided die (a pentagonal trapezohedron, 0–9 like the Random Number Table), rendered in
// 3D: grab it, drag, and let go while moving. It tumbles across the felt showing the numbers on its
// sides, bounces off the tray's rim, and comes to rest with one face up. A tap or a slow push doesn't
// roll it. The number is drawn from the device's secure random source the moment it leaves your
// finger; the physics decide only how it looks getting there.
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { clack, knock, setSoundOn, soundOn, tick, unlockAudio } from '../lib/sound'

export interface DiceProps {
  onRoll: (n: number) => void
  prompt?: string
  disabled?: boolean
  height?: number
}

const R = 0.8 // die size in world units
const HALF_H = 2.25 // half the tray's visible height, world units
const FOV = 32
const MIN_SPEED = 2.2 // world units / s at release

function secureDigit() {
  const a = new Uint8Array(1)
  do crypto.getRandomValues(a); while (a[0] >= 250)
  return a[0] % 10
}

interface Face { number: number; normal: THREE.Vector3; up: THREE.Vector3 }

/** Pentagonal trapezohedron: kite faces, opposite faces parallel and summing to 9. */
function buildDie() {
  const h = R, a = R * 0.10557280900008409, r = R * 0.93
  const T = new THREE.Vector3(0, 0, h), B = new THREE.Vector3(0, 0, -h)
  const U = (k: number) => new THREE.Vector3(r * Math.cos((k * 72 * Math.PI) / 180), r * Math.sin((k * 72 * Math.PI) / 180), a)
  const L = (k: number) => new THREE.Vector3(r * Math.cos(((k * 72 + 36) * Math.PI) / 180), r * Math.sin(((k * 72 + 36) * Math.PI) / 180), -a)
  // [apex, side, far, side]
  const kites: THREE.Vector3[][] = []
  for (let k = 0; k < 5; k++) kites.push([T, U(k), L(k), U(k + 1)])
  for (let k = 0; k < 5; k++) kites.push([B, L(k + 1), U(k + 1), L(k)])
  const upperNumbers = [1, 7, 3, 9, 5]
  const normals = kites.map(([p0, p1, , p3]) => new THREE.Vector3().subVectors(p1, p0).cross(new THREE.Vector3().subVectors(p3, p0)).normalize())
  // Make every normal point outward.
  kites.forEach((k, i) => { const c = k.reduce((s, v) => s.add(v), new THREE.Vector3()).multiplyScalar(0.25); if (normals[i].dot(c) < 0) { normals[i].negate(); kites[i] = [k[0], k[3], k[2], k[1]] } })
  const numbers: number[] = new Array(10)
  for (let i = 0; i < 5; i++) {
    numbers[i] = upperNumbers[i]
    const opp = normals.findIndex((n, j) => j >= 5 && n.dot(normals[i]) < -0.999)
    numbers[opp] = 9 - upperNumbers[i]
  }
  const inradius = normals[0].dot(kites[0][0])

  const groups: THREE.BufferGeometry[] = []
  const faces: Face[] = []
  kites.forEach((k, i) => {
    const n = normals[i]
    const centre = k.reduce((s, v) => s.add(v), new THREE.Vector3()).multiplyScalar(0.25)
    // Text runs from the far vertex toward the apex.
    const up = new THREE.Vector3().subVectors(k[0], k[2]).projectOnPlane(n).normalize()
    const right = new THREE.Vector3().crossVectors(up, n).normalize()
    const pts2 = k.map((v) => { const d = new THREE.Vector3().subVectors(v, centre); return [d.dot(right), d.dot(up)] })
    const span = Math.max(...pts2.map((p) => Math.max(Math.abs(p[0]), Math.abs(p[1])))) * 2
    const uv = pts2.map(([x, y]) => [0.5 + x / span, 0.5 + y / span + 0.06])
    const g = new THREE.BufferGeometry()
    const tri = [0, 1, 2, 0, 2, 3]
    g.setAttribute('position', new THREE.Float32BufferAttribute(tri.flatMap((j) => k[j].toArray()), 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(tri.flatMap((j) => uv[j]), 2))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(tri.flatMap(() => n.toArray()), 3))
    groups.push(g)
    faces.push({ number: numbers[i], normal: n.clone(), up })
  })
  return { groups, faces, inradius }
}

function numberTexture(n: number) {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(64, 60, 10, 64, 64, 90)
  grad.addColorStop(0, '#fbf3df'); grad.addColorStop(1, '#e6d6b2')
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128)
  g.fillStyle = '#7c1f19'
  g.font = 'bold 62px "Iowan Old Style", Palatino, Georgia, serif'
  g.textAlign = 'center'; g.textBaseline = 'middle'
  g.fillText(String(n), 64, 66)
  if (n === 6 || n === 9) g.fillRect(48, 96, 32, 5)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

function shadowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32)
  grad.addColorStop(0, 'rgba(0,0,0,0.55)'); grad.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}

export default function Dice3D({ onRoll, prompt = 'Grab the die and throw it', disabled, height = 170 }: DiceProps) {
  const host = useRef<HTMLDivElement>(null)
  const [hint, setHint] = useState(prompt)
  const [face, setFace] = useState<number | null>(null)
  const [sound, setSound] = useState(soundOn())
  const api = useRef<{ setDisabled: (d: boolean) => void } | null>(null)
  const rollRef = useRef(onRoll); rollRef.current = onRoll
  const promptRef = useRef(prompt); promptRef.current = prompt

  useEffect(() => { setHint(prompt) }, [prompt])
  useEffect(() => { api.current?.setDisabled(!!disabled) }, [disabled])

  useEffect(() => {
    const el = host.current!
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    el.appendChild(renderer.domElement)
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 50)
    const dist = HALF_H / Math.tan(((FOV / 2) * Math.PI) / 180)
    camera.position.set(0, 0, dist)
    camera.lookAt(0, 0, 0)
    scene.add(new THREE.HemisphereLight(0xfff4e0, 0x2a3a26, 1.25))
    const sun = new THREE.DirectionalLight(0xffffff, 1.6)
    sun.position.set(-2.5, 3.5, 6)
    scene.add(sun)

    const { groups, faces, inradius } = buildDie()
    const textures = faces.map((f) => numberTexture(f.number))
    const die = new THREE.Group()
    groups.forEach((g, i) => die.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: textures[i], roughness: 0.38, metalness: 0.02 }))))
    scene.add(die)
    const shadowTex = shadowTexture()
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }))
    scene.add(shadow)

    let halfW = HALF_H
    let off = false
    const pos = new THREE.Vector3(0, 0, inradius)
    const vel = new THREE.Vector3()
    const spin = new THREE.Vector3()
    die.quaternion.setFromEuler(new THREE.Euler(0.4, 0.3, 0.2))
    restOn(Math.floor(Math.random() * 10), 0) // start lying flat

    let mode: 'idle' | 'held' | 'flying' | 'settling' | 'dropping' = 'idle'
    let result = 0
    let started = 0
    let settleFrom = new THREE.Quaternion(), settleTo = new THREE.Quaternion(), settleStart = 0, settleZ = 0
    const trail: { x: number; y: number; t: number }[] = []
    let raf = 0
    let last = 0

    function targetFor(n: number, around: number) {
      const f = faces.find((x) => x.number === n)!
      const q = new THREE.Quaternion().setFromUnitVectors(f.normal, new THREE.Vector3(0, 0, 1))
      const up = f.up.clone().applyQuaternion(q)
      const turn = Math.atan2(up.x, up.y) + around // rotate so the number reads upright, give or take
      return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), turn).multiply(q)
    }
    function restOn(n: number, around: number) { die.quaternion.copy(targetFor(n, around)); pos.z = inradius }

    function layout() {
      const w = el.clientWidth, h = el.clientHeight
      renderer.setSize(w, h, false)
      renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%'
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      halfW = HALF_H * camera.aspect
      pos.x = clamp(pos.x, -halfW + R, halfW - R); pos.y = clamp(pos.y, -HALF_H + R, HALF_H - R)
      draw()
    }
    function draw() {
      die.position.copy(pos)
      const lift = Math.max(0, pos.z - inradius)
      shadow.position.set(pos.x + lift * 0.18, pos.y - lift * 0.22, 0.001)
      const s = R * 2.4 * (1 + lift * 0.25)
      shadow.scale.set(s, s, 1)
      ;(shadow.material as THREE.MeshBasicMaterial).opacity = Math.max(0.25, 1 - lift * 0.35)
      renderer.render(scene, camera)
    }

    const ray = new THREE.Raycaster()
    function toWorld(e: PointerEvent, z: number) {
      const r = el.getBoundingClientRect()
      const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
      const t = (z - ray.ray.origin.z) / ray.ray.direction.z
      return ray.ray.origin.clone().addScaledVector(ray.ray.direction, t)
    }

    function loop(now: number) {
      const dt = Math.min(0.033, (now - last) / 1000 || 0.016); last = now
      if (mode === 'flying' || mode === 'dropping') step(dt, now)
      else if (mode === 'settling') settle(now)
      draw()
      if (mode !== 'idle') raf = requestAnimationFrame(loop)
    }
    function start() { cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(loop) }

    function step(dt: number, now: number) {
      vel.z -= 32 * dt
      pos.addScaledVector(vel, dt)
      const ang = spin.length()
      if (ang > 0.0001) die.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(spin.clone().normalize(), ang * dt))
      if (pos.z < inradius) {
        pos.z = inradius
        if (vel.z < -1.2) {
          const hit = -vel.z
          vel.z = hit * 0.42
          vel.x *= 0.82; vel.y *= 0.82
          spin.multiplyScalar(0.78).add(new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(hit * 0.9))
          clack(hit / 11)
        } else {
          vel.z = 0
          // Sliding and rolling on the felt.
          const f = Math.pow(0.18, dt)
          vel.x *= f; vel.y *= f
          spin.multiplyScalar(Math.pow(0.12, dt))
          // Rolling: spin follows the direction of travel.
          spin.add(new THREE.Vector3(-vel.y, vel.x, 0).multiplyScalar(dt * 4 / R))
        }
      }
      const wallX = halfW - R * 0.9, wallY = HALF_H - R * 0.9
      if (Math.abs(pos.x) > wallX) { pos.x = Math.sign(pos.x) * wallX; const v = Math.abs(vel.x); vel.x = -vel.x * 0.55; spin.z += rand(-6, 6); spin.y += -Math.sign(pos.x) * v * 1.5; if (v > 0.5) knock(v / 9) }
      if (Math.abs(pos.y) > wallY) { pos.y = Math.sign(pos.y) * wallY; const v = Math.abs(vel.y); vel.y = -vel.y * 0.55; spin.z += rand(-6, 6); spin.x += Math.sign(pos.y) * v * 1.5; if (v > 0.5) knock(v / 9) }
      const slow = Math.hypot(vel.x, vel.y) < 0.35 && Math.abs(vel.z) < 0.5 && pos.z <= inradius + 0.02 && spin.length() < 3.5
      if ((slow && now - started > 700) || now - started > 2800) beginSettle(now)
    }

    function beginSettle(now: number) {
      settleFrom = die.quaternion.clone()
      // Land on the drawn number, turned whichever way is nearest to how the die is lying.
      let best = targetFor(result, 0), bestAngle = Infinity
      for (let k = -3; k <= 3; k++) {
        const q = targetFor(result, (k * Math.PI) / 3 + rand(-0.25, 0.25))
        const a = settleFrom.angleTo(q)
        if (a < bestAngle) { bestAngle = a; best = q }
      }
      settleTo = best
      settleStart = now
      settleZ = pos.z
      mode = 'settling'
    }
    function settle(now: number) {
      const t = Math.min(1, (now - settleStart) / 380)
      const e = 1 - Math.pow(1 - t, 3)
      die.quaternion.slerpQuaternions(settleFrom, settleTo, e)
      // A small rock onto the final face.
      pos.z = inradius + (settleZ - inradius) * (1 - e) + Math.sin(e * Math.PI) * 0.08
      pos.x += vel.x * 0.004 * (1 - e); pos.y += vel.y * 0.004 * (1 - e)
      if (t >= 1) {
        pos.z = inradius
        mode = 'idle'
        clack(0.25)
        setFace(result)
        setHint(promptRef.current)
        if (navigator.vibrate) navigator.vibrate(12)
        rollRef.current(result)
      }
    }

    const down = (e: PointerEvent) => {
      if (off || mode !== 'idle') return
      unlockAudio()
      const p = toWorld(e, inradius)
      if (p.distanceTo(new THREE.Vector3(pos.x, pos.y, inradius)) > R * 1.6) { setHint('Grab the die itself'); return }
      mode = 'held'
      el.setPointerCapture(e.pointerId)
      trail.length = 0
      trail.push({ x: p.x, y: p.y, t: performance.now() })
      tick()
      start()
    }
    const move = (e: PointerEvent) => {
      if (mode !== 'held') return
      const p = toWorld(e, R * 1.8)
      const nx = clamp(p.x, -halfW + R, halfW - R), ny = clamp(p.y, -HALF_H + R, HALF_H - R)
      const dx = nx - pos.x, dy = ny - pos.y
      pos.set(nx, ny, R * 1.8)
      die.quaternion.premultiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-dy * 1.4, dx * 1.4, dx * 0.4)))
      const now = performance.now()
      trail.push({ x: nx, y: ny, t: now })
      while (trail.length > 2 && now - trail[0].t > 90) trail.shift()
    }
    const up = () => {
      if (mode !== 'held') return
      const a = trail[0], b = trail[trail.length - 1]
      const now = performance.now()
      const dt = Math.max(0.001, (b.t - a.t) / 1000)
      let vx = (b.x - a.x) / dt, vy = (b.y - a.y) / dt
      const speed = Math.hypot(vx, vy)
      started = now
      if (speed < MIN_SPEED || now - b.t > 120) {
        // Too gentle: it just drops back onto the felt.
        vel.set(0, 0, 0); spin.set(rand(-2, 2), rand(-2, 2), 0)
        mode = 'dropping'
        setHint('Throw it — drag and let go while moving')
        const check = () => { if (mode === 'dropping' && pos.z <= inradius + 0.001 && Math.abs(vel.z) < 0.01) { restOnNearest(); mode = 'idle'; draw() } else if (mode === 'dropping') requestAnimationFrame(check) }
        requestAnimationFrame(check)
        return
      }
      const cap = 16
      if (speed > cap) { vx *= cap / speed; vy *= cap / speed }
      result = secureDigit()
      vel.set(vx, vy, rand(5, 8))
      const s = Math.min(speed, cap)
      spin.set(-vy * 2.2 + rand(-8, 8), vx * 2.2 + rand(-8, 8), rand(-10, 10)).multiplyScalar(0.6 + s / 30)
      mode = 'flying'
      setHint('')
    }
    function restOnNearest() {
      let best = 0, bestDot = -2
      faces.forEach((f) => { const d = f.normal.clone().applyQuaternion(die.quaternion).z; if (d > bestDot) { bestDot = d; best = f.number } })
      restOn(best, rand(-0.3, 0.3))
    }

    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    const ro = new ResizeObserver(layout)
    ro.observe(el)
    layout()
    api.current = { setDisabled: (d) => { off = d } }

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      groups.forEach((g) => g.dispose())
      textures.forEach((t) => t.dispose())
      shadowTex.dispose()
      die.children.forEach((m) => ((m as THREE.Mesh).material as THREE.Material).dispose())
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    }
  }, [])

  return (
    <div className={`dice ${disabled ? 'off' : ''}`}>
      <div className="tray" style={{ height }}>
        <div className="tray-3d" ref={host} aria-label="Ten-sided die: grab it, drag, and let go to throw" role="button" />
        <button className="sound-btn" aria-label={sound ? 'Turn dice sound off' : 'Turn dice sound on'}
          onClick={() => { const next = !sound; setSound(next); setSoundOn(next); if (next) unlockAudio() }}>
          {sound ? <SpeakerOn /> : <SpeakerOff />}
        </button>
        {face != null ? <div className="tray-result" aria-live="polite">{face}</div> : null}
      </div>
      <div className="dice-hint">{hint}</div>
    </div>
  )
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

const SpeakerOn = () => <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" /><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" /></svg>
const SpeakerOff = () => <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" /><path d="M16.5 9.5l5 5m0-5l-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
