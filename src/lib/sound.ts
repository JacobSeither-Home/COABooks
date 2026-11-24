// Dice sounds, made on the spot with Web Audio: no sound files to download or cache. A hard bone
// clack for die-on-felt, a lower wooden knock for the tray's walls, a soft tick on pick-up.
// Browsers only allow sound after a touch, so the audio starts on the first press of the die.

const KEY = 'coa.sound'
let ctx: AudioContext | null = null
let noise: AudioBuffer | null = null

export function soundOn(): boolean {
  try { return localStorage.getItem(KEY) !== 'off' } catch { return true }
}
export function setSoundOn(on: boolean) {
  try { localStorage.setItem(KEY, on ? 'on' : 'off') } catch { /* ignore */ }
}

/** Call from a touch or click handler: creates or resumes the audio context. */
export function unlockAudio() {
  if (!soundOn()) return
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      ctx = new AC()
      noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.25), ctx.sampleRate)
      const d = noise.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    }
    if (ctx.state === 'suspended') void ctx.resume()
  } catch { ctx = null }
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)

function burst(opts: { freq: number; q: number; gain: number; decay: number; tone?: number; toneGain?: number }) {
  if (!ctx || !noise || !soundOn() || ctx.state !== 'running') return
  const t = ctx.currentTime
  const src = ctx.createBufferSource()
  src.buffer = noise
  src.playbackRate.value = rand(0.85, 1.15)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'; bp.frequency.value = opts.freq; bp.Q.value = opts.q
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(opts.gain, t + 0.002)
  g.gain.exponentialRampToValueAtTime(0.0001, t + opts.decay)
  src.connect(bp).connect(g).connect(ctx.destination)
  src.start(t, rand(0, 0.15), opts.decay + 0.02)
  if (opts.tone) {
    const o = ctx.createOscillator()
    o.type = 'triangle'; o.frequency.setValueAtTime(opts.tone, t); o.frequency.exponentialRampToValueAtTime(opts.tone * 0.7, t + 0.03)
    const og = ctx.createGain()
    og.gain.setValueAtTime(0.0001, t)
    og.gain.exponentialRampToValueAtTime(opts.toneGain ?? 0.1, t + 0.002)
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.035)
    o.connect(og).connect(ctx.destination)
    o.start(t); o.stop(t + 0.05)
  }
}

/** Die hits the felt. strength 0–1. */
export function clack(strength: number) {
  const s = Math.max(0.05, Math.min(1, strength))
  burst({ freq: rand(2200, 3600), q: rand(1.2, 2.5), gain: 0.55 * s, decay: rand(0.035, 0.07), tone: rand(1500, 2300), toneGain: 0.12 * s })
}

/** Die hits the tray's wooden rim. */
export function knock(strength: number) {
  const s = Math.max(0.05, Math.min(1, strength))
  burst({ freq: rand(650, 950), q: rand(2, 4), gain: 0.7 * s, decay: rand(0.06, 0.1), tone: rand(320, 420), toneGain: 0.18 * s })
  burst({ freq: rand(2600, 3400), q: 2, gain: 0.25 * s, decay: 0.03 })
}

export function tick() {
  burst({ freq: 3000, q: 3, gain: 0.12, decay: 0.025 })
}
