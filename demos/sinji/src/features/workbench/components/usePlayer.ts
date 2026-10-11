import { useCallback, useEffect, useRef, useState } from 'react'

import { mediaUrl } from '@/lib/media'

export const RATES = [0.75, 1, 1.25, 1.5, 2] as const

export interface PlayerState {
  time: number
  playing: boolean
  rate: number
  duration: number
  /** True when the audio file could not be loaded: a silent clock keeps the demo usable. */
  simulated: boolean
  toggle: () => void
  seek: (seconds: number) => void
  cycleRate: () => void
}

const isTyping = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(target.tagName) || target.getAttribute('role') === 'slider'
}

/**
 * One transport for a call: a real <audio> element when the file loads,
 * otherwise a silent clock. Space toggles play/pause (outside form controls).
 */
export function usePlayer(audioUrl: string | null, duration: number, enabled: boolean): PlayerState {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [rate, setRate] = useState(1)
  const [simulated, setSimulated] = useState(!audioUrl)
  const clock = useRef({ base: 0, at: 0 })
  const playingRef = useRef(false)
  const simRef = useRef(!audioUrl)
  const rateRef = useRef(1)

  useEffect(() => {
    playingRef.current = playing
  }, [playing])
  useEffect(() => {
    simRef.current = simulated
  }, [simulated])
  useEffect(() => {
    rateRef.current = rate
    if (audioRef.current) audioRef.current.playbackRate = rate
  }, [rate])

  // Build the audio element for this recording.
  useEffect(() => {
    setTime(0)
    setPlaying(false)
    setSimulated(!audioUrl)
    if (!audioUrl || !enabled) return
    const audio = new Audio(mediaUrl(audioUrl))
    audio.preload = 'metadata'
    audio.playbackRate = rateRef.current
    const fail = () => {
      simRef.current = true
      setSimulated(true)
    }
    const end = () => setPlaying(false)
    audio.addEventListener('error', fail)
    audio.addEventListener('ended', end)
    audioRef.current = audio
    return () => {
      audio.pause()
      audio.removeEventListener('error', fail)
      audio.removeEventListener('ended', end)
      audioRef.current = null
    }
  }, [audioUrl, enabled])

  // ~10 Hz clock while playing.
  useEffect(() => {
    if (!playing) return
    clock.current = { base: audioRef.current && !simRef.current ? audioRef.current.currentTime : clock.current.base, at: performance.now() }
    const id = window.setInterval(() => {
      if (simRef.current || !audioRef.current) {
        const next = clock.current.base + ((performance.now() - clock.current.at) / 1000) * rateRef.current
        if (duration > 0 && next >= duration) {
          clock.current.base = duration
          setTime(duration)
          setPlaying(false)
        } else setTime(next)
      } else {
        setTime(audioRef.current.currentTime)
      }
    }, 100)
    return () => window.clearInterval(id)
  }, [playing, duration])

  const seek = useCallback(
    (seconds: number) => {
      const t = Math.max(0, Math.min(duration || seconds, seconds))
      clock.current = { base: t, at: performance.now() }
      if (audioRef.current && !simRef.current) audioRef.current.currentTime = t
      setTime(t)
    },
    [duration],
  )

  const toggle = useCallback(() => {
    if (!enabled) return
    if (playingRef.current) {
      audioRef.current?.pause()
      clock.current = { base: clock.current.base, at: performance.now() }
      setPlaying(false)
      return
    }
    const audio = audioRef.current
    if (audio && !simRef.current) {
      void audio.play().then(
        () => setPlaying(true),
        () => {
          simRef.current = true
          setSimulated(true)
          clock.current = { base: audio.currentTime, at: performance.now() }
          setPlaying(true)
        },
      )
    } else {
      clock.current = { base: clock.current.base >= duration ? 0 : clock.current.base, at: performance.now() }
      setPlaying(true)
    }
  }, [enabled, duration])

  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat || isTyping(e.target)) return
      e.preventDefault()
      toggle()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled, toggle])

  const cycleRate = useCallback(() => {
    setRate((r) => {
      const idx = RATES.indexOf(r as (typeof RATES)[number])
      return RATES[(idx + 1) % RATES.length] ?? 1
    })
  }, [])

  return { time, playing, rate, duration, simulated, toggle, seek, cycleRate }
}
