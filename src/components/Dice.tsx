// The die is 3D (three.js), so it loads on first use rather than with the rest of the app.
import { lazy, Suspense } from 'react'
import type { DiceProps } from './Dice3D'

const Dice3D = lazy(() => import('./Dice3D'))

export default function Dice(props: DiceProps) {
  return (
    <Suspense fallback={<div className="dice"><div className="tray" style={{ height: props.height ?? 170 }} /><div className="dice-hint">Bringing out the die…</div></div>}>
      <Dice3D {...props} />
    </Suspense>
  )
}
