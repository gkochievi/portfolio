/**
 * Ambient traffic: while the usage screens are open, other workspaces keep
 * using Sinji, so now and then a public voice tool or a knowledge-base job
 * "calls a model" and a row lands through the same `logUsage()` every other
 * screen uses. Pauses when the tab is hidden (`every`).
 */
import { every } from '@portfolio/demo-kit'

import { store } from '@/demo/core'
import { logUsage } from '@/demo/lib/usage-log'

const pick = <T,>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)] as T
const int = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1))

export function startAmbientUsage(): () => void {
  return every(16_000, () => {
    const roll = Math.random()
    if (roll < 0.5) {
      logUsage({
        feature: 'tts',
        group: 'voice',
        capability: 'tts',
        client_id: null,
        actor: pick(['guest', 'guest', 'elene.m@mail.example', 'nika.j@mail.example']),
        provider: 'elevenlabs',
        model: Math.random() < 0.8 ? 'eleven_multilingual_v2' : 'eleven_v3',
        characters: int(40, 620),
        latency_ms: int(520, 2400),
      })
    } else if (roll < 0.75) {
      logUsage({
        feature: 'transcribe',
        group: 'transcription',
        capability: 'stt',
        client_id: null,
        actor: 'guest',
        provider: 'elevenlabs',
        model: 'scribe_v1',
        audio_seconds: int(6, 90),
        latency_ms: int(1100, 5200),
      })
    } else {
      const tenants = store.data.tenants.filter((t) => t.is_active)
      const tenant = pick(tenants)
      logUsage({
        feature: 'embed',
        group: 'kb',
        capability: 'embed',
        client_id: tenant?.id ?? null,
        actor: 'system',
        provider: 'local',
        model: 'multilingual-e5-large',
        input_tokens: int(300, 4200),
        latency_ms: int(80, 360),
      })
    }
  })
}
