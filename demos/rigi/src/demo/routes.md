# Rigi demo routes

Every endpoint the in-browser mock API answers: **163 registered routes**, listed by owner file.
Nothing here is a network request. The UI calls `api.get('/partners')`; `@/lib/api` hands the call
to `mockApi.dispatch('GET', '/api/partners')`, which matches it against this table, runs the
handler against the store and resolves with a structured clone of the result. The live list is `mockApi.routes()`
(`@portfolio/demo-kit`); this file is the annotated version.

## How to read this

- **Prefix.** Paths are registered without `/api` (`createMockApi({ prefix: '/api' })`).
- **Path params** are `:name` segments. Query parameters arrive in `params`, JSON bodies in
  `body`.
- **Latency.** The kit adds a short randomised delay to each call (reads 90 to 260 ms, writes 140 to 340 ms) so spinners, skeletons and
  optimistic states are real. A handful of handlers add their own (the IMAP and SMTP tests and invoice
  email wait 800 ms).
- **Auth column.** A request is *authenticated* when any persona is signed in; the only public
  routes are the `/auth/` and `/portal/auth/` families (`PUBLIC_PREFIXES` in `api.ts`). Role checks
  live in each handler through `requireStaff(...)`, `requireSuperadmin()` and
  `requirePartnerAdmin()` (`ctx.ts`).
  - A role named in the column means that role **and the superadmin**, who always passes
    `requireStaff`. `superadmin` means only the superadmin.
  - `any staff` is every staff role; partner admins are refused with 403.
  - `partner admin` scopes every query to the signed-in partner and answers 403 `account_disabled`
    once that partner is switched off. Another partner's rows are never reachable.
- **Errors** are `DemoApiError`s: 400 with `fieldErrors` for validation, 401 signed out, 403,
  404, 409 for state conflicts (invalid transition, duplicate invoice period, license in use) and
  405 for a known path with the wrong verb.
- **Audit.** Mutations by the accountant, L1 and technician roles call `recordAudit`; the
  superadmin is skipped on purpose, as in the original product.
- **Changed events.** Every mutation calls `emitChanged(...)`, which the shell turns into a React
  Query invalidation of every key whose first element names the entity.

## Behaviour that is not an endpoint

These run beside the routes and write to the same store.

| What | Where | Does |
|---|---|---|
| Timed mail injector | `support-desk.ts` | Every 15 s delivers pending mails whose `deliverAfterSec` has elapsed since load, threads them, links replies to tasks, toasts "New mail from …". |
| Chat simulator | `tasks.ts` | About 6 s after a partner posts on a task, a staff assignee (or Mariam) answers in the same language. |
| Health simulator | `ops.ts` | A 5 s tick moves the seeded random walk behind `/system-health/snapshot`; every few minutes IMAP or SMTP degrades, opening an incident, a log row and a toast, and later recovers. |
| Backfill timer | `ops.ts` | Advances a mail backfill run every 2 s. |
| API key usage | `partners.ts` | Every 40 s, a live key with the write scope gets a fresh `lastUsedAt`, so the key lists look like partners are pushing counts. |
| Pricing review | `portal.ts` | A freeform task a partner submits is priced about 22 s later and a project request shortly after; the partner gets a toast with a link. |
| Scheduler jobs | `jobs.ts` | `mail.imap.poll`, `points.month.close`, `invoices.generate.month`, `invoices.autodraft.daily` and `usercount.snapshot.daily` are registered by the groups that own them and run through `POST /scheduler/jobs/:name/run`. |

## Sign-in and session

Owner: [`handlers/auth.ts`](./handlers/auth.ts) — 8 routes.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/login` | public | Staff sign-in. Email plus the shared demo password; inactive or deleted staff are refused. Starts the session. |
| POST | `/auth/switch` | public | Demo bar persona switch: signs in as any of the five accounts by id, no password. |
| POST | `/auth/logout` | public | Ends the session. |
| GET | `/auth/me` | public | The signed-in account (password stripped), or null when signed out. Drives the guards. |
| POST | `/auth/forgot-password` | public | Accepts any email and answers ok. Nothing is sent. |
| POST | `/auth/reset-password` | public | Validates token presence, length and confirmation, then answers ok. The password does not change. |
| POST | `/portal/auth/login` | public | Partner portal sign-in by username or email. A disabled partner or portal admin answers 403 account_disabled. |
| GET | `/portal/me` | partner admin | The partner admin and their partner (name, legal name, currency). The portal shell polls this to catch a disabled tenant. |

## Partners

Owner: [`handlers/partners.ts`](./handlers/partners.ts) — 19 routes.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/partners` | superadmin | Partner list with search and active filter. |
| GET | `/partners/options` | any staff | Id, name and currency for every picker in the app. Any staff role. |
| POST | `/partners` | superadmin | Create a partner (zod-validated form). Superadmin. |
| GET | `/partners/:id` | accountant | Partner detail with license summary. Accountants may read. |
| PATCH | `/partners/:id` | superadmin | Edit profile, contract, technical and contacts. |
| POST | `/partners/:id/activate` | superadmin | Re-enable after a password check. |
| POST | `/partners/:id/deactivate` | superadmin | Disable after a password check; emits partner.access so portal admins are locked out immediately. |
| DELETE | `/partners/:id` | superadmin | Password-checked soft deactivate. |
| GET | `/partners/:id/rates` | superadmin | Rate card and history. |
| POST | `/partners/:id/rates` | superadmin | Append a rate (ratePerPoint, free allowance, effective from); closes the previous open row. |
| GET | `/partners/:id/documents` | accountant | Documents grouped by kind with every version. |
| POST | `/partners/:id/documents` | accountant | Fake upload: reads only name, size and type. |
| POST | `/partners/:id/documents/:docId/versions` | accountant | Add a version to a document. |
| DELETE | `/partners/:id/documents/:docId` | superadmin | Delete a document. |
| GET | `/partners/:id/api-keys` | superadmin | This partner's keys. |
| POST | `/partners/:id/api-keys` | superadmin | Generate a key; the secret is returned once. |
| GET | `/partners/:id/admins` | superadmin | Portal admins for a partner. |
| POST | `/partners/:id/admins` | superadmin | Create a portal admin with a temporary password. |
| PATCH | `/partners/:id/admins/:adminId` | superadmin | Edit, deactivate or reactivate a portal admin. |

## Licenses, seats, mapper and API keys

Owner: [`handlers/licensing.ts`](./handlers/licensing.ts) — 19 routes.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/licenses` | any staff | The license catalogue. Any staff role may read it. |
| POST | `/licenses` | superadmin | Create a license; the code is auto UPPER_SNAKE. |
| PATCH | `/licenses/:id` | superadmin | Edit name, kind, price, currency, active flag. The code is read-only. |
| DELETE | `/licenses/:id` | superadmin | Delete; 409 when seats or users reference it. |
| GET | `/partners/:id/seats` | accountant | The seat pool per license with effective price, tagged users, monthly cost, totals, and optionally the batch history. |
| POST | `/partners/:id/seats` | accountant | Change a pool: raising adds a batch, lowering closes or splits the newest open batches. |
| GET | `/partners/:id/license-overrides` | accountant | Per-partner price overrides against the catalogue. |
| PUT | `/partners/:id/license-overrides/:licenseId` | superadmin | Set an override price. |
| DELETE | `/partners/:id/license-overrides/:licenseId` | superadmin | Clear it. |
| GET | `/partners/:id/mapper` | accountant | Seat cards with mapped users, the unmapped pool and read-only add-ons. |
| POST | `/partners/:id/mapper/assign` | accountant | Give a user a license; refused with no free seat. |
| POST | `/partners/:id/mapper/unmap` | accountant | Remove a user's license. |
| POST | `/partners/:id/mapper/swap` | accountant | Swap the licenses of two users (needs no free seat). |
| GET | `/partners/:id/users` | accountant | The synced-user roster for a partner. |
| PATCH | `/partners/:id/users/billing` | superadmin | Bulk enable or disable billing for selected users. |
| POST | `/partners/:id/sync/simulate` | superadmin | Play one partner sync: adds 1 to 3 users, deactivates 0 to 2, updates membership periods, writes partner.* system-log rows. |
| GET | `/api-keys` | superadmin | Every partner's machine API keys. |
| POST | `/api-keys/:id/revoke` | superadmin | Revoke a key. |
| GET | `/accountant/partners/:id` | accountant | Partner billing profile: rate card, headcount trend, points this month, licenses, invoices. |

## Admin home, task catalogue and staff users

Owner: [`handlers/admin-catalog.ts`](./handlers/admin-catalog.ts) — 16 routes.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/admin/dashboard` | superadmin | Superadmin home: four KPIs with sparklines, queues (expiring contracts, overdue invoices, newest open tasks, recent audit rows). |
| GET | `/task-templates` | any staff | The task catalogue with usage counts. Any staff role may read it (L1 task creation needs it). |
| POST | `/task-templates` | superadmin | Create a template; the code is auto-slugged UPPER_SNAKE with a _2 suffix on collision. |
| GET | `/task-templates/:id` | superadmin | One template with its per-partner price overrides. |
| PATCH | `/task-templates/:id` | superadmin | Edit name, description, points, freeform flag, active flag. The code is immutable. |
| DELETE | `/task-templates/:id` | superadmin | Delete, or archive instead when tasks reference it. |
| POST | `/task-templates/:id/partner-rates` | superadmin | Add or change one partner's point price for this template. |
| DELETE | `/task-templates/:id/partner-rates/:partnerId` | superadmin | Remove that partner price override. |
| GET | `/partners/:id/task-templates` | superadmin | The effective catalogue for one partner: hidden flag and name, description and points overrides. |
| PUT | `/partners/:id/task-templates/:templateId` | superadmin | Set a partner's override for a template (hide, rename, re-describe, re-price). |
| DELETE | `/partners/:id/task-templates/:templateId` | superadmin | Reset the template to the catalogue defaults for that partner. |
| GET | `/users` | superadmin | Staff directory with role, technician type, active flag and last login. |
| GET | `/users/:id` | superadmin | One staff user. |
| POST | `/users` | superadmin | Create a staff user (email, names, role, technician type, password of 8+ characters). Audited. |
| PATCH | `/users/:id` | superadmin | Edit a staff user; the password is optional on edit. Audited. |
| DELETE | `/users/:id` | superadmin | Soft-delete a staff user; refuses yourself. Audited. |

## Audit, system log, health, settings and scheduler

Owner: [`handlers/ops.ts`](./handlers/ops.ts) — 20 routes.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/audit` | accountant | Paged audit trail with entity, actor, partner and date filters and JSON diffs. |
| GET | `/system-logs` | superadmin | Paged, filtered system log. |
| GET | `/system-logs/retention` | superadmin | Retention days for the system log. |
| PUT | `/system-logs/retention` | superadmin | Set it (1 to 3650). |
| GET | `/system-health/snapshot` | superadmin | Seeded random-walk snapshot of services, resources and backlog from elapsed time. Can open an incident and log it. |
| GET | `/system-health/history` | superadmin | Bucketed series for one metric and range (min, avg, max). An unknown metric returns an empty series. |
| GET | `/system-health/incidents` | superadmin | Incident list with dependency, start, end and reason. |
| PUT | `/system-health/retention` | superadmin | Set health-history retention. |
| GET | `/settings` | superadmin | IMAP and SMTP settings and the app base URL. |
| PUT | `/settings` | superadmin | Save them. |
| POST | `/settings/test-imap` | superadmin | Simulated connection test: 800 ms, succeeds when the host contains a dot. |
| POST | `/settings/test-smtp` | superadmin | Same for SMTP. |
| GET | `/settings/billing` | accountant | Bank details printed on invoices. |
| PUT | `/settings/billing` | accountant | Save them (superadmin and accountant). |
| GET | `/mail-backfill` | superadmin | Current or last backfill run. |
| POST | `/mail-backfill` | superadmin | Start a run; a timer advances progress (about 85% ingested, 13% skipped, 2% errors). |
| POST | `/mail-backfill/cancel` | superadmin | Cancel the run. |
| POST | `/mail/purge-storage` | superadmin | Pretend to purge stored mail; toast only. |
| GET | `/scheduler/jobs` | superadmin | The five cron jobs with schedule, description and last run. |
| POST | `/scheduler/jobs/:name/run` | superadmin | Run a job now through runJob, record a SchedulerRun and a jobs.run system-log row. |

## Invoices

Owner: [`handlers/invoicing.ts`](./handlers/invoicing.ts) — 14 routes.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/invoicing/partners` | accountant | Partner options for the invoice filters and generators: active flag, currency and templates in scope. |
| GET | `/accountant/dashboard` | accountant | Accountant home: partners, drafts, unpaid, revenue this month by currency, and the draft, overdue and recently-paid queues. |
| GET | `/invoices` | accountant | Invoice list filtered by partner, year, month and status. |
| POST | `/invoices/generate` | accountant | Build the monthly invoice for one partner or all active ones. A duplicate period answers 409 invoice_duplicate_period unless allowDuplicate is set. |
| POST | `/invoices/adhoc` | accountant | Create a one-time invoice from a subject, notes and a lines editor. |
| GET | `/invoices/:id` | accountant | The full invoice: lines, tasks billed (with the free allowance deducted), dates, amounts, dispute, outbox history. |
| PATCH | `/invoices/:id` | accountant | Edit a draft (notes, VAT mode, template). |
| PUT | `/invoices/:id/lines` | accountant | Replace the lines of an ad-hoc draft. |
| POST | `/invoices/:id/regenerate` | accountant | Recompute a monthly draft from current seats, points and projects. |
| POST | `/invoices/:id/issue` | accountant | Draft to issued, with issued and due dates (monthly defaults to the period end, due +14 days). |
| POST | `/invoices/:id/mark-paid` | accountant | Issued to paid on a chosen date. |
| POST | `/invoices/:id/void` | superadmin | Void with a reason of up to 500 characters. Superadmin only. |
| POST | `/invoices/:id/email` | accountant | Send to To and CC lists after an 800 ms delay; appends to the outbox. |
| GET | `/outbox` | accountant | The simulated mail log of sent invoices. |

## Invoice templates and rendering

Owner: [`handlers/invoice-templates.ts`](./handlers/invoice-templates.ts) — 9 routes.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/invoice-templates` | accountant | Invoice templates with scope (global or a partner) and the default flag. |
| POST | `/invoice-templates/preview` | accountant | Renders a template (blocks or raw HTML/CSS) against the sample invoice context; returns html for the preview iframe. |
| POST | `/invoice-templates` | accountant | Create a template. |
| GET | `/invoice-templates/:id` | accountant | One template with its block layout, HTML and CSS. |
| PATCH | `/invoice-templates/:id` | accountant | Save a template. Setting default clears the flag on its scope siblings. |
| DELETE | `/invoice-templates/:id` | accountant | Delete a template. |
| POST | `/invoice-templates/:id/default` | accountant | Make this the default for its scope. |
| GET | `/invoices/:id/document` | accountant | The invoice rendered to printable HTML plus a filename. The client prints it with printHtml. |
| GET | `/portal/invoices/:id/document` | partner admin | Same, for a partner's own non-draft invoices. |

## Support desk: mail, threads and projects

Owner: [`handlers/support-desk.ts`](./handlers/support-desk.ts) — 20 routes.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/l1/dashboard` | l1_employee | Support desk KPIs and the oldest-new-thread queue. |
| GET | `/threads` | l1_employee | Mail threads for the inbox, same filters as mails. |
| GET | `/mails` | l1_employee | Flat mail list with status, q, from, since filters and paging (50). |
| GET | `/mails/:id` | l1_employee | One mail with attachments and linked tasks. |
| POST | `/mails/:id/ignore` | l1_employee | Mark ignored (from new, triaged or follow-up). Audited. |
| POST | `/mails/:id/triage` | l1_employee | Mark triaged. |
| GET | `/threads/:id` | l1_employee | A thread with its messages and linked tasks. |
| POST | `/threads/:id/tasks` | l1_employee | Link the thread to an existing task; future replies route there. |
| DELETE | `/threads/:id/tasks/:taskId` | l1_employee | Unlink. |
| GET | `/attachments/:id` | l1_employee, or the partner admin who owns the mail | Attachment metadata for the preview dialog. Staff, or a partner admin for their own partner's mail. |
| POST | `/mail/poll` | superadmin | Poll now: ingest up to five pending mails, thread them, link replies to tasks and raise toasts. Superadmin. |
| GET | `/projects` | l1_employee | Projects with state, task count and price. |
| POST | `/projects` | l1_employee | Create a project (partner, name, optional price). |
| GET | `/projects/:id` | l1_employee | Project with member tasks. |
| PATCH | `/projects/:id` | l1_employee | Edit name and description. |
| POST | `/projects/:id/tasks` | l1_employee | Add one of the partner's tasks to the project. |
| DELETE | `/projects/:id/tasks/:taskId` | l1_employee | Remove a task from the project. |
| POST | `/projects/:id/price` | l1_employee | Set the fixed price of an open project. |
| POST | `/projects/:id/complete` | l1_employee | Complete with a final price and adjustment note. |
| POST | `/projects/:id/cancel` | l1_employee | Cancel. |

## Tasks, workspace and chat (staff)

Owner: [`handlers/tasks.ts`](./handlers/tasks.ts) — 17 routes.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/technicians` | any staff | Technician list for assignee pickers. Any staff role. |
| GET | `/tasks/templates` | l1_employee | Active templates as options for the task form. |
| GET | `/technician/dashboard` | technician | My open, finished this month, unassigned and all-open counts, plus my plate sorted by deadline. |
| GET | `/tasks` | l1_employee, technician | Filtered, sortable task list (state, partner, title, mine); also feeds the CSV export and the thread task picker. |
| POST | `/tasks` | l1_employee | Create a task from a template, mail or thread, with assignees and linked mails. |
| GET | `/tasks/:id` | l1_employee, technician | The workspace payload: allowed transitions, assignees, links, history. Clears hasNewReplies. |
| PATCH | `/tasks/:id` | l1_employee, technician | Edit title, partner, description, deadline, points. Pricing a freeform task clears pricingPending. |
| POST | `/tasks/:id/transition` | l1_employee, technician | Move through the state machine (domain/tasks.ts); a bad move answers 409; finish is blocked while pricing is pending. |
| POST | `/tasks/:id/assignees` | l1_employee | Add an assignee. |
| DELETE | `/tasks/:id/assignees/:userId` | l1_employee | Remove an assignee. |
| POST | `/tasks/:id/self-assign` | technician | A technician claims an unassigned task. |
| POST | `/tasks/:id/mails` | l1_employee | Link a mail. |
| DELETE | `/tasks/:id/mails/:mailId` | l1_employee | Unlink a mail. |
| POST | `/tasks/:id/threads` | l1_employee | Link a thread. |
| DELETE | `/tasks/:id/threads/:threadId` | l1_employee | Unlink a thread. |
| GET | `/tasks/:id/messages` | l1_employee, technician | Chat for staff, including internal-only messages. |
| POST | `/tasks/:id/messages` | l1_employee, technician | Post a message, optionally internal-only. |

## Partner portal: tasks, projects and documents

Owner: [`handlers/portal.ts`](./handlers/portal.ts) — 14 routes.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/portal/tasks` | partner admin | The partner's tasks with partner-facing state names. |
| GET | `/portal/task-templates` | partner admin | Priced templates for the new-task form, with partner overrides applied and hidden ones removed. |
| POST | `/portal/tasks` | partner admin | Submit a task (title, description, deadline stored as 23:59:59). |
| GET | `/portal/tasks/:id` | partner admin | Task with linked emails and history (partner moves read "You"). |
| PATCH | `/portal/tasks/:id` | partner admin | Edit while not finished, verified or cancelled. |
| POST | `/portal/tasks/:id/cancel` | partner admin | Cancel with an optional note. |
| POST | `/portal/tasks/:id/verify` | partner admin | Approve a finished task. Debits points through the allowance and emits changed for points and dashboards. |
| POST | `/portal/tasks/:id/send-back` | partner admin | Return to in progress with a required comment, also posted to chat. |
| GET | `/portal/tasks/:id/messages` | partner admin | Chat for the task; internal-only messages are filtered out. |
| POST | `/portal/tasks/:id/messages` | partner admin | Post a message; the tasks simulator answers about six seconds later. |
| GET | `/portal/projects` | partner admin | The partner's projects. |
| POST | `/portal/projects` | partner admin | Request a project; staff price it later. |
| GET | `/portal/projects/:id` | partner admin | One project with member tasks. |
| GET | `/portal/documents` | partner admin | Read-only documents with versions. |

## Partner money views and finance reports

Owner: [`handlers/ledger.ts`](./handlers/ledger.ts) — 7 routes.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/portal/account` | partner admin | Licenses and users for the signed-in partner: KPIs, seat table, roster with cost. |
| GET | `/portal/invoices` | partner admin | The partner's non-draft invoices with their display status. |
| GET | `/portal/invoices/:id` | partner admin | One of the partner's invoices, ticket-stub view. |
| POST | `/portal/invoices/:id/dispute` | partner admin | Raise or edit a dispute (reason 3 to 2000 characters). The status does not change; the accountant sees a banner. |
| GET | `/portal/points` | partner admin | This month's allowance meter and a 12-month usage history. |
| GET | `/reports/payments` | accountant | Paid totals by currency and by partner for a year or month. |
| GET | `/reports/unused-allowance` | accountant | Unused free points per partner and their money equivalent. |

