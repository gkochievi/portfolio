/**
 * Append an AI-usage row whenever a mock action "calls a model" (OWNED BY THE usage GROUP;
 * every handler may call it). Tokens only - Sinji never shows money.
 */
import type { LlmUsage } from '@/types'
import { bus, store } from '../core'
import { actorName } from '../guards'

export type UsageInput = Pick<LlmUsage, 'feature' | 'group' | 'capability'> & Partial<LlmUsage>

export function logUsage(input: UsageInput): LlmUsage {
  const input_tokens = input.input_tokens ?? 0
  const output_tokens = input.output_tokens ?? 0
  const row: LlmUsage = {
    id: store.nextId('use_'),
    created_at: new Date().toISOString(),
    client_id: null,
    actor: actorName(),
    provider: 'anthropic',
    model: 'claude-sonnet',
    input_tokens,
    output_tokens,
    cache_read_tokens: 0,
    cache_creation_tokens: 0,
    total_tokens: input_tokens + output_tokens,
    byo: false,
    audio_seconds: null,
    characters: null,
    latency_ms: 0,
    ok: true,
    error: null,
    job_id: null,
    conversation_id: null,
    turn_id: null,
    summary_id: null,
    ...input,
  }
  store.data.llmUsage.push(row)
  bus.emit('usage:appended', { count: 1 })
  return row
}
