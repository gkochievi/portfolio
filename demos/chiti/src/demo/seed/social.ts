/**
 * Vazi's team chat, page comments, audit trails and the platform health
 * history (7 days at 15-minute resolution).
 */
import { createRandom } from '@portfolio/demo-kit'

import type {
  ActivityAction,
  ActivityLog,
  ActivitySection,
  Admin,
  ChatSession,
  Message,
  Operator,
  OperatorAuditLog,
  PageComment,
  Role,
  StaffConversation,
  StaffMember,
  StaffMessage,
  StaffRole,
  Supervisor,
  SystemHealthSample,
} from '@/types'

import { ago, ANCHOR_MS, at, chatMedia, DAY, HOUR, L, localDayStartMs, MIN, pad, SEC, TBILISI_OFFSET_MS } from './util'

const TENANT = 'ten_vazi'

/* -------------------------------------------------------------- team chat */

interface Staff {
  role: StaffRole
  id: string
  name: { en: string; ka: string }
}

export function buildStaffChat(operators: Operator[], admins: Admin[], supervisors: Supervisor[]): { conversations: StaffConversation[]; messages: StaffMessage[] } {
  const staff: Staff[] = [
    ...operators.filter((row) => row.tenantId === TENANT).map((row) => ({ role: 'operator' as const, id: row.id, name: row.name })),
    ...admins.filter((row) => row.tenantId === TENANT).map((row) => ({ role: 'admin' as const, id: row.id, name: row.name })),
    ...supervisors.filter((row) => row.tenantId === TENANT).map((row) => ({ role: 'supervisor' as const, id: row.id, name: row.name })),
  ]
  const who = (id: string): Staff => staff.find((member) => member.id === id) as Staff
  const messages: StaffMessage[] = []
  let counter = 0
  const say = (conversationId: string, senderId: string, minAgo: number, content: string, file?: { url: string; name: string }) => {
    const sender = who(senderId)
    counter += 1
    messages.push({
      id: `smsg_${pad(counter)}`, tenantId: TENANT, conversationId, senderRole: sender.role, senderId: sender.id, senderName: { ...sender.name },
      type: file ? 'file' : 'text', content, fileUrl: file?.url ?? null, fileName: file?.name ?? null,
      timestamp: at(-minAgo * MIN), pending: false, failed: false, clientId: null,
    })
  }
  const d = 24 * 60
  const h = 60

  const room = 'conv_room_vazi'
  say(room, 'adm_giorgi', 2 * d + 5 * h, 'დილა მშვიდობისა! დღეს 16:00-ზე ახალი საფერავის ფოტოებს ვდებთ, კითხვები ბევრი იქნება.')
  say(room, 'op_mariam', 2 * d + 4 * h + 50, 'კარგი 👍 ინგლისურენოვან მომხმარებლებს მე ავიღებ.')
  say(room, 'op_luka', 2 * d + 4 * h + 45, 'ფასები საიტზე უკვე განახლებულია?')
  say(room, 'adm_eka', 2 * d + 4 * h + 40, 'კი, დილით განვაახლე. ფასების სია აქ არის:', { url: chatMedia('vazi-autumn-price-list.pdf'), name: 'vazi-autumn-price-list.pdf' })
  say(room, 'op_lasha', 2 * d + 3 * h, 'ბათუმის კურიერი ხვალ არ მუშაობს, ბათუმის შეკვეთები ზეგ წავა.')
  say(room, 'adm_giorgi', 2 * d + 2 * h + 55, 'მადლობა, ლაშა. მომხმარებლებს წინასწარ შევატყობინოთ.')
  say(room, 'op_salome', d + 6 * h, 'Does anyone know if the Kisi 2022 is back in stock?')
  say(room, 'op_irakli', d + 5 * h + 50, 'Warehouse says Thursday.')
  say(room, 'op_salome', d + 5 * h + 45, 'Thanks!')
  say(room, 'adm_giorgi', d + 3 * h, 'Reminder: the tasting is on the 18th, 30 seats. Send people to the events page or book them yourselves.')
  say(room, 'op_keti', d + 2 * h + 30, 'I’m on the morning shift tomorrow instead of Irakli.')
  say(room, 'op_mariam', d + 2 * h, 'A tourist asked for a 6-bottle travel box. Do we have the big ones?')
  say(room, 'adm_eka', d + h + 55, 'Only 3-bottle boxes, use two.')
  say(room, 'op_luka', 5 * h, 'დღეს საბურთალოს კურიერი აგვიანებს, წერეთელზე საცობია.')
  say(room, 'adm_giorgi', 4 * h + 50, 'ვიცი, დავუკავშირდი. დაგვიანებულ შეკვეთებზე 10%-იანი ვაუჩერი შესთავაზეთ.')
  say(room, 'op_mariam', 3 * h, 'TikTok-ის კავშირი ისევ ხელახლა შესვლას ითხოვს.')
  say(room, 'adm_giorgi', 2 * h + 50, 'ვნახე, საღამოს განვაახლებ.')
  say(room, 'op_lasha', h + 30, 'I’ll be away for 20 minutes, lunch.')
  say(room, 'adm_giorgi', 40, 'Natia Bolkvadze is on Messenger again about broken bottles. I’m taking over that chat.')
  say(room, 'op_mariam', 38, 'Thank you 🙏')
  say(room, 'op_salome', 14, 'Back online in 10.')
  say(room, 'adm_eka', 6, 'Nice work today everyone, the queue is short 👏')

  const dm = (a: string, b: string) => `conv_dm_${[a, b].sort().join('_')}`
  const lm = dm('op_luka', 'op_mariam')
  say(lm, 'op_mariam', 3 * h + 20, 'ლუკა, ჰანას WhatsApp-ზე ფანჯარა დაეხურა? შაბლონით მოგიწევს მიწერა.')
  say(lm, 'op_luka', 3 * h + 15, 'კი, order_update-ით მივწერ.')
  say(lm, 'op_mariam', 3 * h + 10, '👍')
  say(lm, 'op_luka', 60, 'Elene’s order is late again, the same customer as last month.')
  say(lm, 'op_mariam', 58, 'Offer her the voucher, Giorgi said it’s fine.')
  say(lm, 'op_luka', 57, 'Will do.')
  const lg = dm('op_luka', 'adm_giorgi')
  say(lg, 'op_luka', d + 4 * h, 'Giorgi, can I take Friday afternoon off?')
  say(lg, 'adm_giorgi', d + 3 * h, 'Yes, Keti will cover.')
  say(lg, 'op_luka', d + 2 * h + 58, 'Thanks!')
  say(lg, 'adm_giorgi', 25, 'Luka, when Elene’s chat is done please leave a short note about the courier.')
  say(lg, 'adm_giorgi', 24, 'And check the TikTok chat, a photo failed to send.')
  const mg = dm('op_mariam', 'adm_giorgi')
  say(mg, 'op_mariam', 40, 'Natia wants a refund, not a replacement. Can you step in?')
  say(mg, 'adm_giorgi', 39, 'Yes, joining now.')
  say(mg, 'adm_giorgi', 19, 'Done, refund promised within 3 working days.')
  say(mg, 'op_mariam', 18, 'მადლობა!')
  const ll = dm('op_lasha', 'op_luka')
  say(ll, 'op_lasha', 2 * d, 'ბათუმის შეკვეთები ზეგ მიდის, არ დაგავიწყდეს.')
  say(ll, 'op_luka', 2 * d - 5, 'კარგი')
  say(ll, 'op_lasha', h + 25, 'Sofia’s chat is mine but I’m at lunch. Ping me if she writes.')
  say(ll, 'op_luka', h + 24, '👌')
  const eg = dm('adm_eka', 'adm_giorgi')
  say(eg, 'adm_eka', d + 7 * h, 'I added a ban rule for +995 555 00 77 13, three refused deliveries.')
  say(eg, 'adm_giorgi', d + 6 * h + 50, 'Good call.')
  say(eg, 'adm_eka', 3 * h, 'The monthly report is ready, I’ll send the CSV later.')
  say(eg, 'adm_giorgi', 2 * h + 45, '🙏')

  const lastIn = (conversationId: string) => messages.filter((message) => message.conversationId === conversationId).at(-1)
  /** Members read up to their own last message; Luka is behind in the room and in his DM with Giorgi. */
  const readAt = (conversationId: string, memberId: string): string | null => {
    if (memberId === 'op_luka' && conversationId === room) return ago(45 * MIN)
    if (memberId === 'op_luka' && conversationId === lg) return ago((d + 2 * h + 58) * MIN)
    if (memberId === 'op_irakli' || memberId === 'op_keti') return ago(19 * HOUR)
    return lastIn(conversationId)?.timestamp ?? null
  }
  const member = (conversationId: string, id: string): StaffMember => {
    const person = who(id)
    return { role: person.role, memberId: person.id, name: { ...person.name }, lastReadAt: readAt(conversationId, id) }
  }
  const convo = (id: string, kind: 'room' | 'direct', memberIds: string[]): StaffConversation => {
    const last = lastIn(id)
    const members = memberIds.map((memberId) => member(id, memberId))
    return {
      id, tenantId: TENANT, kind,
      title: kind === 'room' ? L('Vazi team', 'ვაზის გუნდი', 'Команда Вази') : null,
      dmKey: kind === 'direct' ? members.map((entry) => `${entry.role}:${entry.memberId}`).sort().join('|') : null,
      members,
      lastMessageText: last ? (last.content || last.fileName) : null,
      lastMessageAt: last?.timestamp ?? null,
    }
  }
  const conversations = [
    convo(room, 'room', staff.filter((member) => member.role !== 'supervisor').map((member) => member.id)),
    convo(lm, 'direct', ['op_luka', 'op_mariam']),
    convo(lg, 'direct', ['op_luka', 'adm_giorgi']),
    convo(mg, 'direct', ['op_mariam', 'adm_giorgi']),
    convo(ll, 'direct', ['op_lasha', 'op_luka']),
    convo(eg, 'direct', ['adm_eka', 'adm_giorgi']),
  ]
  messages.sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp))
  return { conversations, messages }
}

/* ---------------------------------------------------------------- comments */

export function buildComments(): PageComment[] {
  const posts = {
    post_saperavi: 'ახალი მოსავლის საფერავი უკვე მარანშია 🍷 New Saperavi vintage is in the cellar.',
    post_tasting: 'Autumn tasting · შემოდგომის დეგუსტაცია, 18 ოქტომბერი, 18:00',
    post_qvevri: 'Qvevri workshop: see how amber wine is made · ქვევრის ვორქშოპი',
  } as const
  type Post = keyof typeof posts
  const rows: [PageComment['channel'], Post, string, string, number, Partial<PageComment>?][] = [
    ['facebook_messenger', 'post_saperavi', 'Lela Mgaloblishvili', 'რა ღირს 2023-ის საფერავი?', 6 * DAY + 3 * HOUR, { repliedAt: ago(6 * DAY + 2 * HOUR), replyText: '28 ₾. თბილისში მიტანა 120 ₾-დან უფასოა 🙂', repliedByName: 'Eka Chkheidze' }],
    ['facebook_messenger', 'post_saperavi', 'Paata Gelovani', 'ბოლო შეკვეთას სამი დღე ველოდე, იმედია ახლა უფრო სწრაფად მოიტანთ.', 5 * DAY + 7 * HOUR],
    ['facebook_messenger', 'post_saperavi', 'Sarah Klein', 'Do you ship to Germany?', 5 * DAY + 2 * HOUR, { repliedAt: ago(5 * DAY + HOUR), replyText: 'Not yet, sorry! We deliver across Georgia only.', repliedByName: 'Giorgi Abashidze' }],
    ['facebook_messenger', 'post_saperavi', 'Daily Gains 24/7', 'Earn 500 a day from home!!! Click my profile 💰💰', 4 * DAY + 9 * HOUR, { isHidden: true }],
    ['instagram', 'post_tasting', 'Tornike Esakia', 'ბილეთები ჯერ კიდევ არის?', 2 * DAY + 5 * HOUR],
    ['instagram', 'post_tasting', 'Mariam Goletiani', 'Can I bring a friend who doesn’t drink?', 2 * DAY + 3 * HOUR],
    ['instagram', 'post_tasting', 'David Ross', 'Is it in English too?', 2 * DAY + HOUR, { repliedAt: ago(2 * DAY), replyText: 'Yes, the host speaks English and Georgian!', repliedByName: 'Eka Chkheidze' }],
    ['instagram', 'post_tasting', 'follow.4.follow.now', 'Follow4follow 🔥🔥🔥', DAY + 11 * HOUR, { isHidden: true }],
    ['facebook_messenger', 'post_qvevri', 'Eter Kobaladze', 'ბავშვებთან ერთად შეიძლება მოსვლა?', 20 * HOUR],
    ['facebook_messenger', 'post_qvevri', 'Nugzar Sikharulidze', 'შესანიშნავი ღონისძიება იყო შარშან!', 16 * HOUR],
    ['instagram', 'post_qvevri', 'Anna Becker', 'How long is the workshop?', 7 * HOUR],
    ['instagram', 'post_qvevri', 'Giga Mumladze', 'About two hours, I went last year 👌', 5 * HOUR, { parentExternalId: 'ext_cmt_11' }],
  ]
  return rows.map(([channel, post, authorName, text, agoMs, extra], index) => ({
    id: `cmt_${index + 1}`,
    tenantId: TENANT,
    channel,
    externalPostId: `${channel === 'instagram' ? 'ig' : 'fb'}_${post}`,
    postCaption: posts[post],
    parentExternalId: null,
    authorName,
    authorAvatarId: index % 3 === 0 ? `nest-${pad((index % 16) + 1, 2)}` : null,
    text,
    permalink: `https://social.example/vazi/${post}/c${index + 1}`,
    isHidden: false,
    isDeleted: false,
    repliedAt: null,
    replyText: null,
    repliedByName: null,
    externalCreatedAt: ago(agoMs),
    ...extra,
  }))
}

/* ---------------------------------------------------------------- activity */

const SECTION: Record<ActivityAction, ActivitySection> = {
  operator_login: 'auth', operator_logout: 'auth', admin_login: 'auth', admin_logout: 'auth', supervisor_login: 'auth',
  operator_pause: 'users', operator_resume: 'users', admin_force_operator_status: 'users', admin_force_operator_logout: 'users',
  admin_create_operator: 'users', admin_update_operator: 'users', admin_delete_operator: 'users', admin_create_admin: 'users',
  admin_update_admin: 'users', admin_delete_admin: 'users', admin_create_supervisor: 'users', admin_update_supervisor: 'users',
  admin_delete_supervisor: 'users', admin_end_operator_chats: 'users',
  operator_claim_session: 'chats', operator_end_session: 'chats', operator_return_to_queue: 'chats', operator_send_template: 'chats',
  admin_intervention_start: 'chats', admin_intervention_stop: 'chats', admin_send_message: 'chats', admin_end_session: 'chats',
  admin_clear_queue: 'chats', admin_ban_client: 'chats', admin_unban_client: 'chats', admin_purge_sessions: 'chats',
  admin_update_settings: 'chats', admin_update_working_hours: 'chats', admin_update_faq: 'chats',
  customer_login: 'chats', customer_disconnect: 'chats',
  admin_download_report: 'reports',
  admin_save_integration: 'integrations', admin_test_integration: 'integrations', admin_delete_integration: 'integrations', admin_moderate_comment: 'integrations',
}

export function sectionOf(action: ActivityAction): ActivitySection {
  return SECTION[action]
}

export function buildActivity(operators: Operator[], history: ChatSession[], templateMessages: Message[] = []): ActivityLog[] {
  const rnd = createRandom('vazi-activity')
  const rows: ActivityLog[] = []
  const vaziOps = operators.filter((operator) => operator.tenantId === TENANT)
  const ip = (n: number) => `192.0.2.${10 + (n % 200)}`
  const push = (action: ActivityAction, actorRole: Role | 'system', actorId: string | null, actorName: string, ms: number, target: { id?: string; label?: string; meta?: ActivityLog['metadata'] } = {}) => {
    rows.push({
      id: `act_${pad(rows.length + 1, 4)}`, tenantId: TENANT, action, section: SECTION[action], actorRole, actorId, actorName,
      targetId: target.id ?? null, targetLabel: target.label ?? null, metadata: target.meta ?? {}, ipAddress: actorRole === 'system' ? null : ip(rows.length * 7),
      createdAt: new Date(ms).toISOString(),
    })
  }

  for (let daysAgo = 29; daysAgo >= 0; daysAgo -= 1) {
    const dayStart = localDayStartMs(daysAgo)
    const weekday = new Date(dayStart + TBILISI_OFFSET_MS + 12 * HOUR).getUTCDay()
    if (weekday === 0) continue
    const shift = rnd.shuffle(vaziOps).slice(0, daysAgo === 0 ? 4 : rnd.int(2, 3))
    if (daysAgo === 0) {
      for (const id of ['op_luka', 'op_mariam', 'op_lasha', 'op_salome']) {
        const operator = vaziOps.find((candidate) => candidate.id === id)
        if (operator && !shift.includes(operator)) shift.push(operator)
      }
    }
    push('admin_login', 'admin', 'adm_giorgi', 'Giorgi Abashidze', dayStart + 9 * HOUR + rnd.int(2, 25) * MIN)
    if (daysAgo % 4 === 1) push('supervisor_login', 'supervisor', 'sup_nino', 'Nino Lomidze', dayStart + 10 * HOUR + rnd.int(0, 50) * MIN)
    for (const operator of shift) {
      const login = dayStart + 9 * HOUR + rnd.int(0, 70) * MIN
      if (login > ANCHOR_MS) continue
      push('operator_login', 'operator', operator.id, operator.name.en, login)
      if (daysAgo > 0) push('operator_logout', 'operator', operator.id, operator.name.en, dayStart + rnd.int(18, 21) * HOUR + rnd.int(0, 59) * MIN)
    }
    if (daysAgo > 0 && daysAgo % 2 === 1) {
      const operator = rnd.pick(shift)
      const pausedAt = dayStart + 13 * HOUR + rnd.int(0, 40) * MIN
      push('operator_pause', 'operator', operator.id, operator.name.en, pausedAt, { id: operator.id, label: operator.name.en, meta: { source: 'self' } })
      push('operator_resume', 'operator', operator.id, operator.name.en, pausedAt + rnd.int(18, 45) * MIN, { id: operator.id, label: operator.name.en, meta: { source: 'self' } })
    }
    const today = history.filter((session) => {
      const ms = Date.parse(session.startedAt)
      return session.operatorId && ms >= dayStart && ms < dayStart + DAY
    })
    for (const session of today.slice(0, 2)) {
      const operator = vaziOps.find((candidate) => candidate.id === session.operatorId)
      if (!operator) continue
      push('operator_claim_session', 'operator', operator.id, operator.name.en, Date.parse(session.startedAt) + 70 * SEC, { id: session.id, label: session.customerName })
      if (session.endedBy === 'operator' && session.endedAt) push('operator_end_session', 'operator', operator.id, operator.name.en, Date.parse(session.endedAt), { id: session.id, label: session.customerName })
    }
  }

  const giorgi = (action: ActivityAction, daysAgo: number, hour: number, target: { id?: string; label?: string; meta?: ActivityLog['metadata'] } = {}) =>
    push(action, 'admin', 'adm_giorgi', 'Giorgi Abashidze', localDayStartMs(daysAgo) + hour * HOUR + 17 * MIN, target)
  const eka = (action: ActivityAction, daysAgo: number, hour: number, target: { id?: string; label?: string; meta?: ActivityLog['metadata'] } = {}) =>
    push(action, 'admin', 'adm_eka', 'Eka Chkheidze', localDayStartMs(daysAgo) + hour * HOUR + 41 * MIN, target)

  for (const message of templateMessages) {
    const session = history.find((candidate) => candidate.id === message.sessionId)
    if (!session) continue
    push('operator_send_template', 'operator', message.senderId, message.senderName ?? 'Operator', Date.parse(message.timestamp), {
      id: session.id, label: session.customerName, meta: { template: message.template?.name ?? null },
    })
  }

  giorgi('admin_ban_client', 21, 11, { id: 'ban_1', label: '+995 555 00 66 66', meta: { type: 'customField', reason: 'Abusive messages to staff' } })
  giorgi('admin_purge_sessions', 19, 18, { meta: { sessions: 214, messages: 3961, files: 37, from: '2026-01-01', to: '2026-03-31' } })
  giorgi('admin_update_operator', 16, 10, { id: 'op_salome', label: 'Salome Gogua', meta: { field: 'nickname' } })
  giorgi('admin_save_integration', 14, 12, { id: 'whatsapp', label: 'WhatsApp', meta: { status: 'connected' } })
  giorgi('admin_test_integration', 14, 12, { id: 'whatsapp', label: 'WhatsApp', meta: { ok: true } })
  const exact = (action: ActivityAction, actor: 'giorgi' | 'eka' | 'nino', agoMs: number, target: { id?: string; label?: string; meta?: ActivityLog['metadata'] } = {}) => {
    const who = actor === 'giorgi' ? ['admin', 'adm_giorgi', 'Giorgi Abashidze'] as const : actor === 'eka' ? ['admin', 'adm_eka', 'Eka Chkheidze'] as const : ['supervisor', 'sup_nino', 'Nino Lomidze'] as const
    push(action, who[0], who[1], who[2], ANCHOR_MS - agoMs, target)
  }
  exact('admin_moderate_comment', 'eka', 6 * DAY + 2 * HOUR, { id: 'cmt_1', label: 'Lela Mgaloblishvili', meta: { action: 'reply', channel: 'facebook_messenger' } })
  exact('admin_moderate_comment', 'giorgi', 5 * DAY + HOUR, { id: 'cmt_3', label: 'Sarah Klein', meta: { action: 'reply', channel: 'facebook_messenger' } })
  exact('admin_moderate_comment', 'eka', 4 * DAY + 8 * HOUR, { id: 'cmt_4', label: 'Daily Gains 24/7', meta: { action: 'hide', channel: 'facebook_messenger' } })
  exact('admin_moderate_comment', 'eka', 2 * DAY, { id: 'cmt_7', label: 'David Ross', meta: { action: 'reply', channel: 'instagram' } })
  exact('admin_moderate_comment', 'giorgi', DAY + 10 * HOUR, { id: 'cmt_8', label: 'follow.4.follow.now', meta: { action: 'hide', channel: 'instagram' } })
  exact('admin_save_integration', 'giorgi', 27 * DAY + 5 * HOUR, { id: 'telegram', label: 'Telegram', meta: { status: 'awaiting_business_connection' } })
  exact('admin_test_integration', 'giorgi', 27 * DAY + 4 * HOUR, { id: 'telegram', label: 'Telegram', meta: { ok: true } })
  exact('admin_save_integration', 'eka', 18 * DAY + 3 * HOUR, { id: 'instagram', label: 'Instagram', meta: { status: 'connected' } })
  exact('admin_test_integration', 'eka', 18 * DAY + 2 * HOUR, { id: 'instagram', label: 'Instagram', meta: { ok: true } })
  exact('admin_save_integration', 'giorgi', 7 * DAY + 6 * HOUR, { id: 'tiktok', label: 'TikTok', meta: { status: 'needs_reauth' } })
  exact('admin_delete_integration', 'giorgi', 7 * DAY + 5 * HOUR, { id: 'tiktok', label: 'TikTok', meta: { reason: 'reconnect' } })
  exact('admin_download_report', 'nino', 9 * DAY + 6 * HOUR, { meta: { from: '2026-09-21', to: '2026-09-27', rows: 41 } })
  exact('admin_download_report', 'giorgi', 14 * DAY + 3 * HOUR, { meta: { from: '2026-08-01', to: '2026-08-31', rows: 152 } })
  exact('admin_download_report', 'nino', 2 * DAY + 4 * HOUR, { meta: { from: '2026-09-28', to: '2026-10-03', rows: 38 } })
  exact('admin_download_report', 'eka', 26 * DAY + 2 * HOUR, { meta: { from: '2026-08-24', to: '2026-08-30', rows: 36 } })
  exact('admin_update_admin', 'giorgi', 22 * DAY + 4 * HOUR, { id: 'adm_eka', label: 'Eka Chkheidze', meta: { field: 'language' } })
  exact('admin_update_supervisor', 'giorgi', 18 * DAY + 7 * HOUR, { id: 'sup_nino', label: 'Nino Lomidze', meta: { field: 'nickname' } })
  exact('admin_force_operator_logout', 'giorgi', 11 * DAY + 3 * HOUR, { id: 'op_irakli', label: 'Irakli Janelidze' })
  exact('admin_force_operator_status', 'nino', 3 * DAY + 2 * HOUR, { id: 'op_salome', label: 'Salome Gogua', meta: { status: 'away' } })
  exact('admin_update_operator', 'eka', 13 * DAY + 5 * HOUR, { id: 'op_mariam', label: 'Mariam Kvaratskhelia', meta: { field: 'language' } })
  giorgi('admin_update_faq', 10, 9, { meta: { nodes: 9 } })
  giorgi('admin_ban_client', 9, 13, { id: 'ban_2', label: '203.0.113.66', meta: { type: 'ip', reason: 'Dozens of fake orders from one address' } })
  giorgi('admin_force_operator_status', 8, 17, { id: 'op_irakli', label: 'Irakli Janelidze', meta: { status: 'away' } })
  giorgi('admin_clear_queue', 7, 21, { meta: { ended: 3 } })
  giorgi('admin_update_working_hours', 6, 9, { meta: { sunday: 'off' } })
  eka('admin_download_report', 5, 16, { meta: { from: '2026-09-01', to: '2026-09-30', rows: 168 } })
  giorgi('admin_intervention_start', 4, 14, { label: 'Paata Gelovani' })
  giorgi('admin_intervention_stop', 4, 14, { label: 'Paata Gelovani' })
  eka('admin_ban_client', 3, 12, { id: 'ban_3', label: '+995 555 00 77 13', meta: { type: 'customField', reason: 'Repeated orders refused at the door' } })
  giorgi('admin_update_settings', 2, 11, { meta: { fields: 'operatorChatLimit, typingTransparency' } })
  push('admin_intervention_start', 'admin', 'adm_giorgi', 'Giorgi Abashidze', ANCHOR_MS - 21 * MIN, { id: 'ses_live_fb_intervention', label: 'ნათია ბოლქვაძე' })
  push('admin_send_message', 'admin', 'adm_giorgi', 'Giorgi Abashidze', ANCHOR_MS - 20 * MIN, { id: 'ses_live_fb_intervention', label: 'ნათია ბოლქვაძე' })
  push('operator_claim_session', 'operator', 'op_luka', 'Luka Beridze', ANCHOR_MS - 9 * MIN, { id: 'ses_live_web_handoff', label: 'ელენე ყიფიანი' })
  push('customer_login', 'customer', 'cus_live_irma', 'ირმა ხარაბაძე', ANCHOR_MS - 30 * SEC, { id: 'ses_q_web_fresh', label: 'ირმა ხარაბაძე' })

  return rows.sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
}

export function buildOperatorAudit(operators: Operator[]): OperatorAuditLog[] {
  const rows: OperatorAuditLog[] = []
  const add = (operatorId: string, operatorEmail: string, action: OperatorAuditLog['action'], performedBy: string, createdAt: string, changes: OperatorAuditLog['changes'] = {}) =>
    rows.push({ id: `oaud_${pad(rows.length + 1)}`, tenantId: TENANT, operatorId, operatorEmail, action, performedBy, changes, createdAt })
  for (const operator of operators.filter((row) => row.tenantId === TENANT)) {
    add(operator.id, operator.email, 'created', operator.id === 'op_keti' ? 'Eka Chkheidze' : 'Giorgi Abashidze', operator.createdAt, {
      nickname: { from: null, to: operator.nickname },
      operatorNumber: { from: null, to: operator.operatorNumber },
    })
  }
  add('op_salome', 'salome@chiti.example', 'updated', 'Giorgi Abashidze', ago(16 * DAY), { nickname: { from: 'Salome', to: 'Salo' } })
  add('op_keti', 'keti@chiti.example', 'updated', 'Eka Chkheidze', ago(40 * DAY), { isExternal: { from: false, to: true } })
  add('op_mariam', 'mariam@chiti.example', 'updated', 'Giorgi Abashidze', ago(73 * DAY), { language: { from: 'ka', to: 'en' } })
  add('op_lasha', 'lasha@chiti.example', 'updated', 'Lasha Kapanadze', ago(55 * DAY), { avatarId: { from: null, to: 'nest-12' } })
  add('op_irakli', 'irakli@chiti.example', 'updated', 'Giorgi Abashidze', ago(150 * DAY), { operatorNumber: { from: '1290', to: '1209' } })
  add('op_luka', 'luka@chiti.example', 'updated', 'Giorgi Abashidze', ago(120 * DAY), { email: { from: 'l.beridze@chiti.example', to: 'luka@chiti.example' } })
  add('op_zaza', 'zaza@chiti.example', 'created', 'Giorgi Abashidze', ago(200 * DAY), { nickname: { from: null, to: 'Zaza' } })
  add('op_zaza', 'zaza@chiti.example', 'deleted', 'Giorgi Abashidze', ago(33 * DAY))
  add('op_tinatin', 'tinatin@chiti.example', 'created', 'Eka Chkheidze', ago(95 * DAY), { nickname: { from: null, to: 'Tika' } })
  add('op_tinatin', 'tinatin@chiti.example', 'deleted', 'Eka Chkheidze', ago(61 * DAY))
  return rows.sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
}

/* ------------------------------------------------------------------ health */

export function buildHealthSamples(): SystemHealthSample[] {
  const rnd = createRandom('chiti-health')
  const samples: SystemHealthSample[] = []
  const step = 15 * MIN
  const count = (7 * DAY) / step
  const bootMs = ANCHOR_MS - 19 * DAY - 4 * HOUR
  let cpu = 24
  let mem = 52
  let lag = 4
  let ping = 38
  const walk = (value: number, min: number, max: number, spread: number) => Math.min(max, Math.max(min, value + (rnd.next() - 0.5) * spread))
  for (let index = count; index >= 0; index -= 1) {
    const ms = ANCHOR_MS - index * step
    const hour = new Date(ms + TBILISI_OFFSET_MS).getUTCHours()
    const busy = hour >= 11 && hour <= 21 ? 12 : 0
    cpu = walk(cpu, 10, 60, 8)
    mem = walk(mem, 40, 70, 3)
    lag = walk(lag, 1, 15, 2)
    ping = walk(ping, 20, 80, 10)
    const memTotalMb = 4096
    const diskTotalGb = 80
    const diskUsedGb = Math.round((31.2 + (count - index) * 0.004) * 10) / 10
    samples.push({
      at: new Date(ms).toISOString(),
      cpuPercent: Math.round(Math.min(60, cpu + busy * 0.6) * 10) / 10,
      loadAvg1: Math.round(((cpu + busy) / 100) * 2 * 100) / 100,
      memUsedMb: Math.round((memTotalMb * mem) / 100),
      memTotalMb,
      memPercent: Math.round(mem * 10) / 10,
      diskUsedGb,
      diskTotalGb,
      diskPercent: Math.round((diskUsedGb / diskTotalGb) * 1000) / 10,
      netRxKbps: Math.round(180 + busy * 30 + rnd.next() * 220),
      netTxKbps: Math.round(140 + busy * 25 + rnd.next() * 180),
      eventLoopLagMs: Math.round(lag * 10) / 10,
      pingMs: Math.round(ping),
      uptimeSeconds: Math.round((ms - bootMs) / 1000),
    })
  }
  return samples
}
