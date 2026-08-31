import React from 'react';
import { Tag } from 'antd';
import { STATUS_CONFIG, URGENCY_CONFIG, getStatusLabel } from '../../utils/status';
import { useLang } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';

// Long Georgian/Russian status labels (e.g. "დასრულებული", "На рассмотрении")
// can blow out narrow table cells. Cap the visible tag width and ellipsize
// so the surrounding row keeps its layout; full label remains in the title.
const TAG_STYLE = {
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  verticalAlign: 'middle',
};

export function StatusBadge({ status, label }) {
  const { t } = useLang();
  const { isCustomer } = useAuth();
  const cfg = STATUS_CONFIG[status] || { color: 'default', label: status };
  const text = label || getStatusLabel(t, status, { isCustomer }) || cfg.label;
  return <Tag color={cfg.color} style={TAG_STYLE} title={text}>{text}</Tag>;
}

export function UrgencyBadge({ urgency, label }) {
  const { t } = useLang();
  const cfg = URGENCY_CONFIG[urgency] || { color: 'default', label: urgency };
  const text = label || t('urgency.' + urgency) || cfg.label;
  return <Tag color={cfg.color} style={TAG_STYLE} title={text}>{text}</Tag>;
}
