/**
 * The four one-click demo accounts (from the brand brief). Password for all: `sinji-demo`.
 * Owned by the shell agent. Guests (signed out) use the public voice tools at `/`.
 */
import type { SinjiAccount } from '@/types'

export const DEMO_PASSWORD = 'sinji-demo'

export const accounts: SinjiAccount[] = [
  {
    id: 'acc_levan',
    name: 'Levan Kipiani',
    name_ka: 'ლევან ყიფიანი',
    email: 'levan@sinji.example',
    password: DEMO_PASSWORD,
    role: 'operator',
    persona: 'operator',
    roleLabel: 'Platform operator',
    roleLabel_ka: 'პლატფორმის ოპერატორი',
    description: 'Runs Sinji for every customer: workspaces, AI providers, usage, server health, bot kill switch.',
    description_ka: 'მართავს სინჯს ყველა კლიენტისთვის: სივრცეები, AI პროვაიდერები, მოხმარება, სერვერის ჯანმრთელობა, ბოტის გამორთვა.',
    tenantId: null,
    home: '/console/tenants',
    avatarColor: '#3d64a0',
  },
  {
    id: 'acc_tamar',
    name: 'Tamar Gelashvili',
    name_ka: 'თამარ გელაშვილი',
    email: 'tamar@sinji.example',
    password: DEMO_PASSWORD,
    role: 'owner',
    persona: 'owner',
    roleLabel: 'Head of QA, Mtiebi Bank',
    roleLabel_ka: 'ხარისხის ხელმძღვანელი, მთიები ბანკი',
    description: 'Owns the workspace: calls, knowledge base, rubric, curation, bot settings.',
    description_ka: 'მართავს სამუშაო სივრცეს: ზარები, ცოდნის ბაზა, რუბრიკა, კურაცია, ბოტის პარამეტრები.',
    tenantId: 'tn_mtiebi',
    home: '/workspace/calls/rec_mtb_01',
    avatarColor: '#0d6b5a',
  },
  {
    id: 'acc_nino',
    name: 'Nino Kurtanidze',
    name_ka: 'ნინო ქურთანიძე',
    email: 'nino@sinji.example',
    password: DEMO_PASSWORD,
    role: 'member',
    persona: 'member',
    roleLabel: 'QA reviewer, Mtiebi Bank',
    roleLabel_ka: 'ხარისხის შემფასებელი, მთიები ბანკი',
    description: 'Uploads and reviews calls; settings are read-only.',
    description_ka: 'ტვირთავს და აფასებს ზარებს; პარამეტრები მხოლოდ საკითხავია.',
    tenantId: 'tn_mtiebi',
    home: '/workspace/calls',
    avatarColor: '#985722',
  },
  {
    id: 'acc_saba',
    name: 'Saba Lomidze',
    name_ka: 'საბა ლომიძე',
    email: 'saba@sinji.example',
    password: DEMO_PASSWORD,
    role: 'member',
    persona: 'agent',
    roleLabel: 'Contact-centre agent, Mtiebi Bank',
    roleLabel_ka: 'ქოლ-ცენტრის ოპერატორი, მთიები ბანკი',
    description: 'Answers web-chat customers with grounded copilot drafts after the bot hands off.',
    description_ka: 'პასუხობს ვებ-ჩატის მომხმარებლებს კოპილოტის დასაბუთებული მონახაზებით.',
    tenantId: 'tn_mtiebi',
    home: '/copilot',
    avatarColor: '#4a7424',
  },
]

/** The tenant the operator acts as until they pick another one. */
export const DEFAULT_TENANT_ID = 'tn_mtiebi'
