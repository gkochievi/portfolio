/**
 * Shared lookups for console filters, the inbox tenant chips and the send form.
 *
 * Owner: seed agent. Endpoints (see PLAN.md):
 *   GET /api/meta  -> MetaLookups (tenants, branches, staff, campaigns)
 */
import type { MetaLookups } from '@/types'
import { api, store } from '../core'

api.register('GET', '/meta', (): MetaLookups => {
  const { tenants, branches, staff, campaigns } = store.data
  return { tenants, branches, staff, campaigns }
})
