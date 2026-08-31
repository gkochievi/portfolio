import React, { useMemo, useState } from 'react';
import { Badge, Dropdown, Empty, Tooltip } from 'antd';
import {
  BellOutlined, BellFilled, SoundOutlined, SoundFilled, CheckOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../contexts/NotificationContext';
import { useLang } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { StatusBadge } from './StatusBadge';

function formatRelative(iso, t) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.max(1, Math.round(diff / 1000));
  if (sec < 60) return t('notifications.justNow');
  const min = Math.round(sec / 60);
  if (min < 60) return t('notifications.minutesAgo', { count: min });
  const hr = Math.round(min / 60);
  if (hr < 24) return t('notifications.hoursAgo', { count: hr });
  const days = Math.round(hr / 24);
  return t('notifications.daysAgo', { count: days });
}

function eventLabel(order, t) {
  const evt = order.last_event_type || '';
  if (evt === 'created') return t('notifications.eventCreated');
  if (evt === 'cancelled') return t('notifications.eventCancelled');
  if (evt === 'images_added') return t('notifications.eventImages');
  if (evt === 'updated') return t('notifications.eventUpdated');
  if (evt.startsWith('status:')) {
    const s = evt.slice('status:'.length);
    return t('notifications.eventStatus', { status: t('status.' + s) });
  }
  return t('notifications.eventUpdate');
}

export default function NotificationsBell({ variant = 'admin' }) {
  const { unreadCount, recent, muted, toggleMute, markAllRead, refresh } = useNotifications();
  const { t, lang } = useLang();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const count = Math.max(0, unreadCount || 0);
  const listPath = isAdmin ? '/admin/orders' : '/app/orders';
  const detailPath = (id) => (isAdmin ? `/admin/orders/${id}` : `/app/orders/${id}`);

  const localized = (v) => {
    if (!v) return '';
    if (typeof v === 'string') return v;
    return v[lang] || v.en || '';
  };

  const items = useMemo(() => {
    if (!recent || recent.length === 0) {
      return [
        {
          key: 'empty',
          label: (
            <div style={{ padding: '18px 4px' }}>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>
                    {t('notifications.noUnread')}
                  </span>
                }
              />
            </div>
          ),
          disabled: true,
        },
      ];
    }

    return recent.slice(0, 10).map((order) => ({
      key: `order-${order.id}`,
      onClick: () => {
        setOpen(false);
        navigate(detailPath(order.id));
      },
      label: (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          padding: '6px 2px', maxWidth: 340,
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: 'var(--accent)',
            marginTop: 8, flexShrink: 0,
          }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{ color: 'var(--accent)' }}>#{order.id}</span>
              <span style={{ opacity: 0.5 }}>·</span>
              <span style={{
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                maxWidth: 'calc(100% - 60px)', minWidth: 0,
              }}>{order.pickup_location}</span>
            </div>
            <div style={{
              fontSize: 12, color: 'var(--text-secondary)', marginTop: 2,
              display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
            }}>
              <StatusBadge status={order.status} />
              <span style={{ color: 'var(--text-tertiary)' }}>
                {eventLabel(order, t)}
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
              {formatRelative(order.last_event_at, t)}
              {order.selected_category_name && (
                <> · {localized(order.selected_category_name)}</>
              )}
            </div>
          </div>
        </div>
      ),
    }));
  }, [recent, t, lang, isAdmin, navigate]);

  const menuItems = [
    {
      key: 'header',
      disabled: true,
      label: (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '2px 0 6px', minWidth: 280,
        }}>
          <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14 }}>
            {t('notifications.title')}
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <Tooltip title={muted ? t('notifications.unmute') : t('notifications.mute')}>
              <span
                onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                style={{
                  cursor: 'pointer',
                  padding: '4px 8px', borderRadius: 8,
                  color: muted ? 'var(--text-tertiary)' : 'var(--accent)',
                  fontSize: 13,
                }}
              >
                {muted ? <SoundOutlined /> : <SoundFilled />}
              </span>
            </Tooltip>
            {count > 0 && (
              <Tooltip title={t('notifications.markAllRead')}>
                <span
                  onClick={(e) => { e.stopPropagation(); markAllRead(); }}
                  style={{
                    cursor: 'pointer',
                    padding: '4px 8px', borderRadius: 8,
                    color: 'var(--accent)', fontSize: 13,
                  }}
                >
                  <CheckOutlined />
                </span>
              </Tooltip>
            )}
          </div>
        </div>
      ),
    },
    { type: 'divider' },
    ...items,
    { type: 'divider' },
    {
      key: 'view-all',
      onClick: () => { setOpen(false); navigate(listPath); },
      label: (
        <div style={{
          textAlign: 'center', padding: '4px 0',
          color: 'var(--accent)', fontWeight: 600, fontSize: 13,
        }}>
          {t('notifications.viewAll')}
        </div>
      ),
    },
  ];

  return (
    <Dropdown
      menu={{ items: menuItems }}
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) refresh();
      }}
      trigger={['click']}
      placement="bottomRight"
      overlayStyle={{ minWidth: 320 }}
    >
      <div
        style={{
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: 10,
          color: count > 0 ? 'var(--accent)' : 'var(--text-secondary)',
          fontSize: 17, position: 'relative',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        title={t('notifications.title')}
      >
        <Badge
          count={count}
          overflowCount={99}
          offset={[2, -2]}
          size="small"
          styles={{ indicator: { boxShadow: '0 0 0 2px var(--bg-primary)' } }}
        >
          {count > 0 ? <BellFilled /> : <BellOutlined />}
        </Badge>
      </div>
    </Dropdown>
  );
}
