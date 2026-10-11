/**
 * Georgian text for operations: system-log messages, scheduler job summaries,
 * health-check reasons and incidents, mail backfill messages.
 *
 * Most of these strings are built from parts (`Synced 81 users (0 created, 1
 * deactivated)`), so they are template rules. `incident.reason` and the
 * service `reason` are SOFT keys in the localizer (exact lookup only), so every
 * reason the health simulator can produce is listed as an exact entry too.
 *
 * Code-like identifiers stay as they are: job names (`mail.imap.poll`),
 * sources (`partner.user_sync.sync`), key ids (`demo_V3K79HRC`), routes and
 * error codes. Counts are written with the SINGULAR noun after a numeral.
 */
import type { KaEntries, KaPattern } from './types'

/* ---------------------------------------------------------- health reasons */

/** Every reason the health simulator and the seeded incidents use. */
const HEALTH_REASONS: KaEntries = {
  // imap, degraded
  'IMAP responses slower than 1500 ms': 'IMAP-ის პასუხები 1500 მწ-ზე ნელია',
  'IMAP IDLE reconnecting repeatedly': 'IMAP IDLE არაერთხელ თავიდან უკავშირდება',
  'Mailbox SELECT took 2.8 s': 'საფოსტო ყუთის SELECT ბრძანებამ 2.8 წმ გასტანა',
  // imap, down
  'IMAP login timed out after 10000 ms': 'IMAP-ში შესვლის დრო 10000 მწ-ის შემდეგ ამოიწურა',
  'IMAP connection reset by peer (ECONNRESET)': 'IMAP კავშირი გაწყვიტა მეორე მხარემ (ECONNRESET)',
  // smtp, degraded
  'SMTP greeting took 2.4 s': 'SMTP-ის მისალმებამ 2.4 წმ გასტანა',
  'SMTP 421 try again later (rate limited)': 'SMTP 421: სცადეთ მოგვიანებით (მოთხოვნების ლიმიტი)',
  // smtp, down
  'SMTP connect ECONNREFUSED': 'SMTP-თან დაკავშირება ვერ მოხერხდა (ECONNREFUSED)',
  'SMTP TLS handshake timed out': 'SMTP TLS handshake-ის დრო ამოიწურა',
  // seeded incidents
  'Slow checkpoints: p99 query latency above 800 ms': 'ნელი checkpoint-ები: მოთხოვნების p99 დაყოვნება 800 მწ-ზე მეტია',
  'Queue latency above 5 s': 'ამოცანების რიგის დაყოვნება 5 წმ-ზე მეტია',
  'Connection refused by the relay': 'რელემ კავშირი უარყო',
  'IMAP login timeout': 'IMAP-ში შესვლის დრო ამოიწურა',
}

/** Display names of the monitored services (as written into log messages). */
const SERVICES: Readonly<Record<string, string>> = {
  Postgres: 'მონაცემთა ბაზა',
  'Job queue': 'ამოცანების რიგი',
  SMTP: 'SMTP',
  IMAP: 'IMAP',
  Attachments: 'დანართების საცავი',
}

/** What follows "failed:" in an HTTP error log line. */
const HTTP_FAILURES: Readonly<Record<string, string>> = {
  'payload too large (2.4 MB)': 'ზედმეტად დიდი მოთხოვნა (2.4 MB)',
  'connection reset by peer': 'კავშირი გაწყვიტა მეორე მხარემ',
  'template render timeout': 'შაბლონის რენდერის დრო ამოიწურა',
  'duplicate event id': 'მოვლენის id დუბლირებულია',
  'IMAP login timeout': 'IMAP-ში შესვლის დრო ამოიწურა',
  'clock skew too large': 'საათების სხვაობა ზედმეტად დიდია',
}

/** Exact English seed string -> Georgian. */
export const entries: KaEntries = {
  ...HEALTH_REASONS,
  'Message too large (attachment over 25 MB)': 'წერილი ზედმეტად დიდია (დანართი 25 MB-ზე მეტია)',
  'Connection refused': 'კავშირი უარყოფილია',
}

/* ------------------------------------------------------- scheduler summaries */

const JOBS = 'mail\\.imap\\.poll|points\\.month\\.close|invoices\\.generate\\.month|invoices\\.autodraft\\.daily|usercount\\.snapshot\\.daily'

/** Summaries of the five cron jobs: the seeded runs and what the handlers return. */
const SUMMARY_RULES: KaPattern[] = [
  [/^(\d+) partners? snapshotted$/, (m) => `${m[1]} პარტნიორის მომხმარებელთა რაოდენობა ჩაიწერა`],
  [/^[Nn]o drafts created$/, () => 'მონახაზი არ შექმნილა'],
  [/^Closed the points period for (\d+) partners?$/, (m) => `ქულების პერიოდი დაიხურა ${m[1]} პარტნიორისთვის`],
  [/^(\d+) drafts? created, (\d+) skipped \(user-count sync incomplete\)$/, (m) => `შეიქმნა ${m[1]} მონახაზი, გამოტოვებულია ${m[2]} (მომხმარებელთა რაოდენობის სინქრონიზაცია არასრულია)`],
  [/^(\d+) drafts? created, (\d+) skipped$/, (m) => `შეიქმნა ${m[1]} მონახაზი, გამოტოვებულია ${m[2]}`],
  [/^(\d+) mails? ingested, (\d+) skipped, (\d+) remaining$/, (m) => `შემოვიდა ${m[1]} წერილი, გამოტოვებულია ${m[2]}, დარჩენილია ${m[3]}`],
  [/^User count snapshot written for (\d+) active partners?$/, (m) => `მომხმარებელთა რაოდენობა ჩაიწერა ${m[1]} აქტიური პარტნიორისთვის`],
  [
    /^Closed (\d{4}-\d{2}) for (\d+) partners?: (-?[\d.]+) free pts used, (-?[\d.]+) chargeable pts \((-?[\d.,]+) in partner currencies\)$/,
    (m) => `პერიოდი ${m[1]} დაიხურა ${m[2]} პარტნიორისთვის: გამოყენებულია ${m[3]} უფასო ქულა, ${m[4]} ასანაზღაურებელი ქულა (${m[5]} პარტნიორთა ვალუტებში)`,
  ],
  [/^(\d{4}-\d{2}): (\d+) drafts? created, (\d+) skipped \(already invoiced\)$/, (m) => `${m[1]}: შეიქმნა ${m[2]} მონახაზი, გამოტოვებულია ${m[3]} (ინვოისი უკვე არსებობს)`],
  [
    /^Day (\d+): (\d+) partners? due, (\d+) drafts? created for (\d{4}-\d{2}), (\d+) skipped$/,
    (m) => `${m[1]} რიცხვი: ინვოისის გაცემის დღეა ${m[2]} პარტნიორისთვის, ${m[4]} პერიოდისთვის შეიქმნა ${m[3]} მონახაზი, გამოტოვებულია ${m[5]}`,
  ],
  [/^No runner registered for (.+)$/, (m) => `${m[1]}: შემსრულებელი რეგისტრირებული არ არის`],
]

/** Georgian text for a job summary; the input when no rule applies. */
function jobSummary(text: string): string {
  for (const [match, build] of SUMMARY_RULES) {
    const m = match.exec(text)
    if (m) return build(m)
  }
  return text
}

/* ------------------------------------------------------------------ rules */

/** Template rules for strings the seed and the simulators build from parts. */
export const patterns: KaPattern[] = [
  ...SUMMARY_RULES,

  /* --------------------------------------------- scheduler, in the system log */
  // "usercount.snapshot.daily finished: 8 partners snapshotted"
  [new RegExp(`^(${JOBS}) finished: (.+)$`), (m) => `${m[1]} დასრულდა: ${jobSummary(m[2])}`],
  // "points.month.close: Closed 2026-09 for ..." (manual run)
  [new RegExp(`^(${JOBS}): (.+)$`), (m) => `${m[1]}: ${jobSummary(m[2])}`],

  /* ----------------------------------------------------- partner sync logs */
  [/^Issued access token for (?:key )?(\S+)$/, (m) => `გაიცა წვდომის ტოკენი გასაღებისთვის ${m[1]}`],
  [/^Rejected token for revoked key (\S+)$/, (m) => `ტოკენი უარყოფილია: გასაღები ${m[1]} გაუქმებულია`],
  [/^Synced (\d+) users? \((\d+) created, (\d+) deactivated\)$/, (m) => `სინქრონიზებულია ${m[1]} მომხმარებელი (შეიქმნა: ${m[2]}, გათიშულია: ${m[3]})`],
  [/^Received (\d+) (?:membership|user) events?$/, (m) => `მიღებულია ${m[1]} მომხმარებლის მოვლენა`],
  [/^Current billable user count (\d+)$/, (m) => `დასაბეგრი მომხმარებლების მიმდინარე რაოდენობა: ${m[1]}`],
  [/^User sync complete: (\d+) created, (\d+) deactivated, (\d+) active$/, (m) => `სინქრონიზაცია დასრულდა: შეიქმნა ${m[1]}, გათიშულია ${m[2]}, აქტიურია ${m[3]}`],

  /* ------------------------------------------------------------ HTTP errors */
  // "POST /machine/v1/user-sync/events failed: payload too large (2.4 MB)"
  [
    /^(GET|POST|PUT|PATCH|DELETE) (\S+) failed: (.+)$/,
    (m) => `${m[1]} ${m[2]}: შეცდომა — ${HTTP_FAILURES[m[3]] ?? HEALTH_REASONS[m[3]] ?? m[3]}`,
  ],

  /* --------------------------------------------------------- health monitor */
  [/^(Postgres|Job queue|SMTP|IMAP|Attachments) down: (.+)$/, (m) => `${SERVICES[m[1]]} გათიშულია: ${HEALTH_REASONS[m[2]] ?? m[2]}`],
  [/^(Postgres|Job queue|SMTP|IMAP|Attachments) degraded: (.+)$/, (m) => `${SERVICES[m[1]]} მუშაობს შეფერხებით: ${HEALTH_REASONS[m[2]] ?? m[2]}`],
  [/^(Postgres|Job queue|SMTP|IMAP|Attachments) recovered after (\d+) s$/, (m) => `${SERVICES[m[1]]} აღდგა ${m[2]} წმ-ის შემდეგ`],

  /* ------------------------------------------------------------ mail backfill */
  [/^Backfill (\S+) started \((\d+) messages\)$/, (m) => `ბექფილი ${m[1]} დაიწყო (${m[2]} წერილი)`],
  [/^Backfill (\S+) cancelled at (\d+)\/(\d+)$/, (m) => `ბექფილი ${m[1]} გაუქმდა: დამუშავდა ${m[2]}/${m[3]}`],
  [
    /^Backfill (\S+) completed: (\d+) ingested, (\d+) duplicates skipped, (\d+) errors$/,
    (m) => `ბექფილი ${m[1]} დასრულდა: შემოვიდა ${m[2]}, გამოტოვებულია ${m[3]} დუბლიკატი, შეცდომა: ${m[4]}`,
  ],
  [/^UID (\d+): malformed MIME boundary$/, (m) => `UID ${m[1]}: დაზიანებული MIME საზღვარი`],
  [/^UID (\d+): attachment exceeds 25 MB, skipped body$/, (m) => `UID ${m[1]}: დანართი 25 MB-ს აღემატება, წერილის ტექსტი გამოტოვებულია`],
  [/^UID (\d+): invalid charset "(.+)"$/, (m) => `UID ${m[1]}: არასწორი კოდირება „${m[2]}“`],
  [/^IMAP poll: (\d+) ingested, (\d+) skipped, (\d+) remaining$/, (m) => `IMAP-ის გამოკითხვა: შემოვიდა ${m[1]}, გამოტოვებულია ${m[2]}, დარჩენილია ${m[3]}`],
  [/^Mail storage purged: (\d+) bodies, (\d+) attachment blobs$/, (m) => `წერილების საცავი გასუფთავდა: ${m[1]} წერილის ტექსტი, ${m[2]} დანართის ფაილი`],

  /* ---------------------------------------------------- connection test result */
  [/^Connected to (\S+):(\d+), INBOX selected$/, (m) => `დაკავშირებულია ${m[1]}:${m[2]}, INBOX არჩეულია`],
  [/^Connected to (\S+):(\d+), EHLO accepted$/, (m) => `დაკავშირებულია ${m[1]}:${m[2]}, EHLO მიღებულია`],

  /* --------------------------------------------------------- partner events */
  [/^Partner created: (.+)$/, (m) => `პარტნიორი შეიქმნა: ${m[1]}`],
  [/^Partner enabled: (.+)$/, (m) => `პარტნიორი ჩაირთო: ${m[1]}`],
  [/^Partner disabled, portal sessions revoked: (.+)$/, (m) => `პარტნიორი გათიშულია, პორტალის სესიები გაუქმებულია: ${m[1]}`],
  [/^Partner deleted \(deactivated\): (.+)$/, (m) => `პარტნიორი წაშლილია (დეაქტივირებულია): ${m[1]}`],
]
