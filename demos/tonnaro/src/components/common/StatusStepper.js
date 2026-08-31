import React from 'react';
import { CheckCircleOutlined } from '@ant-design/icons';
import { useLang } from '../../contexts/LanguageContext';
import { getStatusLabel } from '../../utils/status';

// Single source of truth for the customer/admin progression UI. Hex
// values intentionally diverge from STATUS_CONFIG (which uses AntD preset
// names like "blue"/"gold") because the stepper paints the connector line
// in the same color as the badge dot — preset names don't translate to
// usable CSS.
export const STATUS_BADGE_COLORS = {
  new: '#00B856',
  under_review: '#f59e0b',
  offer_sent: '#d97706',
  approved: '#06b6d4',
  in_progress: '#3b82f6',
  completed: '#10b981',
  rejected: '#ef4444',
  cancelled: '#8e93ab',
};

export const STATUS_STEPS = ['new', 'under_review', 'offer_sent', 'approved', 'in_progress', 'completed'];

/**
 * Horizontal status progression with animated circles, color-coded
 * connectors, and a glow ring on the current step.
 *
 * Props:
 *   status        — current order status (one of STATUS_STEPS or terminal)
 *   isCustomer    — when true, labels use the customer-facing copy
 *                   ("Awaiting your approval") instead of the admin one
 *                   ("Offer Sent").
 *   compact       — smaller circles + tighter labels for header placement.
 */
export default function StatusStepper({ status, isCustomer = false, compact = false }) {
  const { t } = useLang();
  const statusIdx = STATUS_STEPS.indexOf(status);
  const CIRCLE = compact ? 20 : 26;
  const HALF = CIRCLE / 2;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      paddingTop: 4,
      width: '100%',
    }}>
      {STATUS_STEPS.map((s, i) => {
        const done = i <= statusIdx;
        const isCurrent = i === statusIdx;
        const stepColor = done ? (STATUS_BADGE_COLORS[s] || 'var(--accent)') : 'var(--border-color)';
        const leftLineColor = i > 0
          ? (i <= statusIdx ? (STATUS_BADGE_COLORS[s] || 'var(--accent)') : 'var(--bg-tertiary)')
          : null;
        const rightLineColor = i < STATUS_STEPS.length - 1
          ? (i < statusIdx ? (STATUS_BADGE_COLORS[STATUS_STEPS[i + 1]] || 'var(--accent)') : 'var(--bg-tertiary)')
          : null;
        return (
          <div key={s} style={{
            flex: 1, minWidth: 0, position: 'relative',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '0 4px',
          }}>
            {leftLineColor && (
              <div style={{
                position: 'absolute',
                top: HALF - 1.5, left: 0, right: '50%',
                height: compact ? 2 : 3, background: leftLineColor,
                transition: 'background 0.35s ease',
                zIndex: 0,
              }} />
            )}
            {rightLineColor && (
              <div style={{
                position: 'absolute',
                top: HALF - 1.5, left: '50%', right: 0,
                height: compact ? 2 : 3, background: rightLineColor,
                transition: 'background 0.35s ease',
                zIndex: 0,
              }} />
            )}
            <div style={{
              width: CIRCLE, height: CIRCLE, borderRadius: '50%',
              background: done ? stepColor : 'var(--bg-tertiary)',
              border: done ? 'none' : '2px solid var(--border-color)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: isCurrent ? `0 0 0 5px ${stepColor}22` : 'none',
              transition: 'all 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
              position: 'relative', zIndex: 1,
              flexShrink: 0,
            }}>
              {done && <CheckCircleOutlined style={{ color: '#fff', fontSize: compact ? 11 : 13 }} />}
            </div>
            <div style={{
              fontSize: compact ? 9 : 10, marginTop: compact ? 6 : 10, textAlign: 'center',
              fontWeight: isCurrent ? 700 : done ? 500 : 400,
              color: isCurrent ? stepColor : done ? 'var(--text-primary)' : 'var(--text-placeholder)',
              lineHeight: 1.25,
              wordBreak: 'break-word',
              hyphens: 'auto',
              width: '100%',
            }}>
              {getStatusLabel(t, s, { isCustomer })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
