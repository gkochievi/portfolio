/**
 * Tova domain types: the contract every agent builds on.
 *
 * Owner: architect, then the data agent. Feature groups import from here but
 * never edit it; ask in your final message if a type must change.
 *
 * Every timestamp is an ISO-8601 string (UTC `...Z`) whose key ends in `At`,
 * so `rebaseDates` in `src/demo/store.ts` shifts it onto "now" on every load
 * and every reset. Media paths (`imageUrl`) are BASE_URL-relative
 * (`media/items/kvamli-coffee.svg`) or a `blob:` URL from an upload; resolve
 * them with `assetUrl()` from `@/lib/assets`.
 */

export type ISODate = string

/* ------------------------------------------------------------------ roles */

export type Role = 'SUPERADMIN' | 'ADMIN' | 'SUPERVISOR' | 'PLAYER'

/* --------------------------------------------------------------- entities */

export interface User {
  id: string
  email: string
  username: string | null
  firstName: string
  lastName: string
  /** Free text as typed at the stand, e.g. `+995 555 41 27 90`. */
  phone: string
  company: string
  position: string
  role: Role
  /** True for SUPERADMIN and ADMIN (the source's `isAdmin`); kept in sync on role change. */
  isAdmin: boolean
  /** Suspended accounts cannot sign in and are excluded from standings. */
  disabled: boolean
  /** Created by a free-text email or code login rather than registration. */
  guest: boolean
  createdAt: ISODate
}

export type Difficulty = 'easy' | 'normal' | 'hard'
export type SpeedLevel = 1 | 2 | 3
/** Derived, never stored: hold = unpublished; otherwise by the start/end window. */
export type EventStatus = 'hold' | 'upcoming' | 'open' | 'closed'

/** An event the stand runs (the source's "Game"). */
export interface GameEvent {
  id: string
  name: string
  startsAt: ISODate
  endsAt: ISODate
  /** Round length in seconds (default 60). */
  durationSeconds: number
  /** Fairness cap: exact catchable points every round offers. */
  maxGood: number
  /** Fairness cap: exact penalty points every round throws (positive number). */
  maxBad: number
  difficulty: Difficulty
  /** 1 = x1, 2 = x1.5, 3 = x2 fall speed. */
  speedLevel: SpeedLevel
  /** How many rows the standings board shows. */
  leaderboardSize: number
  published: boolean
  awardsVisible: boolean
  leaderboardVisible: boolean
  /** When prize winners were notified; display only. */
  notifiedAt: ISODate | null
  createdAt: ISODate
  updatedAt: ISODate
}

/** GOOD = sponsor item (+), MINOR = small hazard (-10), MAJOR = big hazard (-500). */
export type ItemType = 'GOOD' | 'MINOR' | 'MAJOR'

/** A falling item (the source's "GameObject"). */
export interface Item {
  id: string
  /** null = shared library item, not attached to an event. */
  eventId: string | null
  name: string
  type: ItemType
  /** Signed: +50 for sponsor items, -10 / -500 for hazards. */
  points: number
  imageUrl: string | null
  /** UI label "Brand name". */
  brandName: string | null
  active: boolean
  /** Spawn weight 1-100. */
  weight: number
  sortOrder: number
  createdAt: ISODate
  updatedAt: ISODate
}

/** Catches of one item in one round, split by enhancement level (l1 normal, l2 x1.5, l3 x2). */
export interface CatchTally {
  name: string
  type: ItemType
  l1: number
  l2: number
  l3: number
}

/** One finished round (the source's "GameSession"). */
export interface Play {
  id: string
  userId: string
  eventId: string | null
  score: number
  /** Seconds actually played. */
  duration: number
  breakdown: CatchTally[] | null
  playedAt: ISODate
}

export interface TriviaQuestion {
  id: string
  eventId: string
  question: string
  /** 2-4 options. */
  options: string[]
  /** Never sent to players. */
  correctIndex: number
  points: number
  /** Answer time limit. */
  seconds: number
  active: boolean
  sortOrder: number
  createdAt: ISODate
  updatedAt: ISODate
}

export interface TriviaAnswer {
  id: string
  userId: string
  questionId: string
  /** -1 = timed out. Unique per (userId, questionId). */
  selectedIndex: number
  correct: boolean
  answeredAt: ISODate
}

export interface Prize {
  id: string
  eventId: string
  label: string
  description: string | null
  imageUrl: string | null
  sortOrder: number
  createdAt: ISODate
}

/** The whole in-memory database (`store.data`). */
export interface DemoDb {
  users: User[]
  events: GameEvent[]
  items: Item[]
  plays: Play[]
  questions: TriviaQuestion[]
  answers: TriviaAnswer[]
  prizes: Prize[]
}

/* ---------------------------------------------------------- demo accounts */

/** One-click demo account (DemoBar + login buttons). `id` equals the seeded `User.id`. */
export interface TovaAccount {
  id: string
  name: string
  nameKa: string
  email: string
  password: string
  role: Role
  roleLabel?: string | undefined
  description?: string | undefined
  avatarColor?: string | undefined
}

/* ------------------------------------------------------------ API shapes */

/** `GET /api/auth/me` and every auth response. */
export interface SessionUser {
  id: string
  email: string
  firstName: string
  lastName: string
  company: string
  role: Role
  isStaff: boolean
  canEdit: boolean
  isSuper: boolean
}

/** `GET /api/events/current` (public). */
export interface CurrentEvents {
  /** Published and now within the window. */
  active: GameEvent | null
  /** Active, else the latest published one that has started. */
  current: GameEvent | null
  /** Next published event that has not started. */
  upcoming: GameEvent | null
  now: ISODate
}

/** What the engine needs per item. */
export interface ItemDef {
  id: string
  name: string
  type: ItemType
  points: number
  imageUrl: string | null
  weight: number
}

/** `GET /api/play/config`. */
export interface PlayConfig {
  event: GameEvent | null
  items: ItemDef[]
  best: number
  upcoming: GameEvent | null
}

/** `POST /api/play/score` body. */
export interface ScoreSubmit {
  eventId: string
  score: number
  duration: number
  breakdown: CatchTally[]
}

/** `POST /api/play/score` response. */
export interface ScoreResult {
  play: Play
  /** The submitted score after the fairness clamp. */
  score: number
  best: number
  isNewBest: boolean
}

export interface LeaderRow {
  rank: number
  /** Only sent to staff (drill-down); null for the public. */
  userId: string | null
  name: string
  company: string
  /** Best single round + correct trivia points (never a sum of rounds). */
  score: number
  isMe: boolean
}

/** `GET /api/leaderboard` (public). */
export interface LeaderboardResponse {
  event: GameEvent | null
  /** True for non-staff when `leaderboardVisible` is off. */
  hidden: boolean
  rows: LeaderRow[]
  updatedAt: ISODate
}

/** `GET /api/admin/leaderboard/users/:userId` (staff drill-down). */
export interface PlayerDetail {
  profile: Pick<User, 'firstName' | 'lastName' | 'email' | 'phone' | 'company' | 'position' | 'role'>
  bestScore: number
  bonusPoints: number
  totalPlays: number
  breakdown: (CatchTally & { total: number })[]
  plays: { score: number; playedAt: ISODate }[]
}

/** A trivia question as players see it: no correct index. */
export interface TriviaPrompt {
  id: string
  question: string
  options: string[]
  points: number
  seconds: number
}

/** `GET /api/trivia/state`. */
export interface TriviaState {
  totalCount: number
  answeredCount: number
  earnedPoints: number
  remaining: TriviaPrompt[]
}

/** `POST /api/trivia/answer` response. */
export interface TriviaAnswerResult {
  correct: boolean
  timedOut: boolean
  pointsAwarded: number
}

/** `GET /api/me/card`. */
export interface MyCard {
  user: SessionUser
  event: GameEvent | null
  best: number
  bonus: number
  /** best + bonus. */
  total: number
  rounds: number
  /** Newest first, at most 100. */
  history: { id: string; score: number; playedAt: ISODate }[]
  /** Board hidden from this viewer: show the countdown to `event.endsAt` instead of a rank. */
  boardHidden: boolean
}

/** `GET /api/prizes` (public). */
export interface PrizesResponse {
  event: GameEvent | null
  visible: boolean
  prizes: Prize[]
}

/** `GET /api/admin/events` row. */
export interface EventSummary extends GameEvent {
  status: EventStatus
  itemCount: number
  prizeCount: number
  triviaCount: number
  playCount: number
}

/** `GET /api/admin/dashboard`. */
export interface DashboardSummary {
  players: number
  plays: number
  activeEvent: EventSummary | null
}

/** `GET /api/admin/participants` row; also the 9 export columns. */
export interface ParticipantRow {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  company: string
  position: string
  best: number
  plays: number
  createdAt: ISODate
}

export interface DayCount {
  /** `YYYY-MM-DD`. */
  date: string
  count: number
}

/** `GET /api/admin/stats` (port of the source's getStats()). */
export interface Stats {
  generatedAt: ISODate
  totals: {
    players: number
    activePlayers: number
    disabledPlayers: number
    staff: number
    events: number
    publishedEvents: number
    plays: number
    totalPoints: number
    avgScore: number
    maxScore: number
    avgPlaysPerPlayer: number
    triviaAnswers: number
    triviaCorrect: number
    triviaBonus: number
  }
  thisMonth: { newPlayers: number; plays: number; activeEvents: number }
  /** 30 days, ascending, zero-filled. */
  registrationsByDay: DayCount[]
  playsByDay: DayCount[]
  topScores: { name: string; company: string; score: number; event: string | null; playedAt: ISODate }[]
  topPlayers: { name: string; company: string; plays: number; best: number }[]
  perEvent: {
    id: string
    name: string
    status: EventStatus
    startsAt: ISODate
    endsAt: ISODate
    players: number
    plays: number
    avgScore: number
    topScore: number
    topPlayer: string | null
    newUsers: number
    triviaAnswers: number
  }[]
  catches: {
    totalCaught: number
    byType: { type: ItemType; total: number; l1: number; l2: number; l3: number }[]
    top: { name: string; type: ItemType; total: number }[]
  }
}

/* --------------------------------------------------------------- events */

/** The in-browser event bus (`bus` in `src/demo/store.ts`). */
export interface DemoEvents {
  /** A round was saved: by the visitor (play) or a ghost player (standings simulator). */
  'play:created': { playId: string; userId: string; eventId: string | null; score: number; ghost: boolean }
  'trivia:answered': { userId: string; questionId: string; correct: boolean }
  /** Any admin write to an event or its items, trivia or prizes. */
  'event:changed': { eventId: string }
  /** Registration, guest login, or a People-page create/role/suspend/delete. */
  'user:changed': { userId: string }
  /** Reset demo data. */
  'demo:reset': undefined
}
