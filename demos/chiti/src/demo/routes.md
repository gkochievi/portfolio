# Chiti demo — registered routes

149 routes, registered with `api.register(method, pattern, handler)` in `src/demo/handlers/*.ts`
and answered by `createMockApi({ prefix: '/api' })` (`src/demo/api.ts`). Patterns are written here
**with** the `/api` prefix the UI sees; the handlers register them without it.

- **Public** routes work signed out: `/api/widget/*`, `/api/auth/login`, `/api/demo/*`
  (`PUBLIC_PREFIXES`). Everything else answers `401` without a session.
- **Auth** names who may call. A role outside the list gets `403` (`requireRole`); a record of
  another tenant gets `404`. "Owner" means the operator the chat is assigned to.
- Failures are `DemoApiError`s: `400` with field errors, `401`, `403`, `404`, `409`.
- Writes go through `src/demo/engine.ts` where they touch chat state, broadcast the matching bus
  event with the full entity, and write the activity row the original wrote.
- Realtime is not a route: the original's socket events are the typed bus in `src/demo/bus.ts`.

## Auth — `handlers/auth.ts`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/login` | public | Email or username plus password against the account list; refuses accounts of disabled or deleted tenants; marks an offline operator online; logs the login. |
| POST | `/api/auth/logout` | any | Takes an operator offline (their chats return to the queue after the grace), logs it, signs out. |
| GET | `/api/auth/me` | any | The account with its tenant, settings, working-hours status and operator record. |

## Core and demo controls — `handlers/core.ts`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| PATCH | `/api/operator/status` | operator | Go `online` or `away`. |
| GET | `/api/tenant/settings` | operator, admin, supervisor | The tenant's settings and its enabled custom fields. |
| GET | `/api/demo/controls` | public | The demo chrome state (`DemoControls`). |
| PATCH | `/api/demo/controls` | public | Fast inactivity, simulated client IP, spawner on/off, TikTok connect result, AI outage (`aiOutageSeconds`). |

## Customer widget — `handlers/widget.ts`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/widget/:slug/config` | public | Tenant bootstrap: title, theme, position, FAQ tree, pre-chat fields, working-hours status; `tenant-disabled` and `not-found` for those tenants. |
| POST | `/api/widget/:slug/login` | public | Start a chat: validates required fields, checks hours and bans (`OFFLINE`, `CLIENT_BANNED`, `MISSING_FIELDS`, `TENANT_DISABLED`), creates the customer and session, bot-first when allowed. |
| GET | `/api/widget/sessions/:sessionId` | public | Current session, its messages and AI state (restores the widget after navigation). |
| POST | `/api/widget/sessions/:sessionId/messages` | public | Send text, image, file or location; unsupported content hands off to a person. |
| POST | `/api/widget/sessions/:sessionId/typing` | public | Typing start/stop, with the draft when typing transparency is on. |
| POST | `/api/widget/sessions/:sessionId/seen` | public | Mark staff messages read. |
| POST | `/api/widget/sessions/:sessionId/request-human` | public | "Talk to a human": hands the bot chat off with a briefing. |
| POST | `/api/widget/sessions/:sessionId/acknowledge-warning` | public | Dismiss the inactivity warning and reset the ladder. |
| POST | `/api/widget/sessions/:sessionId/end` | public | The customer ends the chat. |
| POST | `/api/widget/sessions/:sessionId/feedback` | public | 1–5 stars and a comment. |
| PATCH | `/api/demo/widget-controls` | public | Storefront panel: widget side, client theme, bot on/off, hours mode (`auto`, `open`, `closed`, `temporary`). |

## Operator inbox — `handlers/inbox.ts`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/operator/inbox` | operator, admin, supervisor | The queue, the operator's chats, per-channel counts and live wait times. |
| GET | `/api/sessions/:id` | operator (own, waiting or ended), admin, supervisor | One session in detail, with its channel window state. |
| GET | `/api/sessions/:id/messages` | same | A page of messages (`before`, `limit`); generates a summary transcript on first read. |
| POST | `/api/sessions/:id/claim` | operator | Take a waiting chat; refused while away, or if the chat was returned from this operator. |
| POST | `/api/sessions/:id/messages` | operator (owner) | Reply; checked against the channel's reply window, message cap and media support. |
| POST | `/api/sessions/:id/typing` | operator (owner) | Typing indicator towards the customer. |
| POST | `/api/sessions/:id/seen` | operator (owner) | Mark customer messages read. |
| POST | `/api/sessions/:id/finish` | operator (owner) | End the chat. |
| POST | `/api/sessions/:id/messages/:messageId/retry` | operator (owner) | Resend a failed staff message. |
| POST | `/api/sessions/:id/messages/:messageId/reaction` | operator (owner) | React with an emoji, where the channel allows it; same emoji again removes it. |
| POST | `/api/demo/sessions/:id/simulate-timeout` | operator (owner) | Debug: make the response timeout fire now and return the chat to the queue. |

## Operator tools — `handlers/operator-tools.ts`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/sessions/:id/context` | operator, admin, supervisor | Customer fields, previous chats (grouped by the `groupBy` field) and the hand-over briefing. |
| GET | `/api/sessions/:id/notes` | operator, admin, supervisor | Internal notes on a chat. |
| POST | `/api/sessions/:id/notes` | operator, admin | Add a note. |
| DELETE | `/api/sessions/:id/notes/:noteId` | operator, admin | Delete a note. |
| GET | `/api/quick-replies` | operator, admin, supervisor | Enabled quick replies, by category, in the customer's language. |
| GET | `/api/whatsapp/templates` | operator, admin | The synced WhatsApp templates with their sendability. |
| POST | `/api/whatsapp/templates/sync` | operator, admin | Re-sync after a short delay; refreshes `syncedAt`. |
| POST | `/api/sessions/:id/template` | operator | Send a template into a chat whose window is closed; fills the slots. |
| GET | `/api/sessions/:id/copilot` | operator, admin, supervisor | The latest copilot draft, and whether the AI is in an outage. |
| POST | `/api/sessions/:id/copilot/regenerate` | operator (owner) | A new draft for the last customer message. |
| POST | `/api/sessions/:id/copilot/transform` | operator (owner) | Shorter, warmer, formal, or to Russian / Georgian / English. |
| POST | `/api/copilot/feedback` | operator | Record shown / inserted / edited / sent as-is. |
| GET | `/api/operator/history` | operator, admin, supervisor | The history side panel: a searchable list of past chats. |

## Team chat and profile — `handlers/team.ts`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/team/roster` | operator, admin, supervisor | Colleagues with presence and a direct-message preview. |
| GET | `/api/team/conversations` | operator, admin, supervisor | The caller's conversations, unread counts, newest first. |
| POST | `/api/team/conversations/direct` | operator, admin, supervisor | Open (or reuse) a direct conversation. |
| GET | `/api/team/conversations/:id/messages` | operator, admin, supervisor | A conversation's messages. |
| POST | `/api/team/conversations/:id/messages` | operator, admin, supervisor | Send; reconciles on the client's optimistic id. |
| POST | `/api/team/conversations/:id/read` | operator, admin, supervisor | Mark read. |
| POST | `/api/team/conversations/:id/typing` | operator, admin | Typing indicator. |
| GET | `/api/operator/profile` | operator, admin with a linked operator | The operator profile and its tenant. |
| PATCH | `/api/operator/profile` | same | Nickname, avatar, language, push preference, with field errors. |
| GET | `/api/operator/profile/stats` | same | Handled chats, ratings, response times and end categories over a date range (at most a capped span). |
| GET | `/api/operator/profile/chats` | same | Paged, searchable list of the chats the operator handled. |

## Admin: live — `handlers/admin-live.ts`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/admin/dashboard` | admin, supervisor | Live counters, queue, operators and recent activity. |
| GET | `/api/admin/sessions` | admin, supervisor | Live and waiting chats for spectating. |
| POST | `/api/admin/sessions/:id/intervention` | admin | Start or stop an intervention in an operator's chat. |
| POST | `/api/admin/sessions/:id/messages` | admin | Write into a chat during an intervention (`sentByAdmin`). |
| POST | `/api/admin/sessions/:id/end` | admin | End a chat from the admin side. |
| POST | `/api/admin/queue/clear` | admin | End every waiting chat (`queue_cleared`). |

## Admin: history, statistics, activity — `handlers/admin-insights.ts`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/admin/history/filters` | admin, supervisor | Operators, channels and end categories for the filter bar. |
| GET | `/api/admin/history` | admin, supervisor | Paged, filtered, searchable history of ended chats. |
| GET | `/api/admin/history/:id` | admin, supervisor, operator | One ended chat with its transcript and hand-over chain. |
| GET | `/api/admin/statistics/sessions` | admin, supervisor | The session summaries a date range's charts and CSV are built from. |
| POST | `/api/admin/statistics/export-log` | admin | Logs `admin_download_report` when the CSV is exported. |
| GET | `/api/admin/activity` | admin | Paged activity log for one section, filtered by actor role, keyword and date range. |

## Admin: staff — `handlers/admin-staff.ts`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/admin/operators` | admin, supervisor | Operators with presence and load; `q` searches name, nickname, email, number. |
| POST | `/api/admin/operators` | admin | Create an operator (and its sign-in account); audit row. |
| PATCH | `/api/admin/operators/:id` | admin | Edit; the audit row records each field's before and after. |
| DELETE | `/api/admin/operators/:id` | admin | Remove; refused for yourself and for the headline demo accounts. |
| POST | `/api/admin/operators/:id/force-status` | admin, supervisor | Force an operator `away` or `online`. |
| POST | `/api/admin/operators/:id/force-logout` | admin, supervisor | Force an operator offline. |
| POST | `/api/admin/operators/:id/end-chats` | admin | End all of an operator's chats. |
| GET | `/api/admin/operators/:id/audit` | admin | The operator's audit trail. |
| GET | `/api/admin/admins` | admin | Admins of the tenant (`q` search). |
| POST | `/api/admin/admins` | admin | Create an admin; optionally with a linked operator profile. |
| PATCH | `/api/admin/admins/:id` | admin | Edit an admin. |
| DELETE | `/api/admin/admins/:id` | admin | Delete an admin; refused for yourself and for the headline demo accounts. |
| GET | `/api/admin/supervisors` | admin | Supervisors of the tenant. |
| POST | `/api/admin/supervisors` | admin | Create a supervisor. |
| PATCH | `/api/admin/supervisors/:id` | admin | Edit a supervisor. |
| DELETE | `/api/admin/supervisors/:id` | admin | Delete a supervisor. |

## Admin: settings — `handlers/admin-settings.ts`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/admin/settings` | admin | The tenant's settings. |
| PATCH | `/api/admin/settings` | admin | Identity, themes, routing, timers, toggles, messages, retention; broadcasts `settings:update`, so the widget changes live. |
| POST | `/api/admin/verify-password` | admin | Check the admin's password before a destructive action. |
| POST | `/api/admin/purge` | admin | Purge chats in a date range after a password check; returns removed session, message and file counts. |
| GET | `/api/admin/working-hours` | admin | Weekly schedule, closure, messages. |
| PUT | `/api/admin/working-hours` | admin | Save; the widget flips to or from out-of-hours live. |
| GET | `/api/admin/custom-fields` | admin | Pre-chat custom fields. |
| POST | `/api/admin/custom-fields` | admin | Create a field. |
| PATCH | `/api/admin/custom-fields/:id` | admin | Edit, enable or disable. |
| DELETE | `/api/admin/custom-fields/:id` | admin | Delete. |
| GET | `/api/admin/quick-replies` | admin | All quick replies, grouped by category. |
| POST | `/api/admin/quick-replies` | admin | Create. |
| PATCH | `/api/admin/quick-replies/:id` | admin | Edit. |
| POST | `/api/admin/quick-replies/:id/move` | admin | Move up or down within its category. |
| DELETE | `/api/admin/quick-replies/:id` | admin | Delete. |
| GET | `/api/admin/bans` | admin | Ban rules. |
| POST | `/api/admin/bans` | admin | Ban an IP, or a custom-field value, with a reason. |
| DELETE | `/api/admin/bans/:id` | admin | Lift a ban. |

## Admin: FAQ, channels, comments, AI link — `handlers/admin-integrations.ts`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/admin/faq` | admin | The FAQ tree and its two toggles. |
| PUT | `/api/admin/faq` | admin | Validate (one root, reachable, options need a target or a transfer) and save; the widget uses it at once. |
| GET | `/api/admin/integrations` | admin | Messenger, Instagram, WhatsApp, Telegram and TikTok state for the tenant. |
| PUT | `/api/admin/integrations/meta/:channel` | admin | Save manual Meta credentials (masked on read). |
| POST | `/api/admin/integrations/meta/:channel/connect` | admin | The fake authorize flow; resolves after 1.5 s. |
| POST | `/api/admin/integrations/meta/:channel/test` | admin | Canned test; `invalid_credentials` when the token contains `bad`. |
| DELETE | `/api/admin/integrations/meta/:channel` | admin | Remove the connection. |
| POST | `/api/admin/integrations/telegram/connect` | admin | Paste a bot token; state becomes `awaiting_business_connection`. |
| GET | `/api/admin/integrations/telegram` | admin | Poll the state; the simulator completes it about ten seconds later. |
| POST | `/api/admin/integrations/telegram/test` | admin | Canned test. |
| DELETE | `/api/admin/integrations/telegram` | admin | Disconnect. |
| POST | `/api/admin/integrations/tiktok/connect` | admin | Start the popup flow; resolves to the state in `demo.tiktokConnectResult`. |
| POST | `/api/admin/integrations/tiktok/check` | admin | Re-check the connection. |
| POST | `/api/admin/integrations/tiktok/test` | admin | Canned test. |
| DELETE | `/api/admin/integrations/tiktok` | admin | Disconnect. |
| GET | `/api/admin/comments` | admin | Public page comments, filterable. |
| POST | `/api/admin/comments/:id/reply` | admin | Reply to a comment. |
| POST | `/api/admin/comments/:id/hide` | admin | Hide or unhide. |
| DELETE | `/api/admin/comments/:id` | admin | Delete a comment. |
| GET | `/api/admin/ai-link` | admin | Connection state, circuit breaker, bot pause. |
| PUT | `/api/admin/ai-link` | admin | Bot and autopilot toggles. |
| POST | `/api/admin/ai-link/test` | admin | Canned connection test; fails while the demo AI outage is on. |

## Super admin — `handlers/superadmin.ts`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/superadmin/overview` | superadmin | Platform KPIs. |
| GET | `/api/superadmin/tenants` | superadmin | Tenant table with state and counts; search and state filter. |
| POST | `/api/superadmin/tenants` | superadmin | Create a tenant (slug = name plus a short code) with default settings, hours, integrations and AI link rows. |
| PATCH | `/api/superadmin/tenants/:id` | superadmin | Rename, allowed origins. |
| POST | `/api/superadmin/tenants/:id/disable` | superadmin | `active` → `disabled`. |
| POST | `/api/superadmin/tenants/:id/enable` | superadmin | `disabled` → `active`. |
| POST | `/api/superadmin/tenants/:id/delete` | superadmin | Soft delete. |
| POST | `/api/superadmin/tenants/:id/restore` | superadmin | Undo a soft delete. |
| POST | `/api/superadmin/tenants/:id/erase` | superadmin | Erase a deleted tenant's rows, after a password check. |
| GET | `/api/superadmin/tenants/:id/members` | superadmin | Operators, admins and supervisors of a tenant. |
| POST | `/api/superadmin/tenants/:id/members` | superadmin | Create a member of any role. |
| PATCH | `/api/superadmin/members/:role/:id` | superadmin | Edit a member. |
| DELETE | `/api/superadmin/members/:role/:id` | superadmin | Delete a member. |
| PATCH | `/api/superadmin/tenants/:id/features` | superadmin | Toggle the tenant's channels. |
| GET | `/api/superadmin/tenants/:id/staff-chats` | superadmin | Audit view: a tenant's staff conversations. |
| GET | `/api/superadmin/staff-chats/:conversationId/messages` | superadmin | Their messages. |
| POST | `/api/superadmin/impersonate` | superadmin | "Log in as": validates the member and tenant state and returns the account to sign in as; the client then switches session and remembers the way back. |
| GET | `/api/superadmin/platform` | superadmin | Platform integration settings, masked. |
| PUT | `/api/superadmin/platform/meta` | superadmin | Save the Meta app settings. |
| PUT | `/api/superadmin/platform/tiktok` | superadmin | Save the TikTok app settings. |
| POST | `/api/superadmin/platform/test` | superadmin | Canned credential test. |
| POST | `/api/superadmin/platform/tiktok/register-webhook` | superadmin | Mark the webhook registered. |
| GET | `/api/superadmin/health` | superadmin | System-health samples for a range, catching the live feed up first. |
| PATCH | `/api/superadmin/health/retention` | superadmin | Sample retention in months. |
| GET | `/api/superadmin/ai-key` | superadmin | The AI platform key, masked, and its source. |
| PUT | `/api/superadmin/ai-key` | superadmin | Save a key. |
| POST | `/api/superadmin/ai-key/test` | superadmin | Canned check list (`health`, `config`, `autopilot`, `languages`, `scopes`); all fail with no key. |
| DELETE | `/api/superadmin/ai-key` | superadmin | Remove the key. |

## Totals

| File | Routes |
|---|---|
| `handlers/auth.ts` | 3 |
| `handlers/core.ts` | 4 |
| `handlers/widget.ts` | 11 |
| `handlers/inbox.ts` | 11 |
| `handlers/operator-tools.ts` | 13 |
| `handlers/team.ts` | 11 |
| `handlers/admin-live.ts` | 6 |
| `handlers/admin-insights.ts` | 6 |
| `handlers/admin-staff.ts` | 16 |
| `handlers/admin-settings.ts` | 18 |
| `handlers/admin-integrations.ts` | 22 |
| `handlers/superadmin.ts` | 28 |
| **Total** | **149** |
