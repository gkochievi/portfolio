/**
 * admin-integrations simulators (leader tab only): the Telegram handshake and
 * the TikTok popup flow finish on their own, and every ~90 s a new public
 * comment lands on one of Vazi's posts (at most 3 per session).
 */
import { every } from '@portfolio/demo-kit'

import type { PageComment } from '@/types'

import { broadcast } from '../bus'
import { nowIso } from '../clock'
import { resolveTelegram, resolveTikTok } from '../handlers/admin-integrations'
import { newId, store } from '../store'

const TENANT = 'ten_vazi'
const MAX_NEW_COMMENTS = 3

const INCOMING: { author: string; text: string }[] = [
  { author: 'Natia Chikovani', text: 'გამარჯობა, ქვევრის ღვინო თუ გაქვთ ახალი მოსავლიდან?' },
  { author: 'Tom Hartley', text: 'Lovely label! Do you do gift wrapping for a single bottle?' },
  { author: 'Dato Khutsishvili', text: 'ბათუმში მიტანა რამდენ დღეში შეიძლება?' },
  { author: 'Ines Duarte', text: 'Is the Saperavi dry or semi-sweet?' },
  { author: 'Sofo Tsiklauri', text: 'ძალიან მომეწონა დეგუსტაცია, მადლობა! 🍇' },
]

export function start(): () => void {
  let created = 0

  const stopHandshakes = every(1_000, () => {
    for (const row of store.data.integrations) {
      resolveTelegram(row.tenantId)
      resolveTikTok(row.tenantId)
    }
  })

  const stopComments = every(90_000, () => {
    if (created >= MAX_NEW_COMMENTS) return
    const tenant = store.data.tenants.find((row) => row.id === TENANT)
    if (!tenant) return
    const posts = store.data.comments.filter((row) => row.tenantId === TENANT && !row.isDeleted && tenant.features[row.channel])
    const post = posts[created % Math.max(posts.length, 1)]
    const incoming = INCOMING[created % INCOMING.length]
    if (!post || !incoming) return
    const id = newId('cmt_')
    const comment: PageComment = {
      id,
      tenantId: TENANT,
      channel: post.channel,
      externalPostId: post.externalPostId,
      postCaption: post.postCaption,
      parentExternalId: null,
      authorName: incoming.author,
      authorAvatarId: null,
      text: incoming.text,
      permalink: `https://social.example/vazi/live/${id}`,
      isHidden: false,
      isDeleted: false,
      repliedAt: null,
      replyText: null,
      repliedByName: null,
      externalCreatedAt: nowIso(),
    }
    created += 1
    store.data.comments.unshift(comment)
    broadcast('comment:upsert', comment)
  })

  return () => {
    stopHandshakes()
    stopComments()
  }
}
