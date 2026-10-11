/**
 * Owner: shell agent. Who is signed in: in memory only (a reload signs out).
 * Not demo-kit's createSession, because registration and free-text/guest
 * logins create users at runtime; the DemoBar still lists DEMO_ACCOUNTS.
 */
import { useSyncExternalStore } from 'react'

let currentId: string | null = null
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of [...listeners]) listener()
}

export const auth = {
  currentId: (): string | null => currentId,
  isSignedIn: (): boolean => currentId !== null,
  signInAs(userId: string): void {
    if (currentId === userId) return
    currentId = userId
    emit()
  },
  signOut(): void {
    if (currentId === null) return
    currentId = null
    emit()
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}

/** The signed-in user id, re-rendering on change. */
export function useAuthUserId(): string | null {
  return useSyncExternalStore(auth.subscribe, auth.currentId, auth.currentId)
}
