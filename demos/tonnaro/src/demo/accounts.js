/**
 * The two accounts the demo advertises.
 *
 * Nobody can guess credentials that live in a seed file, so the demo banner
 * names them and signs you in with one click. Every other user in the seed
 * exists as data — they own orders, they appear in the admin list — but none
 * of them is reachable, which is the same arrangement the real product has.
 *
 * Kept here rather than inline in the banner so the seed and the chrome cannot
 * drift apart: `demo/seed/users.json` must contain exactly these two rows.
 */

export const DEMO_PASSWORD = 'tonnaro-demo'

export const DEMO_ADMIN = {
  email: 'admin@tonnaro.ge',
  password: DEMO_PASSWORD,
  home: '/admin',
}

export const DEMO_CUSTOMER = {
  email: 'demo@tonnaro.ge',
  password: DEMO_PASSWORD,
  home: '/app',
}
