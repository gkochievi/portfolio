/**
 * Partner form + endpoint validation, shared by the UI (react-hook-form) and
 * the mock handlers. Messages are i18n keys in the `partners` namespace
 * (`validation.*`); the handler resolves them to English.
 */
import { z } from 'zod'

import type { Architecture, ContactRole, Currency } from '@/types'

export const CURRENCIES: Currency[] = ['GEL', 'USD', 'EUR']
export const ARCHITECTURES: Architecture[] = ['cloud', 'hybrid', 'onprem']
export const CONTACT_ROLES: ContactRole[] = ['technical', 'management', 'financial', 'legal']
export const MAX_BILLING_EMAILS = 20
export const MAX_PHONE_NUMBERS = 50

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/
const DOMAIN = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i
const PHONE = /^\+?[0-9][0-9 ()-]{4,19}$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
const EMAIL = z.string().email('validation.email')

export const isEmail = (v: string) => EMAIL.safeParse(v).success
export const isPhone = (v: string) => PHONE.test(v)

const optionalText = (max: number) => z.string().trim().max(max, 'validation.tooLong')
const optionalPattern = (re: RegExp, key: string) =>
  z.string().trim().refine((v) => v === '' || re.test(v), key)
const optionalEmail = z.string().trim().refine((v) => v === '' || isEmail(v), 'validation.email')
const optionalDate = z.string().refine((v) => v === '' || DATE.test(v), 'validation.date')
const num = (opts: { int?: boolean; min: number; max?: number }) => {
  let s = z.number({ invalid_type_error: 'validation.required', required_error: 'validation.required' })
  if (opts.int) s = s.int('validation.integer')
  s = s.min(opts.min, 'validation.min')
  if (opts.max !== undefined) s = s.max(opts.max, 'validation.max')
  return s
}

const contactSchema = z.object({
  role: z.enum(['technical', 'management', 'financial', 'legal']),
  name: optionalText(200),
  phone: optionalPattern(PHONE, 'validation.phone'),
  email: optionalEmail,
})

const baseShape = {
  name: z.string().trim().min(1, 'validation.required').max(200, 'validation.tooLong'),
  legalName: optionalText(300),
  companyId: optionalPattern(/^\d{9,11}$/, 'validation.companyId'),
  currency: z.enum(['GEL', 'USD', 'EUR'], { errorMap: () => ({ message: 'validation.required' }) }),
  onboardedAt: optionalDate,
  contractStartOn: optionalDate,
  contractEndOn: optionalDate,
  invoiceGenerationDay: num({ int: true, min: 1, max: 28 }),
  contactEmail: optionalEmail,
  billingEmails: z.array(EMAIL).max(MAX_BILLING_EMAILS, 'validation.maxBillingEmails'),
  pbxServerIp: optionalPattern(IPV4, 'validation.ip'),
  webServerIp: optionalPattern(IPV4, 'validation.ip'),
  webServerDomain: optionalPattern(DOMAIN, 'validation.domain'),
  architecture: z.enum(['cloud', 'hybrid', 'onprem']),
  vpnType: optionalText(100),
  phoneNumbers: z.array(z.string().regex(PHONE, 'validation.phone')).max(MAX_PHONE_NUMBERS, 'validation.maxPhones'),
  contacts: z.array(contactSchema).length(4),
  notes: optionalText(5000),
}

type Dated = { contractStartOn: string; contractEndOn: string }
function contractOrder<T extends Dated>(value: T, ctx: z.RefinementCtx) {
  if (value.contractStartOn && value.contractEndOn && value.contractEndOn < value.contractStartOn) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['contractEndOn'], message: 'validation.endBeforeStart' })
  }
}

export const partnerCreateSchema = z
  .object({
    ...baseShape,
    ratePerPoint: num({ min: 0, max: 100000 }),
    freeMonthlyAllowance: num({ int: true, min: 0, max: 100000 }),
  })
  .superRefine(contractOrder)

export const partnerUpdateSchema = z.object({ ...baseShape, isActive: z.boolean() }).superRefine(contractOrder)

export type PartnerCreateInput = z.infer<typeof partnerCreateSchema>
export type PartnerUpdateInput = z.infer<typeof partnerUpdateSchema>
/** The form holds both shapes; unused fields are ignored per mode. */
export type PartnerFormValues = PartnerCreateInput & { isActive: boolean }

export const rateSchema = z.object({
  ratePerPoint: num({ min: 0, max: 100000 }),
  freeAllowance: num({ int: true, min: 0, max: 100000 }),
  effectiveFrom: z.string().regex(DATE, 'validation.required'),
})
export type RateInput = z.infer<typeof rateSchema>

export const apiKeySchema = z.object({
  label: z.string().trim().min(1, 'validation.required').max(100, 'validation.tooLong'),
  scopes: z.array(z.enum(['user_count:write', 'user_count:read'])).min(1, 'validation.scopes'),
})
export type ApiKeyInput = z.infer<typeof apiKeySchema>

export const portalAdminSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'validation.usernameShort')
    .max(64, 'validation.tooLong')
    .regex(/^[a-z0-9._-]+$/, 'validation.username'),
  fullName: z.string().trim().min(1, 'validation.required').max(200, 'validation.tooLong'),
  email: optionalEmail,
  password: z.string().min(8, 'validation.passwordShort').max(128, 'validation.tooLong'),
})
export type PortalAdminInput = z.infer<typeof portalAdminSchema>

export const documentUploadSchema = z.object({
  kind: z.enum(['contract', 'technical']),
  title: z.string().trim().min(1, 'validation.required').max(200, 'validation.tooLong'),
  filename: z.string().trim().min(1, 'validation.file').max(255, 'validation.tooLong'),
  sizeBytes: z.number().int().min(1, 'validation.file').max(25 * 1024 * 1024, 'validation.fileTooLarge'),
  mimeType: z.string().max(200),
  note: optionalText(500),
})
export const documentVersionSchema = documentUploadSchema.pick({ filename: true, sizeBytes: true, mimeType: true, note: true })
export type DocumentUploadInput = z.infer<typeof documentUploadSchema>
export type DocumentVersionInput = z.infer<typeof documentVersionSchema>

/** Empty form values for a new partner. */
export function emptyPartnerValues(today: string): PartnerFormValues {
  return {
    name: '',
    legalName: '',
    companyId: '',
    currency: 'GEL',
    ratePerPoint: 20,
    freeMonthlyAllowance: 10,
    onboardedAt: today,
    contractStartOn: '',
    contractEndOn: '',
    invoiceGenerationDay: 1,
    contactEmail: '',
    billingEmails: [],
    pbxServerIp: '',
    webServerIp: '',
    webServerDomain: '',
    architecture: 'cloud',
    vpnType: '',
    phoneNumbers: [],
    contacts: CONTACT_ROLES.map((role) => ({ role, name: '', phone: '', email: '' })),
    notes: '',
    isActive: true,
  }
}
