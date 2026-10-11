/**
 * Registers every handler module once, at boot. Architect-owned: do not edit.
 */
import type { MockApi } from '@portfolio/demo-kit'

import { register as auth } from './auth'
import { register as partners } from './partners'
import { register as licensing } from './licensing'
import { register as adminCatalog } from './admin-catalog'
import { register as ops } from './ops'
import { register as invoicing } from './invoicing'
import { register as invoiceTemplates } from './invoice-templates'
import { register as supportDesk } from './support-desk'
import { register as tasks } from './tasks'
import { register as portal } from './portal'
import { register as ledger } from './ledger'

const modules = [auth, partners, licensing, adminCatalog, ops, invoicing, invoiceTemplates, supportDesk, tasks, portal, ledger]

export function registerHandlers(api: MockApi): void {
  for (const register of modules) register(api)
}
