// Maps backend RegisterSerializer errors to localized field-level
// messages so the register form can highlight the offending input (via
// form.setFields) AND surface a clear toast at the same time.
//
// Backend shape (DRF ValidationError on a serializer):
//   { email: ['Email already registered.'], phone_number: [...], ... }
//
// We detect the well-known field keys and pick a localized message. Any
// field we don't recognize falls through to the raw English string the
// backend returned, so server-side hardening can still surface to the UI
// without a frontend change.

const FIELD_LOCALIZATION = {
  email: {
    'already registered': 'auth.emailTaken',
  },
  personal_id: {
    'already registered': 'auth.personalIdTaken',
    'must be exactly': 'auth.personalIdInvalid',
  },
  phone_number: {
    'already registered': 'auth.phoneTaken',
  },
  company_id: {
    'already registered': 'auth.companyIdTaken',
    'must be exactly': 'auth.personalIdInvalid',
  },
};

function pickKey(field, message) {
  const map = FIELD_LOCALIZATION[field];
  if (!map) return null;
  const lower = (message || '').toLowerCase();
  for (const fragment of Object.keys(map)) {
    if (lower.includes(fragment)) return map[fragment];
  }
  return null;
}

export function mapRegisterErrors(data, t) {
  if (!data || typeof data !== 'object') return { fieldErrors: [], firstMessage: null };

  const fieldErrors = [];
  let firstMessage = null;

  for (const [field, raw] of Object.entries(data)) {
    const messages = Array.isArray(raw) ? raw : [raw];
    for (const msg of messages) {
      const text = typeof msg === 'string' ? msg : String(msg ?? '');
      if (!text) continue;
      const key = pickKey(field, text);
      const localized = key ? t(key) : text;
      fieldErrors.push({ name: field, errors: [localized] });
      if (firstMessage == null) firstMessage = localized;
    }
  }

  return { fieldErrors, firstMessage };
}
