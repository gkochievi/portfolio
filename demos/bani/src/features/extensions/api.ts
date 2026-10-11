/** Query hooks for the extensions group. Keys start with `['extensions', ...]`. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/api/queryKeys'
import { api } from '@/api/client'
import { useInvalidateOn } from '@/lib/live'
import type {
  CreateExtensionRequest,
  Extension,
  ExtensionActivity,
  ExtensionLock,
  NextExtensionResponse,
} from '@/types'

export const extensionKeys = {
  all: queryKeys.extensions.all,
  list: queryKeys.extensions.key('list'),
  next: queryKeys.extensions.key('next'),
  lock: queryKeys.extensions.key('lock'),
  activity: queryKeys.extensions.key('activity'),
}

/** The directory, the next free number and the lock all follow `extensions:changed`. */
export function useExtensionsLive(): void {
  useInvalidateOn('extensions:changed', extensionKeys.all)
}

export function useExtensions() {
  return useQuery({
    queryKey: extensionKeys.list,
    queryFn: ({ signal }) => api.get<Extension[]>('/extensions', undefined, signal),
  })
}

export function useNextExtension() {
  return useQuery({
    queryKey: extensionKeys.next,
    queryFn: ({ signal }) => api.get<NextExtensionResponse>('/extensions/next', undefined, signal),
  })
}

export function useExtensionLock() {
  return useQuery({
    queryKey: extensionKeys.lock,
    queryFn: ({ signal }) => api.get<ExtensionLock | null>('/extensions/lock', undefined, signal),
  })
}

export function useStartLock() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<ExtensionLock>('/extensions/lock'),
    onSuccess: (lock) => {
      queryClient.setQueryData(extensionKeys.lock, lock)
      void queryClient.invalidateQueries({ queryKey: extensionKeys.all })
    },
  })
}

export function useReleaseLock() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.delete('/extensions/lock'),
    onSuccess: () => {
      queryClient.setQueryData(extensionKeys.lock, null)
      void queryClient.invalidateQueries({ queryKey: extensionKeys.all })
    },
  })
}

export function useCreateExtension() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateExtensionRequest) => api.post<Extension>('/extensions', input),
    onSuccess: () => {
      queryClient.setQueryData(extensionKeys.lock, null)
      void queryClient.invalidateQueries({ queryKey: extensionKeys.all })
    },
    // A rejected create is logged server-side as create_error; refresh the audit trail.
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: extensionKeys.activity })
    },
  })
}

/** Tab hidden while a lock is held: best-effort, never throws. */
export function sendDisconnectBeacon(): void {
  void api.post('/extensions/beacon', { reason: 'hidden' }).catch(() => undefined)
}

export function useExtensionActivity(enabled = true) {
  useInvalidateOn('extensions:activity', extensionKeys.activity)
  return useQuery({
    queryKey: extensionKeys.activity,
    queryFn: ({ signal }) => api.get<ExtensionActivity[]>('/extensions/activity', undefined, signal),
    enabled,
  })
}

export function usePurgeActivity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<{ deleted: number }>('/extensions/activity/purge'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: extensionKeys.activity })
    },
  })
}

/* ------------------------------------------------------------ pure helpers */

/** Display name derived from an email's local part (what the server stores when no name is sent). */
export function emailToName(email: string): string {
  const trimmed = email.trim()
  const at = trimmed.indexOf('@')
  const base = at >= 0 ? trimmed.slice(0, at) : trimmed
  return base.replace(/[^a-zA-Z0-9._-]+/g, '') || base
}

const SECRET_WORDS = [
  'linden', 'walnut', 'quince', 'cedar', 'hazel', 'juniper', 'alder', 'willow', 'plum', 'fig',
  'chestnut', 'poplar', 'aspen', 'laurel', 'maple', 'birch', 'acorn', 'thyme', 'tarragon', 'saffron',
  'sorrel', 'myrtle', 'elder', 'rowan', 'clover', 'fennel',
]

/** `word-####` from a small neutral word list. */
export function generateSecret(): string {
  const word = SECRET_WORDS[Math.floor(Math.random() * SECRET_WORDS.length)] ?? 'linden'
  const digits = String(1000 + Math.floor(Math.random() * 9000))
  return `${word}-${digits}`
}

/** `mm:ss` for a millisecond remainder. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
