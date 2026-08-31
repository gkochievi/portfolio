export const STATUS_CONFIG = {
  new: { color: 'blue', label: 'New' },
  under_review: { color: 'orange', label: 'Under Review' },
  offer_sent: { color: 'gold', label: 'Offer Sent' },
  approved: { color: 'cyan', label: 'Approved' },
  rejected: { color: 'red', label: 'Rejected' },
  in_progress: { color: 'geekblue', label: 'In Progress' },
  completed: { color: 'green', label: 'Completed' },
  cancelled: { color: 'default', label: 'Cancelled' },
};

export const URGENCY_CONFIG = {
  low: { color: 'default', label: 'Low' },
  normal: { color: 'blue', label: 'Normal' },
  high: { color: 'orange', label: 'High' },
  urgent: { color: 'red', label: 'Urgent' },
};

export const STATUS_OPTIONS = Object.entries(STATUS_CONFIG).map(([value, cfg]) => ({
  value,
  label: cfg.label,
}));

export function getStatusLabel(t, status, { isCustomer = false } = {}) {
  if (isCustomer) {
    // Customer-facing copy reframes internal states into action-oriented language.
    const customerKey = `status.${status}_customer`;
    const translated = t(customerKey);
    if (translated && translated !== customerKey) return translated;
  }
  return t('status.' + status);
}

// Translated option arrays for <Select> filter/dropdown components.
// Call from inside a component that has access to `t` (via useLang()).
export function buildStatusOptions(t, { isCustomer = false } = {}) {
  return Object.keys(STATUS_CONFIG).map((value) => ({
    value,
    label: getStatusLabel(t, value, { isCustomer }) || STATUS_CONFIG[value].label,
  }));
}

export const URGENCY_OPTIONS = Object.entries(URGENCY_CONFIG).map(([value, cfg]) => ({
  value,
  label: cfg.label,
}));

export function buildUrgencyOptions(t) {
  return Object.keys(URGENCY_CONFIG).map((value) => ({
    value,
    label: t('urgency.' + value) || URGENCY_CONFIG[value].label,
  }));
}
