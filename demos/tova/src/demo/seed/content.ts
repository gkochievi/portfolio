/**
 * Owner: data agent. Events Ritmuli Events ran (or will run) with the stand,
 * their falling items, trivia and prizes. Organiser-entered content is stored
 * the way the organiser typed it (English), as the source stores it.
 */
import type { Difficulty, GameEvent, Item, ItemType, Prize, SpeedLevel, TriviaQuestion } from '@/types'
import { fromAnchor, onDay } from './time'

export const LIVE_EVENT_ID = 'evt_narinji'

/* ----------------------------------------------------------------- events */

interface EventSpec {
  id: string
  name: string
  startsAt: string
  endsAt: string
  durationSeconds?: number
  maxGood: number
  maxBad: number
  difficulty?: Difficulty
  speedLevel?: SpeedLevel
  leaderboardSize?: number
  published: boolean
  awardsVisible?: boolean
  leaderboardVisible?: boolean
  notifiedAt?: string | null
  createdAt: string
  updatedAt: string
}

function event(spec: EventSpec): GameEvent {
  return {
    durationSeconds: 60,
    difficulty: 'normal',
    speedLevel: 1,
    leaderboardSize: 10,
    awardsVisible: false,
    leaderboardVisible: false,
    notifiedAt: null,
    ...spec,
  }
}

export const EVENTS: GameEvent[] = [
  // The live fair: opened yesterday at noon (Tbilisi), closes tomorrow evening.
  event({
    id: LIVE_EVENT_ID,
    name: 'Narinji Expo 2026',
    startsAt: fromAnchor(-26),
    endsAt: fromAnchor(30),
    maxGood: 1600,
    maxBad: 600,
    published: true,
    awardsVisible: true,
    leaderboardVisible: true,
    createdAt: onDay(-14, 9, 20),
    updatedAt: fromAnchor(-3),
  }),
  event({
    id: 'evt_pilpili',
    name: 'Pilpili Food Week 2026',
    startsAt: onDay(-12, 7),
    endsAt: onDay(-9, 16),
    maxGood: 1500,
    maxBad: 600,
    speedLevel: 2,
    published: true,
    awardsVisible: true,
    leaderboardVisible: true,
    notifiedAt: onDay(-8, 8, 45),
    createdAt: onDay(-27, 12, 10),
    updatedAt: onDay(-8, 8, 45),
  }),
  event({
    id: 'evt_velo',
    name: 'Lurji Velo City Ride Expo',
    startsAt: onDay(-5, 7),
    endsAt: onDay(-4, 16),
    durationSeconds: 45,
    maxGood: 1200,
    maxBad: 400,
    difficulty: 'easy',
    published: true,
    awardsVisible: true,
    leaderboardVisible: true,
    createdAt: onDay(-16, 10, 0),
    updatedAt: onDay(-4, 16, 20),
  }),
  event({
    id: 'evt_batumi',
    name: 'Batumi Boulevard Weekend',
    startsAt: onDay(-19, 7),
    endsAt: onDay(-17, 16),
    maxGood: 1400,
    maxBad: 500,
    difficulty: 'hard',
    speedLevel: 2,
    leaderboardSize: 15,
    published: true,
    awardsVisible: true,
    createdAt: onDay(-33, 13, 30),
    updatedAt: onDay(-17, 17, 5),
  }),
  event({
    id: 'evt_kutaisi',
    name: 'Kutaisi Tech Fair',
    startsAt: onDay(-26, 7),
    endsAt: onDay(-25, 16),
    maxGood: 1300,
    maxBad: 500,
    speedLevel: 3,
    published: true,
    createdAt: onDay(-38, 9, 0),
    updatedAt: onDay(-25, 16, 40),
  }),
  event({
    id: 'evt_rtveli',
    name: 'Rtveli Harvest Fair',
    startsAt: onDay(9, 7),
    endsAt: onDay(11, 16),
    maxGood: 1600,
    maxBad: 600,
    published: true,
    createdAt: onDay(-6, 11, 15),
    updatedAt: onDay(-2, 15, 0),
  }),
  event({
    id: 'evt_newyear',
    name: 'New Year Bazaar 2027',
    startsAt: onDay(80, 7),
    endsAt: onDay(82, 16),
    maxGood: 2000,
    maxBad: 800,
    difficulty: 'easy',
    speedLevel: 2,
    leaderboardSize: 20,
    published: true,
    createdAt: onDay(-3, 10, 30),
    updatedAt: onDay(-3, 10, 30),
  }),
  event({
    id: 'evt_popup',
    name: 'Kvamli Coffee roastery pop-up',
    startsAt: onDay(20, 7),
    endsAt: onDay(20, 16),
    maxGood: 1600,
    maxBad: 600,
    leaderboardSize: 5,
    published: false,
    createdAt: onDay(-1, 16, 40),
    updatedAt: fromAnchor(-5),
  }),
  event({
    id: 'evt_draft',
    name: 'Untitled event',
    startsAt: onDay(40, 7),
    endsAt: onDay(40, 16),
    maxGood: 1600,
    maxBad: 600,
    published: false,
    createdAt: fromAnchor(-1.5),
    updatedAt: fromAnchor(-1.5),
  }),
]

export const eventById = (id: string): GameEvent => {
  const found = EVENTS.find((candidate) => candidate.id === id)
  if (!found) throw new Error(`seed: unknown event ${id}`)
  return found
}

/* ------------------------------------------------------------------ items */

interface Kind {
  name: string
  type: ItemType
  points: number
  weight: number
  brandName: string | null
  imageUrl: string | null
}

const sponsor = (name: string, slug: string): Kind => ({
  name,
  type: 'GOOD',
  points: 50,
  weight: 5,
  brandName: name,
  imageUrl: `media/items/${slug}.svg`,
})
const minor = (name: string): Kind => ({ name, type: 'MINOR', points: -10, weight: 3, brandName: null, imageUrl: null })
const major = (name: string): Kind => ({ name, type: 'MAJOR', points: -500, weight: 1, brandName: null, imageUrl: null })

const KIND = {
  kvamli: sponsor('Kvamli Coffee', 'kvamli-coffee'),
  mzevali: sponsor('Mzevali Tea', 'mzevali-tea'),
  arsiani: sponsor('Arsiani Bakery', 'arsiani-bakery'),
  tetri: sponsor('Tetri Kalami', 'tetri-kalami'),
  lurji: sponsor('Lurji Velo', 'lurji-velo'),
  icicle: minor('Icicle'),
  pinecone: minor('Pinecone'),
  slush: minor('Slush'),
  snowball: minor('Snowball'),
  storm: major('Storm cloud'),
} as const

type KindKey = keyof typeof KIND

/** Which items each event drops, in admin sort order. */
const LINEUP: { eventId: string | null; keys: KindKey[]; inactive?: KindKey[] }[] = [
  { eventId: LIVE_EVENT_ID, keys: ['kvamli', 'mzevali', 'arsiani', 'tetri', 'lurji', 'icicle', 'pinecone', 'storm', 'slush'], inactive: ['slush'] },
  { eventId: 'evt_pilpili', keys: ['arsiani', 'kvamli', 'mzevali', 'tetri', 'pinecone', 'storm'] },
  { eventId: 'evt_velo', keys: ['lurji', 'kvamli', 'tetri', 'icicle', 'storm'] },
  { eventId: 'evt_batumi', keys: ['mzevali', 'lurji', 'kvamli', 'pinecone'] },
  { eventId: 'evt_kutaisi', keys: ['tetri', 'arsiani', 'icicle', 'storm'] },
  { eventId: 'evt_rtveli', keys: ['arsiani', 'mzevali', 'pinecone'] },
  { eventId: 'evt_popup', keys: ['kvamli', 'icicle'] },
  { eventId: null, keys: ['snowball', 'arsiani'], inactive: ['arsiani'] },
]

function buildItems(): Item[] {
  const out: Item[] = []
  for (const lineup of LINEUP) {
    const owner = lineup.eventId ? eventById(lineup.eventId) : null
    const createdMs = owner ? Date.parse(owner.createdAt) + 2 * 3_600_000 : Date.parse(onDay(-70, 10))
    lineup.keys.forEach((key, index) => {
      const kind = KIND[key]
      const inactive = lineup.inactive?.includes(key) ?? false
      const createdAt = new Date(createdMs + index * 4 * 60_000).toISOString()
      out.push({
        id: `itm_${lineup.eventId ? lineup.eventId.replace(/^evt_/, '') : 'library'}_${key}`,
        eventId: lineup.eventId,
        name: kind.name,
        type: kind.type,
        points: kind.points,
        imageUrl: kind.imageUrl,
        brandName: kind.brandName,
        active: !inactive,
        weight: kind.weight,
        sortOrder: index + 1,
        createdAt,
        // The live event's slush was switched off this morning.
        updatedAt: inactive && lineup.eventId === LIVE_EVENT_ID ? fromAnchor(-5) : createdAt,
      })
    })
  }
  return out
}

export const ITEMS: Item[] = buildItems()

export const itemsFor = (eventId: string): Item[] => ITEMS.filter((item) => item.eventId === eventId && item.active)

/* ----------------------------------------------------------------- trivia */

function question(
  id: string,
  eventId: string,
  sortOrder: number,
  text: string,
  options: string[],
  correctIndex: number,
  points: number,
  seconds: number,
  createdAt: string,
  extra: Partial<Pick<TriviaQuestion, 'active' | 'updatedAt'>> = {},
): TriviaQuestion {
  return { id, eventId, question: text, options, correctIndex, points, seconds, active: true, sortOrder, createdAt, updatedAt: createdAt, ...extra }
}

export const QUESTIONS: TriviaQuestion[] = [
  question('trv_n1', LIVE_EVENT_ID, 1, 'How long does one Tova round last?', ['30 seconds', '45 seconds', '60 seconds', '90 seconds'], 2, 10, 12, onDay(-6, 9, 10)),
  question('trv_n2', LIVE_EVENT_ID, 2, 'Which Narinji Expo sponsor roasts its own beans in Tbilisi?', ['Mzevali Tea', 'Kvamli Coffee', 'Arsiani Bakery', 'Tetri Kalami'], 1, 20, 15, onDay(-6, 9, 14)),
  question('trv_n3', LIVE_EVENT_ID, 3, 'What does catching a storm cloud cost you?', ['10 points', '50 points', '500 points', 'The whole round'], 2, 15, 15, onDay(-6, 9, 18)),
  question('trv_n4', LIVE_EVENT_ID, 4, "Lurji Velo's grand prize voucher is for…", ['A city bike', 'A bike helmet', 'A year of free repairs'], 0, 25, 18, onDay(-6, 9, 25)),
  question('trv_n5', LIVE_EVENT_ID, 5, 'Mzevali Tea grows its leaves in which region?', ['Guria', 'Kakheti', 'Svaneti', 'Racha'], 0, 30, 20, onDay(-6, 9, 31), { updatedAt: onDay(-2, 14, 5) }),
  question('trv_n6', LIVE_EVENT_ID, 6, 'True or false: letting a sponsor coin fall past you costs points.', ['True', 'False'], 1, 10, 12, onDay(-5, 16, 2)),
  question('trv_p1', 'evt_pilpili', 1, 'Which bakery ran the bread-tasting corner at Pilpili Food Week?', ['Arsiani Bakery', 'Kvamli Coffee', 'Mzevali Tea'], 0, 20, 15, onDay(-15, 11, 0)),
  question('trv_p2', 'evt_pilpili', 2, 'How many chefs cooked on the Pilpili main stage on day one?', ['4', '6', '8'], 1, 15, 15, onDay(-15, 11, 6), {
    active: false,
    updatedAt: onDay(-12, 6, 40),
  }),
]

/* ----------------------------------------------------------------- prizes */

function prize(id: string, eventId: string, sortOrder: number, label: string, description: string | null, imageUrl: string | null, createdAt: string): Prize {
  return { id, eventId, label, description, imageUrl, sortOrder, createdAt }
}

export const PRIZES: Prize[] = [
  prize('prz_n1', LIVE_EVENT_ID, 1, 'City bike voucher', 'A city bike from Lurji Velo, fitted to you in their Vake workshop.', 'media/prizes/city-bike.svg', onDay(-7, 10, 0)),
  prize('prz_n2', LIVE_EVENT_ID, 2, 'Notebook and pen set', 'A dot-grid notebook and a brass pen from Tetri Kalami.', 'media/prizes/notebook-set.svg', onDay(-7, 10, 6)),
  prize('prz_n3', LIVE_EVENT_ID, 3, 'Tea gift box', 'Six loose-leaf blends from Mzevali Tea in a wooden box.', 'media/prizes/tea-box.svg', onDay(-7, 10, 9)),
  prize('prz_n4', LIVE_EVENT_ID, 4, 'Monthly coffee pass', 'One filter coffee a day for a month at any Kvamli Coffee bar.', null, onDay(-2, 13, 30)),
  prize('prz_p1', 'evt_pilpili', 1, 'Breakfast box', 'Fresh bread and pastries for four from Arsiani Bakery.', 'media/prizes/breakfast-box.svg', onDay(-20, 12, 0)),
  prize('prz_p2', 'evt_pilpili', 2, 'Coffee tasting for two', 'A guided cupping at the Kvamli Coffee roastery.', null, onDay(-20, 12, 4)),
  prize('prz_v1', 'evt_velo', 1, 'Bike helmet', 'A commuter helmet from Lurji Velo.', 'media/prizes/helmet.svg', onDay(-10, 9, 30)),
  prize('prz_b1', 'evt_batumi', 1, 'Tea gift box', 'Six loose-leaf blends from Mzevali Tea.', 'media/prizes/tea-box.svg', onDay(-24, 15, 0)),
]
