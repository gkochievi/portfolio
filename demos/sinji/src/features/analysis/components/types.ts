import type { Recording } from '@/types'

/** Props every analysis panel receives from the workbench call-detail page. */
export interface AnalysisPanelProps {
  recording: Recording
  /** Seek the player (seconds) and highlight a transcript segment. No-op in text mode. */
  onSeek: (seconds: number | null, segmentIndex?: number) => void
  /** Owner / operator may edit scores and guidance; members are read-only. */
  canEdit: boolean
}
