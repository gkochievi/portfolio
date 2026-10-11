/** Starts every timed behaviour once, from main.tsx. Owner: architect (append-only). */
import { startStandingsSimulator } from './standings'

export function startSimulators(): () => void {
  const stops = [startStandingsSimulator()]
  return () => {
    for (const stop of stops) stop()
  }
}
