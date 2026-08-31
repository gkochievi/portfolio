import React, { useCallback, useEffect, useState } from 'react';
import { Row, Col, Typography, List, Spin, Button, Grid, Progress } from 'antd';
import {
  TeamOutlined, RightOutlined, CarOutlined, UserOutlined,
  RiseOutlined, FallOutlined, MinusOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../../api/client';
import { StatusBadge } from '../../components/common/StatusBadge';
import { useLang } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useRealtimeRefresh } from '../../contexts/NotificationContext';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

export default function AdminDashboard() {
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const { t, lang } = useLang();
  const { isDark } = useTheme();
  const [stats, setStats] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const isMobile = !screens.md;

  const loadDashboard = useCallback(({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    return Promise.all([
      api.get('/auth/admin/dashboard/'),
      api.get('/orders/admin/?page=1'),
    ]).then(([statsRes, ordersRes]) => {
      setStats(statsRes.data);
      const results = ordersRes.data.results || ordersRes.data;
      setRecentOrders(Array.isArray(results) ? results.slice(0, 5) : []);
    }).catch(() => {})
      .finally(() => { if (!silent) setLoading(false); });
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  useRealtimeRefresh(useCallback(() => {
    loadDashboard({ silent: true });
  }, [loadDashboard]));

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 80 }}>
      <Spin size="large" />
    </div>
  );

  const totalOrders = (stats?.new_orders || 0)
    + (stats?.under_review_orders || 0)
    + (stats?.approved_orders || 0)
    + (stats?.in_progress_orders || 0)
    + (stats?.completed_orders || 0)
    + (stats?.rejected_orders || 0)
    + (stats?.cancelled_orders || 0);

  const statCards = [
    { title: t('adminDash.totalUsers'), value: stats?.total_users, icon: <TeamOutlined />, color: 'var(--accent)', path: '/admin/users' },
    { title: t('adminDash.vehicles'), value: stats?.total_vehicles, icon: <CarOutlined />, color: 'var(--accent)', path: '/admin/vehicles' },
    { title: t('adminDash.drivers'), value: stats?.total_drivers, icon: <UserOutlined />, color: '#ec4899', path: '/admin/drivers' },
  ];

  const distributionItems = [
    { label: t('status.new'), value: stats?.new_orders || 0, color: '#f59e0b' },
    { label: t('status.under_review'), value: stats?.under_review_orders || 0, color: '#a855f7' },
    { label: t('status.in_progress'), value: stats?.in_progress_orders || 0, color: '#06b6d4' },
    { label: t('status.completed'), value: stats?.completed_orders || 0, color: '#10b981' },
    { label: t('status.rejected'), value: stats?.rejected_orders || 0, color: '#ef4444' },
    { label: t('status.cancelled'), value: stats?.cancelled_orders || 0, color: '#94a3b8' },
  ];

  const trendData = (stats?.daily_trend || []).map((d) => ({
    date: d.date,
    label: new Date(d.date).toLocaleDateString(lang === 'en' ? 'en-US' : lang, { weekday: 'short' }),
    total: d.total,
    completed: d.completed,
  }));
  const weekTotal = stats?.current_week_total || 0;
  const prevWeekTotal = stats?.prev_week_total || 0;
  const weekDelta = weekTotal - prevWeekTotal;
  const weekDeltaPct = prevWeekTotal > 0
    ? Math.round((weekDelta / prevWeekTotal) * 100)
    : (weekTotal > 0 ? 100 : 0);
  const trendColor = weekDelta > 0 ? '#10b981' : (weekDelta < 0 ? '#ef4444' : 'var(--text-tertiary)');
  const TrendIcon = weekDelta > 0 ? RiseOutlined : (weekDelta < 0 ? FallOutlined : MinusOutlined);

  return (
    <div className="page-enter">
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{
          margin: 0, fontWeight: 800, letterSpacing: '-0.02em',
          color: 'var(--text-primary)',
        }}>
          {t('adminDash.dashboard')}
        </Title>
      </div>

      {/* Stat cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 28 }}>
        {statCards.map((s, i) => (
          <Col xs={24} sm={8} key={i}>
            <div
              className="card-interactive"
              onClick={() => s.path && navigate(s.path)}
              style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: 16,
                padding: isMobile ? 14 : 20,
                transition: 'all 0.2s ease',
                cursor: s.path ? 'pointer' : 'default',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: `color-mix(in srgb, ${s.color} 12%, transparent)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, color: s.color, flexShrink: 0,
                }}>
                  {s.icon}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: isMobile ? 22 : 26, fontWeight: 800,
                    color: s.color, lineHeight: 1.1, letterSpacing: '-0.02em',
                  }}>
                    {s.value || 0}
                  </div>
                  <div style={{
                    fontSize: 12, color: 'var(--text-tertiary)',
                    fontWeight: 500, marginTop: 2,
                    whiteSpace: 'nowrap', overflow: 'hidden',
                    textOverflow: 'ellipsis', maxWidth: '100%',
                  }} title={s.title}>
                    {s.title}
                  </div>
                </div>
              </div>
            </div>
          </Col>
        ))}
      </Row>

      {/* Order distribution + quick actions */}
      <Row gutter={[16, 16]} style={{ marginBottom: 28 }}>
        <Col xs={24} md={12}>
          <div style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: 16,
            padding: 24,
            height: '100%',
          }}>
            <Text style={{
              fontSize: 16, fontWeight: 700, color: 'var(--text-primary)',
              letterSpacing: '-0.02em', display: 'block', marginBottom: 20,
            }}>
              {t('adminDash.orderDistribution')}
            </Text>
            {totalOrders > 0 ? (
              <div>
                {distributionItems.map((item) => (
                  <div key={item.label} style={{ marginBottom: 16 }}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center', marginBottom: 6,
                    }}>
                      <Text style={{
                        fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500,
                      }}>
                        {item.label}
                      </Text>
                      <Text style={{
                        fontSize: 13, fontWeight: 700, color: 'var(--text-primary)',
                      }}>
                        {item.value}
                      </Text>
                    </div>
                    <Progress
                      percent={Math.round((item.value / totalOrders) * 100)}
                      strokeColor={item.color}
                      trailColor="var(--bg-secondary)"
                      showInfo={false}
                      size="small"
                      style={{ marginBottom: 0 }}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <Text style={{ color: 'var(--text-tertiary)' }}>{t('adminDash.noOrdersYet')}</Text>
            )}
          </div>
        </Col>
        <Col xs={24} md={12}>
          <div style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: 16,
            padding: 24,
            height: '100%',
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 16,
            }}>
              <Text style={{
                fontSize: 16, fontWeight: 700, color: 'var(--text-primary)',
                letterSpacing: '-0.02em',
              }}>
                {t('adminDash.last7Days')}
              </Text>
              <Button
                type="link"
                onClick={() => navigate('/admin/analytics')}
                style={{ color: 'var(--accent)', fontWeight: 600, padding: 0, height: 'auto' }}
              >
                {t('adminDash.fullAnalytics')}
              </Button>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
              <div style={{
                fontSize: 32, fontWeight: 800, color: 'var(--text-primary)',
                letterSpacing: '-0.02em', lineHeight: 1,
              }}>
                {weekTotal}
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 13, fontWeight: 600, color: trendColor,
              }}>
                <TrendIcon style={{ fontSize: 12 }} />
                {weekDelta > 0 ? '+' : ''}{weekDeltaPct}%
              </div>
            </div>
            <Text style={{
              fontSize: 12, color: 'var(--text-tertiary)',
              display: 'block', marginBottom: 16,
            }}>
              {t('adminDash.thisWeek')} · {t('adminDash.vsLastWeek')} ({prevWeekTotal})
            </Text>

            <div style={{ width: '100%', height: 140 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: isDark ? '#6b7280' : '#9ca3af' }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: isDark ? '#1a1c24' : '#fff',
                      border: `1px solid ${isDark ? '#1f2128' : '#e5e7eb'}`,
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: isDark ? '#e8e8e8' : '#333', fontWeight: 600 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="var(--accent)"
                    strokeWidth={2}
                    fill="url(#trendGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Col>
      </Row>

      {/* Recent orders */}
      <div style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: 16,
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '18px 24px', borderBottom: '1px solid var(--border-color)',
        }}>
          <Text style={{
            fontSize: 16, fontWeight: 700, color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
          }}>
            {t('adminDash.recentOrders')}
          </Text>
          <Button
            type="link"
            onClick={() => navigate('/admin/orders')}
            style={{ color: 'var(--accent)', fontWeight: 600, padding: 0 }}
          >
            {t('common.viewAll')}
          </Button>
        </div>
        <List
          dataSource={recentOrders}
          renderItem={(order) => (
            <div
              onClick={() => navigate(`/admin/orders/${order.id}`)}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: isMobile ? '14px 16px' : '14px 24px',
                cursor: 'pointer',
                borderBottom: '1px solid var(--border-color)',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{
                  fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
                  marginBottom: 3,
                }}>
                  #{order.id} — {order.pickup_location}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                  {order.requested_date} · {(typeof order.selected_category_name === 'object' ? (order.selected_category_name[lang] || order.selected_category_name.en || '') : order.selected_category_name) || '—'}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 12 }}>
                <StatusBadge status={order.status} />
                {isMobile && <RightOutlined style={{ color: 'var(--text-tertiary)', fontSize: 11 }} />}
              </div>
            </div>
          )}
        />
      </div>
    </div>
  );
}
