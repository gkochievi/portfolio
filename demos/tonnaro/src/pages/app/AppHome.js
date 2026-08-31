import React, { useCallback, useEffect, useState } from 'react';
import { Typography, Spin, Input, Grid } from 'antd';
import {
  ClockCircleOutlined,
  SearchOutlined, ArrowRightOutlined, ThunderboltOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { useLang } from '../../contexts/LanguageContext';
import { useRealtimeRefresh } from '../../contexts/NotificationContext';
import { STATUS_CONFIG, getStatusLabel } from '../../utils/status';
import { CategoryImage } from '../../utils/categoryIcons';

const { Text } = Typography;
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

export default function AppHome() {
  const { user } = useAuth();
  const { t, lang } = useLang();
  const localized = (field) => {
    if (!field) return '';
    if (typeof field === 'string') return field;
    return field[lang] || field['en'] || '';
  };
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [categories, setCategories] = useState([]);
  const [activeOrders, setActiveOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [catSearch, setCatSearch] = useState('');
  const [showAllCats, setShowAllCats] = useState(false);

  const refreshActiveOrders = useCallback(() => {
    return api.get('/orders/active/').then(({ data }) => {
      const orders = Array.isArray(data) ? data : data.results || [];
      setActiveOrders(orders);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    Promise.all([
      // AppHome now lists vehicle types (TransportCategory) so the customer
      // picks a car category first — services get filtered to that category
      // on the order page. Mirrors the landing-page browse-by-vehicle flow.
      api.get('/categories/'),
      api.get('/orders/active/'),
    ]).then(([catRes, ordersRes]) => {
      const cats = Array.isArray(catRes.data) ? catRes.data : catRes.data.results || [];
      setCategories(cats);
      const orders = Array.isArray(ordersRes.data) ? ordersRes.data : ordersRes.data.results || [];
      setActiveOrders(orders);
    }).catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useRealtimeRefresh(refreshActiveOrders);

  if (loading) {
    return (
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        minHeight: '60vh',
      }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      minHeight: '100vh',
    }}>
      {/* ── Header with gradient ── */}
      <div style={{
        padding: isMobile ? '28px 20px 32px' : '36px 40px 40px',
        paddingTop: isMobile ? 'calc(28px + env(safe-area-inset-top, 0px))' : 36,
        background: 'var(--header-gradient)',
        color: '#fff',
        borderRadius: isMobile ? '0 0 32px 32px' : '0 0 24px 24px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative elements */}
        <div style={{
          position: 'absolute', top: -60, right: -40, width: 200, height: 200,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -30, left: -30, width: 120, height: 120,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', top: '40%', left: '60%', width: 80, height: 80,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <Text style={{
            color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 500,
            letterSpacing: 0.5, textTransform: 'none',
          }}>
            {`${t('home.good')} ${t('home.greeting.' + getGreeting())}`.trim()}
          </Text>
          <div style={{
            fontSize: 26, fontWeight: 800, marginTop: 4,
            letterSpacing: -0.5, lineHeight: 1.2,
          }}>
            {user?.first_name || 'there'}
          </div>

          {/* Quick action button */}
          <div
            onClick={() => navigate('/app/order/new')}
            style={{
              marginTop: 22,
              background: 'rgba(255,255,255,0.13)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              borderRadius: 18,
              padding: '16px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              cursor: 'pointer',
              border: '1px solid rgba(255,255,255,0.16)',
              transition: 'all 0.25s cubic-bezier(0.22,1,0.36,1)',
            }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: 14,
              background: 'rgba(255,255,255,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20,
            }}>
              <ThunderboltOutlined />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 650, letterSpacing: -0.1 }}>
                {t('home.searchPrompt')}
              </div>
              <div style={{ fontSize: 12, opacity: 0.65, marginTop: 2 }}>
                {t('home.tapToStart')}
              </div>
            </div>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'rgba(255,255,255,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ArrowRightOutlined style={{ fontSize: 13, opacity: 0.8 }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Active orders ── */}
      {activeOrders.length > 0 && (
        <div className="animate-fade-in-up" style={{ padding: isMobile ? '24px 20px 0' : '28px 40px 0' }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 14,
          }}>
            <div style={{
              fontSize: 17, fontWeight: 700, color: 'var(--text-primary)',
              display: 'flex', alignItems: 'center', gap: 8,
              letterSpacing: -0.2,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: 'rgba(245,158,11,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <ClockCircleOutlined style={{ color: 'var(--warning-color)', fontSize: 14 }} />
              </div>
              {t('home.activeOrders')}
            </div>
            {activeOrders.length > 3 && (
              <span
                onClick={() => navigate('/app/orders')}
                style={{
                  fontSize: 13, color: 'var(--accent)', cursor: 'pointer',
                  fontWeight: 600, letterSpacing: -0.1,
                }}
              >
                {t('common.viewAll')}
              </span>
            )}
          </div>

          {activeOrders.slice(0, 3).map((order, idx) => {
            const badgeColor = STATUS_BADGE_COLORS[order.status] || '#F97316';
            return (
              <div
                key={order.id}
                onClick={() => navigate(`/app/orders/${order.public_id || order.id}`)}
                className="card-interactive"
                style={{
                  background: 'var(--card-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 18,
                  padding: '15px 16px',
                  marginBottom: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 13,
                  boxShadow: 'var(--shadow-sm)',
                  animation: `fadeInUp 0.45s cubic-bezier(0.22,1,0.36,1) ${idx * 0.06}s both`,
                }}
              >
                <div style={{
                  width: 52, height: 52, borderRadius: 14,
                  background: `${order.selected_category_color || 'var(--accent)'}14`,
                  display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  color: order.selected_category_color || 'var(--accent)',
                  flexShrink: 0, overflow: 'hidden',
                }}>
                  <CategoryImage imageUrl={order.selected_category_image} icon={order.selected_category_icon} size={order.selected_category_image ? 52 : 36} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14, fontWeight: 650, color: 'var(--text-primary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    letterSpacing: -0.1,
                  }}>
                    {order.pickup_location}
                  </div>
                  <div style={{
                    fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <span style={{
                      display: 'inline-block', width: 4, height: 4,
                      borderRadius: '50%', background: 'var(--text-placeholder)',
                      flexShrink: 0,
                    }} />
                    #{order.id} · {order.requested_date}
                  </div>
                </div>
                <div style={{
                  fontSize: 11, fontWeight: 650, color: badgeColor,
                  background: `${badgeColor}14`,
                  padding: '5px 11px',
                  borderRadius: 10,
                  whiteSpace: 'nowrap',
                  letterSpacing: 0.1,
                  flexShrink: 0,
                }}>
                  {getStatusLabel(t, order.status, { isCustomer: true }) || order.status}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Transport categories grid ── */}
      <div className="animate-fade-in-up" style={{ padding: isMobile ? '24px 20px 4px' : '28px 40px 4px' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 16,
        }}>
          <div style={{
            fontSize: 17, fontWeight: 700, color: 'var(--text-primary)',
            letterSpacing: -0.2,
          }}>
            {t('home.selectType')}
          </div>
          {categories.length > 6 && (
            <span
              onClick={() => setShowAllCats(!showAllCats)}
              style={{
                fontSize: 13, color: 'var(--accent)', cursor: 'pointer',
                fontWeight: 600, letterSpacing: -0.1,
              }}
            >
              {showAllCats ? t('home.showLess') : t('home.all', { count: categories.length })}
            </span>
          )}
        </div>

        {showAllCats && categories.length > 6 && (
          <Input
            prefix={<SearchOutlined style={{ color: 'var(--text-placeholder)' }} />}
            placeholder={t('home.searchType')}
            value={catSearch}
            onChange={(e) => setCatSearch(e.target.value)}
            allowClear
            style={{
              marginBottom: 14, borderRadius: 16, height: 46,
              background: 'var(--input-bg)',
              border: '1px solid var(--input-border)',
              fontSize: 14,
            }}
          />
        )}

        {(() => {
          let filtered = categories;
          if (catSearch) {
            const q = catSearch.toLowerCase();
            filtered = categories.filter(
              (c) => localized(c.name).toLowerCase().includes(q) || localized(c.description).toLowerCase().includes(q)
            );
          }
          const visible = showAllCats ? filtered : filtered.slice(0, 6);

          return (
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: isMobile ? 10 : 14,
            }}>
              {visible.map((cat, idx) => {
                const color = cat.color || 'var(--accent)';
                return (
                  <div
                    key={cat.id}
                    onClick={() => navigate(`/app/order/new?category=${cat.id}`)}
                    className="card-interactive"
                    style={{
                      background: 'var(--card-bg)',
                      borderRadius: 18,
                      padding: '20px 8px 16px',
                      border: '1px solid var(--border-color)',
                      boxShadow: 'var(--shadow-sm)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 10,
                      animation: `fadeInUp 0.45s cubic-bezier(0.22,1,0.36,1) ${idx * 0.04}s both`,
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    <div style={{
                      position: 'absolute', top: -12, right: -12, width: 40, height: 40,
                      borderRadius: '50%', background: `${color}08`,
                      pointerEvents: 'none',
                    }} />
                    <div style={{
                      width: '100%', aspectRatio: '4 / 4',
                      borderRadius: 14,
                      background: cat.image_url ? 'var(--bg-secondary)' : `${color}12`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: color, overflow: 'hidden',
                      transition: 'transform 0.25s cubic-bezier(0.22,1,0.36,1)',
                    }}>
                      {cat.image_url ? (
                        <img src={cat.image_url} alt="" style={{
                          maxWidth: '100%', maxHeight: '100%',
                          width: 'auto', height: 'auto',
                          objectFit: 'contain', display: 'block',
                        }} />
                      ) : (
                        <CategoryImage icon={cat.icon} size={44} />
                      )}
                    </div>
                    <div style={{
                      fontSize: 12, fontWeight: 650, color: 'var(--text-primary)',
                      textAlign: 'center', lineHeight: 1.35,
                      overflow: 'hidden', display: '-webkit-box',
                      WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                      letterSpacing: -0.1,
                    }}>
                      {localized(cat.name)}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* ── How it works ── */}
      <div style={{ padding: isMobile ? '20px 20px 36px' : '28px 40px 40px' }}>
        <div style={{
          fontSize: 17, fontWeight: 700, marginBottom: 18,
          color: 'var(--text-primary)', letterSpacing: -0.2,
        }}>
          {t('home.howItWorks')}
        </div>
        <div style={{
          background: 'var(--card-bg)',
          borderRadius: 20,
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-sm)',
          padding: '6px 0',
          overflow: 'hidden',
        }}>
          {[
            { num: '1', title: t('home.step1Title'), desc: t('home.step1Desc'), color: '#F97316' },
            { num: '2', title: t('home.step2Title'), desc: t('home.step2Desc'), color: '#3b82f6' },
            { num: '3', title: t('home.step3Title'), desc: t('home.step3Desc'), color: '#10b981' },
          ].map((step, i, arr) => (
            <div key={i} style={{
              display: 'flex', gap: 14, alignItems: 'flex-start',
              padding: '14px 18px',
              animation: `fadeInUp 0.45s cubic-bezier(0.22,1,0.36,1) ${i * 0.08}s both`,
              borderBottom: i < arr.length - 1 ? '1px solid var(--border-light)' : 'none',
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: 11,
                background: `${step.color}12`, color: step.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 800, flexShrink: 0,
              }}>
                {step.num}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: 14, fontWeight: 650, color: 'var(--text-primary)',
                  letterSpacing: -0.1,
                }}>
                  {step.title}
                </div>
                <div style={{
                  fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3,
                  lineHeight: 1.5,
                }}>
                  {step.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
