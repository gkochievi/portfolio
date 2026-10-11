/** Shell-level demo actions shared by the DemoBar, login page and user menu. */
import { DEFAULT_TENANT_ID, session, setActingTenantId, store } from '@/demo'
import { router } from '@/router'
import { queryClient } from '@/lib/queryClient'

/** Role -> home route (operator: console; others: their account's home). */
export function homeFor(accountId: string | null | undefined): string {
  const account = session.accounts.find((a) => a.id === accountId)
  return account?.home ?? '/'
}

/** One-click sign-in as a seeded account, then land on its home (or `next`). */
export function signInAs(accountId: string, next?: string | null): void {
  session.signIn(accountId)
  queryClient.clear()
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : null
  void router.navigate(safeNext ?? homeFor(accountId))
}

/** Sign out and land on the sign-in page (it also links back to the public tools as a guest). */
export function signOut(): void {
  session.signOut()
  queryClient.clear()
  void router.navigate('/login')
}

/** Restore the pristine seed without a reload. */
export function resetDemo(): void {
  store.reset()
  setActingTenantId(DEFAULT_TENANT_ID)
  queryClient.clear()
}

/** Operator act-as switch: change tenant and drop every cached query. */
export function actAs(tenantId: string): void {
  setActingTenantId(tenantId)
  queryClient.clear()
}
