/**
 * Platform-level seed: workspaces (tenants), their users, registered users,
 * the AI provider registry, chat integrations, bot configs, kill switch,
 * limits and platform settings. Fictional companies; `.example` domains only.
 */
import type {
  AiAssignment,
  AiByoOverride,
  AiConnection,
  AiLegacyOverride,
  AiProviderEntry,
  AppUser,
  BotConfig,
  BotSettings,
  Integration,
  KillState,
  LimitsConfig,
  PlatformSettings,
  Tenant,
  TenantUser,
} from '@/types'
import { ago, keyHint } from './build'

/* -------------------------------------------------------------- tenants */

const tenant = (
  id: string,
  slug: string,
  name: string,
  name_ka: string,
  industry: Tenant['industry'],
  region: string,
  days: number,
  tail: string,
  is_active = true,
): Tenant => ({
  id,
  slug,
  name,
  name_ka,
  industry,
  region,
  is_active,
  api_key_hint: keyHint(tail),
  settings: { timezone: 'Asia/Tbilisi', default_language: 'ka' },
  created_at: ago(days),
  users: 0,
  documents: 0,
})

export const tenants: Tenant[] = [
  tenant('tn_mtiebi', 'mtiebi', 'Mtiebi Bank', 'მთიები ბანკი', 'bank', 'Tbilisi', 142, '7Qx2'),
  tenant('tn_pari', 'pari', 'Pari Insurance', 'ფარი დაზღვევა', 'insurance', 'Tbilisi', 128, 'Lm4c'),
  tenant('tn_iasamani', 'iasamani', 'Iasamani Clinic', 'კლინიკა იასამანი', 'clinic', 'Telavi', 101, 'p9Ze'),
  tenant('tn_darbazi', 'darbazi', 'Darbazi Telecom', 'დარბაზი ტელეკომი', 'telecom', 'Tbilisi', 96, 'Rr02'),
  tenant('tn_nobati', 'nobati', 'Nobati', 'ნობათი', 'delivery', 'Tbilisi', 77, 'u5Hk'),
  tenant('tn_mzetamze', 'mzetamze', 'Mzetamze Hotels', 'სასტუმროები მზეთამზე', 'hotel', 'Kobuleti', 160, 'Wq8s', false),
]

const tuser = (
  id: string,
  client_id: string,
  username: string,
  display_name: string,
  role: TenantUser['role'],
  days: number,
  lastLogin: number | null,
  is_active = true,
): TenantUser => ({
  id,
  client_id,
  username,
  display_name,
  role,
  is_active,
  created_at: ago(days),
  last_login_at: lastLogin === null ? null : ago(lastLogin, 2),
})

export const tenantUsers: TenantUser[] = [
  tuser('tu_tamar', 'tn_mtiebi', 'tamar@mtiebi.example', 'თამარ გელაშვილი', 'owner', 140, 0),
  tuser('tu_nino', 'tn_mtiebi', 'nino@mtiebi.example', 'ნინო ქურთანიძე', 'member', 120, 0),
  tuser('tu_saba', 'tn_mtiebi', 'saba@mtiebi.example', 'საბა ლომიძე', 'member', 95, 1),
  tuser('tu_giorgi', 'tn_mtiebi', 'giorgi@mtiebi.example', 'გიორგი აბულაძე', 'member', 110, 48, false),
  tuser('tu_mariam', 'tn_pari', 'mariam@pari.example', 'მარიამ აბაშიძე', 'owner', 127, 1),
  tuser('tu_zviad', 'tn_pari', 'zviad@pari.example', 'ზვიად კობახიძე', 'member', 90, 3),
  tuser('tu_ketevan', 'tn_iasamani', 'ketevan@iasamani.example', 'ქეთევან წერეთელი', 'owner', 100, 2),
  tuser('tu_lela', 'tn_iasamani', 'lela@iasamani.example', 'ლელა გოგუა', 'member', 70, 6),
  tuser('tu_irakli', 'tn_darbazi', 'irakli@darbazi.example', 'ირაკლი წიკლაური', 'owner', 95, 2),
  tuser('tu_tea', 'tn_darbazi', 'tea@darbazi.example', 'თეა მიქაძე', 'member', 60, 0),
  tuser('tu_sopo', 'tn_nobati', 'sopo@nobati.example', 'სოფო ჩიქოვანი', 'owner', 76, 4),
  tuser('tu_dato', 'tn_nobati', 'dato@nobati.example', 'დათო მესხი', 'member', 50, 9),
  tuser('tu_natia', 'tn_mzetamze', 'natia@mzetamze.example', 'ნათია დოლიძე', 'owner', 158, 63),
  tuser('tu_beka', 'tn_mzetamze', 'beka@mzetamze.example', 'ბექა შარაშიძე', 'member', 150, 80),
]

/* ------------------------------------------------------- registered users */

const appUser = (
  n: number,
  email: string,
  display_name: string,
  days: number,
  lastLogin: number | null,
  used: AppUser['used'],
  extra: Partial<AppUser> = {},
): AppUser => ({
  id: `au_${String(n).padStart(2, '0')}`,
  email,
  display_name,
  is_active: true,
  created_at: ago(days),
  last_login_at: lastLogin === null ? null : ago(lastLogin, 5),
  limits: {},
  used,
  ...extra,
})

export const appUsers: AppUser[] = [
  appUser(1, 'elene.m@mail.example', 'ელენე მაჭავარიანი', 88, 0, { analyses: 3, tts: 12, conversions: 1 }),
  appUser(2, 'luka.b@mail.example', 'ლუკა ბაქრაძე', 81, 1, { analyses: 1, tts: 4, conversions: 0 }),
  appUser(3, 'maka.ts@mail.example', 'მაკა ცინცაძე', 75, 40, { analyses: 0, tts: 0, conversions: 0 }, { is_active: false }),
  appUser(4, 'nika.j@mail.example', 'ნიკა ჯანელიძე', 70, 0, { analyses: 17, tts: 6, conversions: 4 }, { limits: { analyses: 40 } }),
  appUser(5, 'teona.k@mail.example', 'თეონა ქავთარაძე', 62, 2, { analyses: 2, tts: 20, conversions: 0 }),
  appUser(6, 'giorgi.p@mail.example', 'გიორგი ფანცულაია', 55, 5, { analyses: 0, tts: 3, conversions: 2 }),
  appUser(7, 'salome.g@mail.example', 'სალომე გვაზავა', 49, 0, { analyses: 5, tts: 9, conversions: 1 }),
  appUser(8, 'davit.n@mail.example', 'დავით ნოზაძე', 41, 1, { analyses: 4, tts: 44, conversions: 0 }, { limits: { tts: 100, max_audio_mb: 50 } }),
  appUser(9, 'ia.m@mail.example', 'ია მამულაშვილი', 33, 7, { analyses: 1, tts: 2, conversions: 0 }),
  appUser(10, 'zura.t@mail.example', 'ზურა ტაბატაძე', 27, 21, { analyses: 0, tts: 1, conversions: 0 }, { is_active: false }),
  appUser(11, 'nato.l@mail.example', 'ნატო ლომაია', 14, 0, { analyses: 2, tts: 7, conversions: 3 }),
  appUser(12, 'irine.s@mail.example', 'ირინე სულაბერიძე', 4, 0, { analyses: 1, tts: 0, conversions: 0 }),
]

/* -------------------------------------------------------------------- AI */

export const aiProviders: AiProviderEntry[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    capabilities: ['llm'],
    models: { llm: ['claude-sonnet-4-5', 'claude-haiku-4-5', 'claude-opus-4-1'] },
    default_base_url: null,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    capabilities: ['llm', 'stt', 'tts'],
    models: { llm: ['gpt-4.1', 'gpt-4.1-mini'], stt: ['gpt-4o-transcribe', 'whisper-1'], tts: ['gpt-4o-mini-tts'] },
    default_base_url: null,
  },
  {
    id: 'google',
    name: 'Google Gemini',
    capabilities: ['llm', 'tts'],
    models: { llm: ['gemini-2.5-pro', 'gemini-2.5-flash'], tts: ['gemini-2.5-flash-tts'] },
    default_base_url: null,
  },
  {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    capabilities: ['stt', 'tts'],
    models: { stt: ['scribe_v1'], tts: ['eleven_multilingual_v2', 'eleven_v3'] },
    default_base_url: null,
  },
  {
    id: 'local',
    name: 'Self-hosted (OpenAI-compatible)',
    capabilities: ['llm', 'stt'],
    models: { llm: ['qwen2.5-32b-instruct'], stt: ['whisper-large-v3'] },
    default_base_url: 'http://ai.sinji.example/v1',
  },
]

const connection = (
  id: string,
  name: string,
  capability: AiConnection['capability'],
  provider: string,
  model: string,
  opts: Partial<AiConnection> & { testDays?: number; testOk?: boolean; testDetail?: string } = {},
): AiConnection => {
  const { testDays, testOk, testDetail, ...rest } = opts
  return {
    id,
    name,
    capability,
    provider,
    model,
    base_url: null,
    has_key: true,
    key_hint: '••••' + id.slice(-4).toUpperCase(),
    settings: {},
    is_active: true,
    is_default: false,
    last_test:
      testDays === undefined ? null : { ok: testOk ?? true, at: ago(testDays, 1), detail: testDetail ?? 'Responded in 812 ms' },
    updated_at: ago(30),
    updated_by: 'Levan Kipiani',
    ...rest,
  }
}

export const aiConnections: AiConnection[] = [
  connection('aic_llm_sonnet', 'Analysis LLM (default)', 'llm', 'anthropic', 'claude-sonnet-4-5', {
    is_default: true,
    settings: { temperature: 0.2, max_tokens: 4096 },
    testDays: 1,
    testDetail: 'Responded in 1 240 ms',
    updated_at: ago(45),
  }),
  connection('aic_llm_mini', 'Fast LLM', 'llm', 'openai', 'gpt-4.1-mini', {
    settings: { temperature: 0.3 },
    testDays: 6,
    testDetail: 'Responded in 690 ms',
  }),
  connection('aic_llm_local', 'Self-hosted LLM (paused)', 'llm', 'local', 'qwen2.5-32b-instruct', {
    base_url: 'http://llm.sinji.example/v1',
    has_key: false,
    key_hint: null,
    is_active: false,
    testDays: 19,
    testOk: false,
    testDetail: 'Connection refused',
    updated_at: ago(19),
  }),
  connection('aic_stt_scribe', 'Transcription (default)', 'stt', 'elevenlabs', 'scribe_v1', {
    is_default: true,
    settings: { diarize: true },
    testDays: 2,
    testDetail: 'Transcribed the 4 s probe in 1 020 ms',
  }),
  connection('aic_stt_whisper', 'Self-hosted Whisper', 'stt', 'local', 'whisper-large-v3', {
    base_url: 'http://stt.sinji.example/v1',
    has_key: false,
    key_hint: null,
    testDays: 4,
    testDetail: 'Transcribed the 4 s probe in 2 310 ms',
  }),
  connection('aic_tts_multi', 'Speech (default)', 'tts', 'elevenlabs', 'eleven_multilingual_v2', {
    is_default: true,
    testDays: 2,
    testDetail: 'Synthesised 18 characters in 540 ms',
  }),
  connection('aic_tts_gemini', 'Speech (alternative)', 'tts', 'google', 'gemini-2.5-flash-tts', {
    testDays: 12,
    testDetail: 'Synthesised 18 characters in 760 ms',
  }),
]

const assignedConnections: Record<string, Partial<Record<AiAssignment['capability'], string>>> = {
  tn_mtiebi: { llm: 'aic_llm_sonnet', stt: 'aic_stt_scribe', tts: 'aic_tts_multi' },
  tn_pari: { llm: 'aic_llm_mini' },
  tn_darbazi: { stt: 'aic_stt_whisper' },
  tn_iasamani: { tts: 'aic_tts_gemini' },
}

export const aiAssignments: AiAssignment[] = tenants.flatMap((t) =>
  (['llm', 'stt', 'tts'] as const).map((capability) => ({
    client_id: t.id,
    capability,
    connection_id: assignedConnections[t.id]?.[capability] ?? null,
  })),
)

export const aiByo: AiByoOverride[] = [
  {
    client_id: 'tn_darbazi',
    capability: 'llm',
    provider: 'openai',
    model: 'gpt-4.1',
    has_key: true,
    key_hint: '••••9KDP',
    enabled: true,
    notes: 'Own key - procurement requires spend on our account.',
    updated_at: ago(11, 3),
  },
]

export const aiLegacy: AiLegacyOverride[] = [
  {
    client_id: 'tn_nobati',
    enabled: false,
    provider: 'openai',
    model: 'gpt-4o-mini',
    base_url: null,
    has_key: true,
    notes: 'Key from the pilot. Disabled after the move to assignments; remove once usage is confirmed at zero.',
    updated_at: ago(58),
  },
]

/* ----------------------------------------------------------- integrations */

export const integrations: Integration[] = [
  {
    id: 'int_webchat',
    name: 'Web chat widget',
    kind: 'chat_platform',
    scopes: ['chat:turn', 'chat:suggest', 'chat:answer', 'chat:sync'],
    is_active: true,
    created_at: ago(118),
    grants: [
      { client_id: 'tn_mtiebi', scopes: ['chat:turn', 'chat:suggest', 'chat:answer', 'chat:sync'], is_active: true },
      { client_id: 'tn_pari', scopes: ['chat:turn', 'chat:suggest'], is_active: true },
      { client_id: 'tn_darbazi', scopes: ['chat:turn', 'chat:suggest', 'chat:answer'], is_active: true },
      { client_id: 'tn_mzetamze', scopes: ['chat:turn'], is_active: false },
    ],
    secrets: [
      {
        key_id: 'snjk_wc_01',
        label: 'Original secret (rotating out)',
        hint: keyHint('d81F'),
        created_at: ago(118),
        expires_at: ago(-5),
        revoked_at: null,
        last_used_at: ago(0, 3),
      },
      {
        key_id: 'snjk_wc_02',
        label: 'Current secret',
        hint: keyHint('Kp3a'),
        created_at: ago(2, 4),
        expires_at: null,
        revoked_at: null,
        last_used_at: ago(0, 0, 12),
      },
    ],
  },
  {
    id: 'int_helpdesk',
    name: 'Helpdesk sync',
    kind: 'chat_platform',
    scopes: ['chat:answer', 'chat:sync'],
    is_active: true,
    created_at: ago(64),
    grants: [
      { client_id: 'tn_nobati', scopes: ['chat:answer', 'chat:sync'], is_active: true },
      { client_id: 'tn_iasamani', scopes: ['chat:sync'], is_active: true },
    ],
    secrets: [
      {
        key_id: 'snjk_hd_01',
        label: 'Production',
        hint: keyHint('77nB'),
        created_at: ago(64),
        expires_at: null,
        revoked_at: null,
        last_used_at: ago(0, 6),
      },
      {
        key_id: 'snjk_hd_00',
        label: 'Staging (revoked)',
        hint: keyHint('0aZt'),
        created_at: ago(70),
        expires_at: null,
        revoked_at: ago(63),
        last_used_at: ago(64),
      },
    ],
  },
]

/* -------------------------------------------------------------------- bot */

const weekdays = { from: '09:00', to: '21:00' }

const DEFAULT_BOT_SETTINGS: BotSettings = {
  answer_policy: 'kb_only',
  business_scope: 'Questions about the company’s own products, prices, procedures and opening hours.',
  hours: {
    mon: [weekdays],
    tue: [weekdays],
    wed: [weekdays],
    thu: [weekdays],
    fri: [weekdays],
    sat: [{ from: '10:00', to: '18:00' }],
    sun: [],
  },
  timezone: 'Asia/Tbilisi',
  off_topic_handling: 'warn',
  off_topic_warn_after: 3,
  off_topic_cutoff_after: 5,
  handoff_notice: {
    ka: 'გადაგამისამართებთ ოპერატორთან, ის მალე გიპასუხებთ.',
    en: 'I’m passing you to a colleague - they’ll reply shortly.',
    ru: 'Передаю вас оператору - он скоро ответит.',
  },
  handoff_summary: true,
  disclosure_mode: 'first',
  limits: { per_minute: 6, per_conversation: 40, per_channel: { web: 2000, instagram: 500, messenger: 500, whatsapp: 800 } },
  escalation_keywords: ['საჩივარი', 'ადვოკატი', 'სასამართლო', 'complaint', 'lawyer', 'жалоба'],
  max_reply_chars: 600,
}

export const DEFAULT_BOT: BotConfig = {
  client_id: null,
  autopilot_enabled: false,
  persona: 'A courteous assistant that answers only from the company’s published knowledge base and hands over when unsure.',
  greeting: {
    ka: 'გამარჯობა! მე ვარ ავტომატური ასისტენტი. რით შემიძლია დაგეხმაროთ?',
    en: 'Hello! I’m an automated assistant. How can I help?',
    ru: 'Здравствуйте! Я автоматический помощник. Чем могу помочь?',
  },
  refusal_copy: {
    ka: 'ამ კითხვაზე ზუსტი პასუხი არ მაქვს. გადაგამისამართებთ ოპერატორთან.',
    en: 'I don’t have a reliable answer to that. Let me pass you to a colleague.',
    ru: 'У меня нет точного ответа на этот вопрос. Передаю вас оператору.',
  },
  languages: ['ka', 'en', 'ru'],
  canned: [],
  min_score: 0.45,
  min_hits: 1,
  top_k: 5,
  suggestion_count: 3,
  settings: DEFAULT_BOT_SETTINGS,
  version: 6,
  is_default: true,
  updated_at: ago(37),
  updated_by: 'Levan Kipiani',
}

const tenantBot = (client_id: string, overrides: Partial<BotConfig>, settings: Partial<BotSettings> = {}): BotConfig => ({
  ...DEFAULT_BOT,
  client_id,
  is_default: false,
  version: 1,
  ...overrides,
  settings: { ...DEFAULT_BOT_SETTINGS, ...settings },
})

export const botConfigs: BotConfig[] = [
  DEFAULT_BOT,
  tenantBot(
    'tn_mtiebi',
    {
      autopilot_enabled: true,
      persona: 'მთიები ბანკის თავაზიანი ასისტენტი. პასუხობს მხოლოდ საჯარო დოკუმენტებით, არასოდეს ასახელებს შიდა ფასდაკლებებს და არ იღებს ვალდებულებებს ბანკის სახელით.',
      greeting: {
        ka: 'გამარჯობა! მთიები ბანკის ასისტენტი ვარ. რით დაგეხმაროთ?',
        en: 'Hello! I’m Mtiebi Bank’s assistant. How can I help?',
        ru: 'Здравствуйте! Я помощник банка Мтиеби. Чем могу помочь?',
      },
      canned: [
        { trigger: 'ცხელი ხაზი', reply: 'ცხელი ხაზი *7070 მუშაობს 24/7.' },
        { trigger: 'hotline', reply: 'Our hotline *7070 is open 24/7.' },
      ],
      min_score: 0.5,
      version: 9,
      updated_at: ago(4, 2),
      updated_by: 'Tamar Gelashvili',
    },
    {
      business_scope: 'ბარათები, გადარიცხვები, სესხები, იპოთეკა, ანაბრები, აპლიკაცია, ფილიალები და საჩივრების წესი.',
      escalation_keywords: ['საჩივარი', 'თაღლითობა', 'მოპარეს', 'ადვოკატი', 'complaint', 'fraud'],
    },
  ),
  tenantBot('tn_pari', { autopilot_enabled: false, version: 3, updated_at: ago(22), updated_by: 'Mariam Abashidze' }),
  tenantBot('tn_iasamani', { autopilot_enabled: true, version: 2, updated_at: ago(30), updated_by: 'Levan Kipiani' }, { off_topic_handling: 'handoff' }),
  tenantBot('tn_darbazi', { autopilot_enabled: true, version: 4, updated_at: ago(8), updated_by: 'Irakli Tsiklauri' }, { answer_policy: 'general' }),
  tenantBot('tn_nobati', { autopilot_enabled: true, version: 2, updated_at: ago(16), updated_by: 'Sopo Chikovani' }),
  tenantBot('tn_mzetamze', { autopilot_enabled: true, version: 1, updated_at: ago(71), updated_by: 'Levan Kipiani' }),
]

export const killState: KillState = {
  global_disabled: false,
  disabled_clients: ['tn_mzetamze'],
  updated_at: ago(62),
  updated_by: 'Levan Kipiani',
}

/* --------------------------------------------------------------- limits */

export const limits: { anonymous: LimitsConfig; registered: LimitsConfig } = {
  anonymous: {
    enabled: true,
    max_analyses_per_day: 3,
    max_tts_per_day: 5,
    max_conversions_per_day: 2,
    max_audio_mb: 10,
    features: { analyze: true, tts: true, convert: true, score: false, semantic: true, summarise: false },
  },
  registered: {
    enabled: true,
    max_analyses_per_day: 20,
    max_tts_per_day: 50,
    max_conversions_per_day: 10,
    max_audio_mb: 25,
    features: { analyze: true, tts: true, convert: true, score: true, semantic: true, summarise: true },
  },
}

export const settings: PlatformSettings = {
  analysis_instructions:
    'Score the agent, never the customer. Ground every factual verdict in the workspace knowledge base and cite the chunk. ' +
    'Report text tone and voice emotion separately and never average them. Write rationales as coaching notes: specific, fair, and tied to a quote.',
  embeddings: {
    provider: 'local',
    model: 'multilingual-e5-large',
    base_url: 'http://embed.sinji.example',
    dim: 1024,
    api_key_set: false,
    api_key_hint: null,
  },
  retention_days: 180,
  voices: { mode: 'allowlist', voice_ids: ['vo_ka_1', 'vo_ka_2', 'vo_ka_3', 'vo_en_1', 'vo_en_2', 'vo_en_3', 'vo_ru_1'] },
  health: { retention_days: 30, sample_interval_s: 15 },
  public_sentiment: {
    enabled: true,
    guidance: 'Public clips are short and anonymous: report the words and the voice separately and flag any disagreement.',
  },
}
