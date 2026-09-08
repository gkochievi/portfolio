/** There is no backend, so contact is a mailto and nothing else pretends otherwise. */
export const EMAIL = 'tech@boulde.ge'

export const MAILTO = `mailto:${EMAIL}?subject=${encodeURIComponent('Project enquiry')}`

export const LOCATION = 'Tbilisi, Georgia'

export const COMPANY = 'Boulder'

/** Mirrors the `<title>` in index.html. */
export const SITE_TITLE = `${COMPANY} — work you can click through`

export const NOT_FOUND_TITLE = `Not found — ${COMPANY}`

/** The detail route's tab name. Here rather than inline so no copy lives in a page. */
export const projectTitle = (name: string) => `${name} — ${COMPANY}`

/** The one line under the wordmark. Kept here so the header and the document
 *  description cannot drift apart. */
export const TAGLINE = 'Operational software for businesses that run on hardware.'
