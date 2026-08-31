/**
 * `GET /auth/admin/analytics/` — the whole of `/admin/analytics`.
 *
 * Upstream this is one 340-line `APIView` that fires roughly twenty separate
 * aggregate queries and returns them under twenty-four top-level keys. It is
 * reproduced here in full rather than trimmed to what the charts obviously
 * need, because `AdminAnalyticsPage` guards almost none of it: past
 * `if (!data) return null` it reads `data.comparison.previous_orders`,
 * `data.revenue.total_estimated.toLocaleString()`, `data.by_status.map`,
 * `data.by_urgency.map`, `data.fleet_by_status.map`,
 * `data.fleet_by_category.length` and `data.revenue.daily_trend.length`
 * unguarded. A missing key there is not a blank card, it is a white screen.
 *
 * `weekly_orders`, `users_by_type`, `total_personal_users`,
 * `total_company_users` and `period_days` are the four nobody currently reads.
 * They are still emitted: they cost a loop each, and a payload that silently
 * differs from the one it claims to be is a trap for whoever adds the next
 * chart.
 *
 * Everything is aggregated over the live store at request time, so an order a
 * visitor places, cancels or has priced in the customer app moves the numbers
 * on the next refresh — which is the whole reason the mock aggregates rather
 * than shipping a canned analytics blob.
 *
 * ## Two deliberate divergences
 *
 * **Localised service and category names.** Upstream builds these with
 * `.values(name=F('selected_service__name'))`, and `Service.name` /
 * `TransportCategory.name` are multilingual `JSONField`s — so the real API
 * puts `{en, ka, ru}` dicts into `by_service[].name`, `fleet_by_category[].name`
 * and `revenue.by_service[].name`. `AdminAnalyticsPage` has no localiser and
 * feeds them straight to a Recharts category axis, which stringifies them: the
 * bar labels and the exported CSV both read `[object Object]`. The mock
 * resolves the dict to a plain string in the visitor's own language instead.
 * This is the mock choosing to be readable rather than bug-compatible — it is
 * a divergence from production behaviour, not a port error.
 *
 * **Zero-filled series.** Django emits one row per day that actually had an
 * order, so a quiet Sunday is simply absent and Recharts joins Saturday
 * straight to Monday — a flat segment that reads as "steady" when it means
 * "nothing happened". Every date-bucketed series here is filled across its
 * whole range: `daily_orders`, `new_users_daily`, `revenue.daily_trend`,
 * `weekly_orders` and `monthly_orders`. The visible consequence is that the
 * revenue card, hidden upstream whenever `daily_trend` came back empty, now
 * always renders — as a flat line at zero for a period with no completed work,
 * which is the honest reading of that period.
 */
import { dateKey, shiftDayKey, todayKey } from '../query'
import { register } from '../router'
import { store } from '../store'

/* ------------------------------------------------------------- localisation
 *
 * There is no `Accept-Language` here — the app never sent one, because upstream
 * nothing server-side was localised. The language the visitor picked lives in
 * `localStorage.lang`, written by `LanguageContext`; reading it is not demo
 * state (hard rule 2 covers demo *data*, and this key is the app's own, one of
 * the five that predate the port).
 *
 * A first-time visitor has no such key, and the fallback here used to be a
 * second copy of `LanguageContext`'s default. The two drifted the moment the
 * demo switched to opening in English, and every chart axis came back in
 * Georgian on an otherwise English page. So read the language the app is
 * *actually showing*: `LanguageContext` mirrors it onto `<html lang>` whenever
 * it changes, which makes that attribute the one source both sides already
 * agree on, with no constant to keep in step.
 */
const SUPPORTED = ['en', 'ka', 'ru']
const LAST_RESORT = 'en'

function currentLang() {
  try {
    const saved = window.localStorage.getItem('lang')
    if (SUPPORTED.includes(saved)) return saved
  } catch {
    // A browser with site data blocked throws on the read rather than
    // returning null, and a chart axis is not worth a 500.
  }
  const shown = typeof document !== 'undefined' ? document.documentElement.lang : ''
  return SUPPORTED.includes(shown) ? shown : LAST_RESORT
}

/** `field[lang] || field.en` — the same fallback chain every component uses,
 *  because the seed deliberately leaves a couple of rows English-only. */
function localise(value, lang) {
  if (!value) return ''
  if (typeof value === 'string') return value
  return value[lang] || value.en || Object.values(value).find(Boolean) || ''
}

/* ------------------------------------------------------------------ buckets */

/**
 * Upstream clamps `days` to 3650 but leaves an explicit `date_from`/`date_to`
 * range unbounded, which was harmless when a sparse result meant a decade-wide
 * range still returned a handful of rows. Zero-filling changes that: the same
 * request would build a 46 000-point array and hand it to Recharts. So the same
 * ceiling applies to both branches here.
 */
const MAX_DAYS = 3650

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** `datetime.strptime(s, '%Y-%m-%d').date()`, ValueError included: an
 *  impossible-but-well-formed date such as 2026-02-31 is not a date. */
function parseDate(raw) {
  const match = DATE.exec((raw ?? '').trim())
  if (!match) return null
  const [, year, month, day] = match
  const at = new Date(Number(year), Number(month) - 1, Number(day))
  const real = at.getMonth() === Number(month) - 1 && at.getDate() === Number(day)
  return real ? `${year}-${month}-${day}` : null
}

/** Whole days from `from` to `to`, both `YYYY-MM-DD`. */
function daysBetween(from, to) {
  const utc = (key) => {
    const [year, month, day] = key.split('-').map(Number)
    return Date.UTC(year, month - 1, day)
  }
  return Math.round((utc(to) - utc(from)) / 86_400_000)
}

/** Every day key from `from` to `to` inclusive; `YYYY-MM-DD` sorts as it
 *  compares, so the string comparison is the calendar comparison. */
function dayKeys(from, to) {
  const keys = []
  let cursor = from
  while (cursor <= to && keys.length <= MAX_DAYS) {
    keys.push(cursor)
    cursor = shiftDayKey(cursor, 1)
  }
  return keys
}

/** `TruncWeek` — Django's week starts on Monday regardless of locale. */
function weekStart(key) {
  const [year, month, day] = key.split('-').map(Number)
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return shiftDayKey(key, -((weekday + 6) % 7))
}

/** `TruncMonth` rendered with `strftime('%Y-%m')`. */
function monthKey(key) {
  return key.slice(0, 7)
}

function shiftMonthKey(key, months) {
  const [year, month] = key.split('-').map(Number)
  const total = year * 12 + (month - 1) + months
  return `${String(Math.floor(total / 12)).padStart(4, '0')}-${String((total % 12) + 1).padStart(2, '0')}`
}

/* -------------------------------------------------------------- aggregation */

function round(value, places) {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

/** Django's `_pct`: one decimal place, and 0.0 rather than a division by zero. */
function pct(part, whole) {
  return whole ? round((part / whole) * 100, 1) : 0
}

/**
 * `.values(k).annotate(count=Count('id')).order_by('-count')`.
 *
 * Postgres leaves ties in an aggregate ordering unspecified, so a tie upstream
 * came back in whatever order the hash aggregate happened to emit — stable
 * enough within one process, arbitrary between them. The key is used as a
 * secondary sort here so a pie chart's slice colours do not reshuffle between
 * two refreshes that returned identical counts.
 */
function tally(rows, keyOf) {
  const counts = new Map()
  for (const row of rows) {
    const key = keyOf(row)
    if (key === null || key === undefined) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
}

/* ----------------------------------------------------------------- handler */

register('GET', '/auth/admin/analytics/', (req) => {
  const lang = currentLang()
  const today = todayKey()
  const orders = store.orders
  const users = store.users

  // Either a fixed lookback or an explicit range; the range wins when both are
  // valid, which is the only branch the page itself ever takes — the preset
  // Select and the RangePicker both write `dateRange` and both send
  // `date_from`/`date_to`. The `days` branch is kept because the endpoint's
  // contract has it and a hand-typed URL is a legitimate way to reach it.
  const from = parseDate(req.params.date_from)
  const to = parseDate(req.params.date_to)

  let startDate
  let endDate
  let periodDays

  if (from && to && from <= to) {
    endDate = to
    periodDays = Math.min(daysBetween(from, to) + 1, MAX_DAYS)
    startDate = shiftDayKey(endDate, -(periodDays - 1))
  } else {
    const raw = Number(req.params.days ?? 30)
    // `int('abc')` raised upstream and the view caught it back to 30; a
    // fractional `days` truncates the way `int()` would have refused to, so it
    // is floored rather than accepted.
    periodDays = Number.isFinite(raw) ? Math.max(1, Math.min(Math.floor(raw), MAX_DAYS)) : 30
    endDate = today
    // Deliberately `today - days`, not `today - (days - 1)`: upstream is
    // off by one here (a `days=30` request covers 31 calendar days) and the
    // `period_days` echo the stat cards label themselves with comes from the
    // same variable, so correcting it would put the label and the series out
    // of step with each other.
    startDate = shiftDayKey(endDate, -periodDays)
  }

  const inPeriod = (value) => {
    const key = dateKey(value)
    return key >= startDate && key <= endDate
  }

  const periodOrders = orders.filter((order) => inPeriod(order.created_at))

  /* -- daily / weekly / monthly ------------------------------------------- */

  const dailyBuckets = new Map(
    dayKeys(startDate, endDate).map((key) => [key, { total: 0, completed: 0, cancelled: 0, rejected: 0 }]),
  )
  for (const order of periodOrders) {
    const bucket = dailyBuckets.get(dateKey(order.created_at))
    if (!bucket) continue
    bucket.total += 1
    if (order.status === 'completed') bucket.completed += 1
    if (order.status === 'cancelled') bucket.cancelled += 1
    if (order.status === 'rejected') bucket.rejected += 1
  }
  const dailyOrders = [...dailyBuckets.entries()].map(([date, bucket]) => ({ date, ...bucket }))

  // Twelve weeks back from today, not from the selected period — this series
  // and the monthly one are fixed-window trends that ignore the date picker,
  // exactly as upstream computes them.
  const weeklyFrom = weekStart(shiftDayKey(today, -84))
  const weeklyBuckets = new Map()
  for (let key = weeklyFrom; key <= today; key = shiftDayKey(key, 7)) {
    weeklyBuckets.set(key, { total: 0, completed: 0 })
  }
  for (const order of orders) {
    // Same partial-bucket caveat as the monthly series: the filter is on the
    // day, so the oldest week only counts from `today - 84 days` onwards.
    if (dateKey(order.created_at) < shiftDayKey(today, -84)) continue
    const bucket = weeklyBuckets.get(weekStart(dateKey(order.created_at)))
    if (!bucket) continue
    bucket.total += 1
    if (order.status === 'completed') bucket.completed += 1
  }
  const weeklyOrders = [...weeklyBuckets.entries()].map(([week, bucket]) => ({ week, ...bucket }))

  const monthlyFrom = monthKey(shiftDayKey(today, -365))
  const monthlyBuckets = new Map()
  for (let key = monthlyFrom; key <= monthKey(today); key = shiftMonthKey(key, 1)) {
    monthlyBuckets.set(key, { total: 0, completed: 0 })
  }
  for (const order of orders) {
    // The filter is `created_at__date >= today - 365 days`, so the oldest
    // month in the window is a partial one — its bucket exists but only holds
    // the orders that fall inside the year.
    if (dateKey(order.created_at) < shiftDayKey(today, -365)) continue
    const bucket = monthlyBuckets.get(monthKey(dateKey(order.created_at)))
    if (!bucket) continue
    bucket.total += 1
    if (order.status === 'completed') bucket.completed += 1
  }
  const monthlyOrders = [...monthlyBuckets.entries()].map(([month, bucket]) => ({ month, ...bucket }))

  /* -- pivots ------------------------------------------------------------- */

  const serviceById = new Map(store.services.map((service) => [service.id, service]))
  const categoryById = new Map(store.categories.map((category) => [category.id, category]))

  /**
   * The join upstream is `selected_service__name`, so an order with no
   * selected service drops out of `by_service` entirely (the queryset filters
   * `selected_service__isnull=False`) but survives into `revenue.by_service`,
   * where it would group under a null name and render an unlabelled bar. The
   * seed's cross-table invariant means every order resolves a service, so this
   * falls back to the legacy category and then to an em dash purely so a
   * hand-edited store cannot produce a blank axis tick.
   */
  const serviceLabel = (order) => {
    const service = serviceById.get(order.selected_service_id)
    if (service) return { key: `s${service.id}`, name: localise(service.name, lang), color: service.color }
    const category = categoryById.get(order.selected_category_id)
    if (category) return { key: `c${category.id}`, name: localise(category.name, lang), color: category.color }
    return { key: 'none', name: '—', color: '' }
  }

  const serviceCounts = new Map()
  for (const order of periodOrders) {
    if (!serviceById.has(order.selected_service_id)) continue
    const label = serviceLabel(order)
    const entry = serviceCounts.get(label.key) ?? { name: label.name, color: label.color, count: 0 }
    entry.count += 1
    serviceCounts.set(label.key, entry)
  }
  const byService = [...serviceCounts.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

  // All-time, not the period: the card is titled "orders by status" and the
  // page pairs it with a period-scoped bar chart on purpose.
  const byStatus = tally(orders, (order) => order.status)
    .map(([status, count]) => ({ status, count }))

  const byUrgency = tally(periodOrders, (order) => order.urgency)
    .map(([urgency, count]) => ({ urgency, count }))

  /* -- fleet -------------------------------------------------------------- */

  const fleetByStatus = tally(store.vehicles, (vehicle) => vehicle.status)
    .map(([status, count]) => ({ status, count }))

  // `Count('id', distinct=True)` over the m2m join: a vehicle listed twice
  // under one category counts once, and only active vehicles are counted.
  const categoryCounts = new Map()
  for (const vehicle of store.vehicles) {
    if (!vehicle.is_active) continue
    for (const categoryId of new Set(vehicle.category_ids ?? [])) {
      const category = categoryById.get(categoryId)
      if (!category) continue
      const entry = categoryCounts.get(category.id)
        ?? { name: localise(category.name, lang), color: category.color, count: 0 }
      entry.count += 1
      categoryCounts.set(category.id, entry)
    }
  }
  const fleetByCategory = [...categoryCounts.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

  /* -- revenue ------------------------------------------------------------ */

  // `Order.price` is the integer column the pricing engine rounds up to the
  // next ten, so every sum below is an integer even though the payload types
  // them as floats. Revenue is only ever counted off completed work.
  const completedPriced = orders.filter(
    (order) => order.status === 'completed' && order.price !== null && order.price !== undefined,
  )
  const totalRevenue = completedPriced.reduce((sum, order) => sum + Number(order.price), 0)
  const avgOrderPrice = completedPriced.length ? totalRevenue / completedPriced.length : 0

  const revenueByServiceMap = new Map()
  for (const order of completedPriced) {
    const label = serviceLabel(order)
    const entry = revenueByServiceMap.get(label.key)
      ?? { name: label.name, color: label.color, orders: 0, revenue: 0 }
    entry.orders += 1
    entry.revenue += Number(order.price)
    revenueByServiceMap.set(label.key, entry)
  }
  const revenueByService = [...revenueByServiceMap.values()]
    .sort((a, b) => b.revenue - a.revenue || a.name.localeCompare(b.name))

  const revenueBuckets = new Map(dayKeys(startDate, endDate).map((key) => [key, 0]))
  for (const order of completedPriced) {
    const key = dateKey(order.created_at)
    if (!revenueBuckets.has(key)) continue
    revenueBuckets.set(key, revenueBuckets.get(key) + Number(order.price))
  }
  const dailyTrend = [...revenueBuckets.entries()].map(([date, revenue]) => ({ date, revenue }))

  /* -- comparison and the three headline counters ------------------------- */

  // The preceding window of the same length, ending the day before this one
  // opens — `[start - days, start)`, half-open at the top so the two windows
  // cannot both claim the boundary day.
  const prevStart = shiftDayKey(startDate, -periodDays)
  const previousOrders = orders.filter((order) => {
    const key = dateKey(order.created_at)
    return key >= prevStart && key < startDate
  })

  const todayOrders = orders.filter((order) => dateKey(order.created_at) === today).length
  const weekOpens = weekStart(today)
  const thisWeekOrders = orders.filter((order) => dateKey(order.created_at) >= weekOpens).length
  const thisMonthOrders = orders.filter(
    (order) => monthKey(dateKey(order.created_at)) === monthKey(today),
  ).length

  /* -- users -------------------------------------------------------------- */

  // Unfiltered by role, matching upstream: the admin account is a signup too,
  // and excluding it would make the trend disagree with the user list.
  const newUsersBuckets = new Map(dayKeys(startDate, endDate).map((key) => [key, 0]))
  for (const user of users) {
    const key = dateKey(user.created_at)
    if (!newUsersBuckets.has(key)) continue
    newUsersBuckets.set(key, newUsersBuckets.get(key) + 1)
  }
  const newUsersDaily = [...newUsersBuckets.entries()].map(([date, count]) => ({ date, count }))

  // The three user totals *are* role-scoped — they describe the customer base,
  // so counting staff into "personal users" would be wrong.
  const customers = users.filter((user) => user.role === 'customer')
  const usersByType = tally(customers, (user) => user.user_type)
    .map(([user_type, count]) => ({ user_type, count }))

  const userById = new Map(users.map((user) => [user.id, user]))
  const ordersByUserType = tally(periodOrders, (order) => userById.get(order.user_id)?.user_type)
    .map(([user_type, count]) => ({ user_type, count }))

  /* -- rates and completion time ------------------------------------------ */

  const periodTotal = periodOrders.length
  const countStatus = (status) => periodOrders.filter((order) => order.status === status).length

  /**
   * Average time from placement to the `completed` transition, in hours.
   *
   * Measured off `orderStatusHistory` rather than the order row, because the
   * order carries no completion timestamp — and the aggregate is over *history
   * rows*, not orders, so an order walked into `completed` twice contributes
   * twice. The window is on the order's `created_at`, not the transition's, so
   * a job placed inside the period and finished after it still counts.
   */
  let durationSum = 0
  let durationCount = 0
  for (const entry of store.orderStatusHistory) {
    if (entry.new_status !== 'completed') continue
    const order = orders.find((row) => row.id === entry.order_id)
    if (!order || !inPeriod(order.created_at)) continue
    durationSum += Date.parse(entry.created_at) - Date.parse(order.created_at)
    durationCount += 1
  }
  const avgCompletionHours = durationCount ? round(durationSum / durationCount / 3_600_000, 1) : 0

  /* -- top customers ------------------------------------------------------ */

  const customerRows = new Map()
  for (const order of periodOrders) {
    const user = userById.get(order.user_id)
    if (!user) continue
    const entry = customerRows.get(user.id) ?? {
      user_id: user.id,
      name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
      email: user.email,
      user_type: user.user_type,
      orders: 0,
      completed: 0,
      revenue: 0,
    }
    entry.orders += 1
    if (order.status === 'completed') {
      entry.completed += 1
      if (order.price !== null && order.price !== undefined) entry.revenue += Number(order.price)
    }
    customerRows.set(user.id, entry)
  }
  // `order_by('-orders')[:10]`, with the user id breaking ties so the table
  // does not reorder itself between two refreshes of the same data — the
  // Table's `rowKey` is `user_id`, so an unstable order re-keys every row.
  const topCustomers = [...customerRows.values()]
    .sort((a, b) => b.orders - a.orders || a.user_id - b.user_id)
    .slice(0, 10)

  return {
    period_days: periodDays,
    date_from: startDate,
    date_to: endDate,
    today_orders: todayOrders,
    this_week_orders: thisWeekOrders,
    this_month_orders: thisMonthOrders,
    daily_orders: dailyOrders,
    weekly_orders: weeklyOrders,
    monthly_orders: monthlyOrders,
    by_service: byService,
    by_status: byStatus,
    by_urgency: byUrgency,
    fleet_by_status: fleetByStatus,
    fleet_by_category: fleetByCategory,
    revenue: {
      total_estimated: totalRevenue,
      avg_order_price: round(avgOrderPrice, 2),
      by_service: revenueByService,
      daily_trend: dailyTrend,
    },
    comparison: {
      current_orders: periodOrders.length,
      previous_orders: previousOrders.length,
      current_completed: countStatus('completed'),
      previous_completed: previousOrders.filter((order) => order.status === 'completed').length,
    },
    new_users_daily: newUsersDaily,
    users_by_type: usersByType,
    total_personal_users: customers.filter((user) => user.user_type === 'personal').length,
    total_company_users: customers.filter((user) => user.user_type === 'company').length,
    orders_by_user_type: ordersByUserType,
    rates: {
      completion: pct(countStatus('completed'), periodTotal),
      cancellation: pct(countStatus('cancelled'), periodTotal),
      rejection: pct(countStatus('rejected'), periodTotal),
    },
    avg_completion_hours: avgCompletionHours,
    top_customers: topCustomers,
  }
}, { auth: 'admin' })
