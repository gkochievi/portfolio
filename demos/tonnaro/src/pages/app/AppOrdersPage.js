import React, { useCallback, useEffect, useState } from 'react';
import { Spin, Empty, Grid } from 'antd';
import {
  RightOutlined, ClockCircleOutlined,
  CheckCircleOutlined, FileTextOutlined, PlusOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { useLang } from '../../contexts/LanguageContext';
import { useRealtimeRefresh } from '../../contexts/NotificationContext';
import { STATUS_CONFIG, URGENCY_CONFIG, getStatusLabel } from '../../utils/status';
import { CategoryImage } from '../../utils/categoryIcons';

const { useBreakpoint } = Grid;

const STATUS_BADGE_COLORS = {
  new: '#00B856',
  under_review: '#f59e0b',
  approved: '#06b6d4',
  in_progress: '#3b82f6',
  completed: '#10b981',
  rejected: '#ef4444',
  cancelled: '#8e93ab',
};

export default function AppOrdersPage() {
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [activeTab, setActiveTab] = useState('active');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    const endpoint = activeTab === 'active' ? '/orders/active/' : '/orders/';
    const params = activeTab === 'history' ? { status: 'completed' } : {};
    return api.get(endpoint, { params }).then(({ data }) => {
      const results = Array.isArray(data) ? data : data.results || [];
      setOrders(results);
    }).catch(() => {})
      .finally(() => { if (!silent) setLoading(false); });
  }, [activeTab]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  useRealtimeRefresh(useCallback(() => {
    fetchOrders({ silent: true });
  }, [fetchOrders]));

  const tabs = [
    { key: 'active', label: t('orders.activeTab'), icon: <ClockCircleOutlined /> },
    { key: 'all', label: t('orders.allTab'), icon: <FileTextOutlined /> },
    { key: 'history', label: t('orders.completedTab'), icon: <CheckCircleOutlined /> },
  ];

  return (
    <div style={{ background: 'var(--bg-secondary)', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{
        padding: isMobile ? '20px 20px 0' : '24px 40px 0',
        paddingTop: isMobile ? 'calc(20px + env(safe-area-inset-top, 0px))' : 24,
        background: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border-light)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 20,
        }}>
          <div style={{
            fontSize: 26, fontWeight: 800, color: 'var(--text-primary)',
            letterSpacing: -0.5,
          }}>
            {t('orders.myOrders')}
          </div>
          <div
            onClick={() => navigate('/app/order/new')}
            style={{
              width: 38, height: 38, borderRadius: 12,
              background: 'var(--accent-bg-strong)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--accent)', fontSize: 16,
              transition: 'all 0.2s ease',
            }}
          >
            <PlusOutlined />
          </div>
        </div>

        {/* Tab bar */}
        <div style={{
          display: 'flex', gap: 0,
          background: 'var(--bg-tertiary)',
          borderRadius: 14,
          padding: 4,
          marginBottom: 16,
        }}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <div
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: '10px 0',
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? 'var(--accent)' : 'var(--text-tertiary)',
                  background: isActive ? 'var(--card-bg)' : 'transparent',
                  borderRadius: 10,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  transition: 'all 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
                  boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
                  position: 'relative',
                }}
              >
                {tab.icon}
                {tab.label}
              </div>
            );
          })}
        </div>
      </div>

      {/* Order list */}
      <div style={{ padding: isMobile ? '12px 16px 24px' : '20px 40px 32px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 80 }}>
            <Spin size="large" />
          </div>
        ) : orders.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '60px 24px',
            background: 'var(--card-bg)', borderRadius: 20,
            marginTop: 4, boxShadow: 'var(--shadow-sm)',
            border: '1px solid var(--border-color)',
            animation: 'fadeInUp 0.4s ease-out both',
          }}>
            <div style={{
              width: 72, height: 72, borderRadius: 22,
              background: 'var(--accent-bg)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 32, color: 'var(--accent)', marginBottom: 20,
            }}>
              <FileTextOutlined />
            </div>
            <div style={{
              fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6,
              letterSpacing: -0.2,
            }}>
              {activeTab === 'active'
                ? t('orders.noActive')
                : activeTab === 'history'
                ? t('orders.noCompleted')
                : t('orders.noOrders')}
            </div>
            <div style={{
              fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 20,
              lineHeight: 1.5, maxWidth: 240, margin: '0 auto 20px',
            }}>
              {activeTab !== 'history' && t('orders.placeFirst')}
            </div>
            {activeTab !== 'history' && (
              <div
                onClick={() => navigate('/app/order/new')}
                style={{
                  color: '#fff', fontWeight: 600,
                  fontSize: 14, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  background: 'var(--fab-gradient)',
                  padding: '12px 24px', borderRadius: 14,
                  boxShadow: 'var(--fab-shadow)',
                  transition: 'all 0.2s ease',
                }}
              >
                <PlusOutlined /> {t('orders.placeFirst')}
              </div>
            )}
          </div>
        ) : (
          orders.map((order, idx) => (
            <OrderCard
              key={order.id}
              order={order}
              onClick={() => navigate(`/app/orders/${order.public_id || order.id}`)}
              t={t}
              lang={lang}
              delay={idx * 0.04}
            />
          ))
        )}
      </div>
    </div>
  );
}

function OrderCard({ order, onClick, t, lang, delay = 0 }) {
  const badgeColor = STATUS_BADGE_COLORS[order.status] || '#8e93ab';
  const catColor = order.selected_category_color || 'var(--accent)';

  return (
    <div
      onClick={onClick}
      className="card-interactive"
      style={{
        background: 'var(--card-bg)',
        borderRadius: 16,
        padding: '0',
        marginBottom: 10,
        display: 'flex',
        alignItems: 'stretch',
        boxShadow: 'var(--shadow-sm)',
        border: `1px solid ${order.is_unread ? 'var(--accent)' : 'var(--border-color)'}`,
        overflow: 'hidden',
        animation: `fadeInUp 0.4s ease-out ${delay}s both`,
        position: 'relative',
      }}
    >
      {order.is_unread && (
        <div style={{
          position: 'absolute', top: 10, right: 10,
          width: 8, height: 8, borderRadius: '50%',
          background: '#ef4444', boxShadow: '0 0 0 3px rgba(239,68,68,0.18)',
          zIndex: 2,
        }} />
      )}
      {/* Left accent border */}
      <div style={{
        width: 4, flexShrink: 0,
        background: badgeColor,
        borderRadius: '4px 0 0 4px',
      }} />

      <div style={{
        flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 14px 14px 12px',
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: `${catColor}12`,
          display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          color: catColor, flexShrink: 0, overflow: 'hidden',
        }}>
          <CategoryImage imageUrl={order.selected_category_image} icon={order.selected_category_icon} size={order.selected_category_image ? 52 : 36} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 15, fontWeight: 600, color: 'var(--text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            letterSpacing: -0.1,
          }}>
            {order.pickup_location}
          </div>
          <div style={{
            fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>#{order.id}</span>
            <span style={{ opacity: 0.4 }}>&middot;</span>
            {order.requested_date}
            {order.selected_category_name && (
              <>
                <span style={{ opacity: 0.4 }}>&middot;</span>
                <span style={{
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  maxWidth: 80,
                }}>
                  {typeof order.selected_category_name === 'object' ? (order.selected_category_name[lang] || order.selected_category_name.en || '') : order.selected_category_name}
                </span>
              </>
            )}
          </div>
          {(order.urgency === 'urgent' || order.urgency === 'high') && (
            <div style={{
              marginTop: 6,
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 11, fontWeight: 600,
              color: order.urgency === 'urgent' ? '#ef4444' : '#f59e0b',
              background: order.urgency === 'urgent' ? 'var(--danger-bg)' : '#f59e0b14',
              padding: '2px 8px', borderRadius: 6,
            }}>
            {t('urgency.' + order.urgency)}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
          <div style={{
            fontSize: 11, fontWeight: 600, color: badgeColor,
            background: `${badgeColor}14`,
            padding: '4px 10px',
            borderRadius: 8,
            whiteSpace: 'nowrap',
          }}>
            {getStatusLabel(t, order.status, { isCustomer: true }) || order.status}
          </div>
          <RightOutlined style={{ color: 'var(--text-placeholder)', fontSize: 11 }} />
        </div>
      </div>
    </div>
  );
}
