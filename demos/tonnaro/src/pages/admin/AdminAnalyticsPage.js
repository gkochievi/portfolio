import React, { useEffect, useMemo, useState } from 'react';
import { Typography, Spin, Select, Row, Col, Grid, Button, Table, Tag, DatePicker } from 'antd';
import dayjs from 'dayjs';
import {
  RiseOutlined, FallOutlined, ShoppingCartOutlined,
  CalendarOutlined, WalletOutlined,
  UserAddOutlined, BarChartOutlined, CheckCircleOutlined,
  ClockCircleOutlined, DownloadOutlined,
} from '@ant-design/icons';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line,
} from 'recharts';
import api from '../../api/client';
import { useTheme } from '../../contexts/ThemeContext';
import { useLang } from '../../contexts/LanguageContext';
import { useBranding } from '../../contexts/BrandingContext';
import { COLOR_THEMES, DEFAULT_COLOR_THEME } from '../../utils/colorThemes';
import { DEFAULT_CURRENCY } from '../../utils/currency';
import { downloadCsv, joinSheets } from '../../utils/exportCsv';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

const STATUS_COLORS = {
  new: '#00B856',
  under_review: '#f59e0b',
  approved: '#06b6d4',
  in_progress: '#3b82f6',
  completed: '#10b981',
  rejected: '#ef4444',
  cancelled: '#9ca3af',
};

const URGENCY_COLORS = {
  low: '#10b981',
  normal: '#00B856',
  high: '#f59e0b',
  urgent: '#ef4444',
};

const USER_TYPE_COLORS = {
  personal: '#00B856',
  company: '#f59e0b',
};

const FLEET_STATUS_COLORS = {
  available: '#10b981',
  in_use: '#00B856',
  maintenance: '#f59e0b',
  retired: '#ef4444',
};

const PIE_COLORS = ['#00B856', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#009E4A', '#ec4899', '#f59e0b'];

export default function AdminAnalyticsPage() {
  const screens = useBreakpoint();
  const { isDark } = useTheme();
  const { colorTheme, currency = DEFAULT_CURRENCY } = useBranding();
  const { t, lang } = useLang();
  const palette = (COLOR_THEMES[colorTheme] || COLOR_THEMES[DEFAULT_COLOR_THEME])[isDark ? 'dark' : 'light'];
  const ACCENT = palette.accent;
  const ACCENT_DARK = palette.accentDark;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  // Preset periods write to `dateRange`; picking a custom range just overrides
  // `dateRange` directly. `period` is derived from the range length so stat
  // cards and chart labels still get a "last N days" number.
  const [dateRange, setDateRange] = useState(() => [
    dayjs().subtract(29, 'day').startOf('day'),
    dayjs().startOf('day'),
  ]);
  const period = useMemo(
    () => (dateRange?.[0] && dateRange?.[1] ? dateRange[1].diff(dateRange[0], 'day') + 1 : 30),
    [dateRange],
  );

  const isMobile = !screens.md;
  const textColor = isDark ? '#e8e8e8' : '#333';
  const subTextColor = isDark ? '#6b7280' : '#9ca3af';
  const gridColor = isDark ? '#1f2128' : '#f0f0f0';
  const tooltipBg = isDark ? '#1a1c24' : '#fff';
  const tooltipBorder = isDark ? '#2a2d36' : '#e5e7eb';
  // Cursor = the highlight rectangle/line that follows the pointer over bars
  // and lines. Recharts defaults to a light grey, which reads as a near-white
  // smear over dark-mode bars. Use a translucent overlay tuned to each theme.
  const cursorFill = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  const cursorStroke = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)';

  useEffect(() => {
    if (!dateRange?.[0] || !dateRange?.[1]) return;
    setLoading(true);
    api.get('/auth/admin/analytics/', {
      params: {
        date_from: dateRange[0].format('YYYY-MM-DD'),
        date_to: dateRange[1].format('YYYY-MM-DD'),
      },
    })
      .then(({ data }) => setData(data))
      .catch(() => {})
      .finally(() => setLoading(false));
    // DEMO: `lang` is in the deps because this demo's mock localises the
    // service and category names it returns (upstream ships raw {en,ka,ru}
    // dicts here and the page has no localiser, so the axes read
    // "[object Object]" whatever the language). Without the refetch, switching
    // language leaves every chart label in the language the page loaded in.
  }, [dateRange, lang]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!data) return null;

  const { comparison } = data;
  const orderChange = comparison.previous_orders
    ? Math.round(((comparison.current_orders - comparison.previous_orders) / comparison.previous_orders) * 100)
    : 0;
  const completedChange = comparison.previous_completed
    ? Math.round(((comparison.current_completed - comparison.previous_completed) / comparison.previous_completed) * 100)
    : 0;

  const customTooltip = {
    contentStyle: {
      background: tooltipBg,
      border: `1px solid ${tooltipBorder}`,
      borderRadius: 12,
      fontSize: 12,
      boxShadow: isDark
        ? '0 8px 24px rgba(0,0,0,0.5)'
        : '0 4px 12px rgba(0,0,0,0.08)',
      padding: '10px 14px',
      color: textColor,
    },
    labelStyle: { color: textColor, fontWeight: 600 },
    itemStyle: { color: textColor, padding: 0 },
    wrapperStyle: { outline: 'none' },
    cursor: { fill: cursorFill, stroke: cursorStroke, strokeWidth: 1 },
  };

  const chartCardStyle = {
    background: 'var(--card-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: 16,
    overflow: 'hidden',
  };

  const chartHeaderStyle = {
    padding: '16px 20px 0',
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--text-primary)',
    letterSpacing: '-0.02em',
  };

  const chartBodyStyle = {
    padding: '16px 12px 16px 0',
  };

  const rates = data.rates || { completion: 0, cancellation: 0, rejection: 0 };
  const avgCompletionHours = data.avg_completion_hours || 0;
  const topCustomers = data.top_customers || [];

  const statCards = [
    {
      title: t('analytics.today'),
      value: data.today_orders,
      icon: <CalendarOutlined />,
      color: ACCENT,
    },
    {
      title: t('analytics.thisWeek'),
      value: data.this_week_orders,
      icon: <ShoppingCartOutlined />,
      color: '#06b6d4',
    },
    {
      title: t('analytics.thisMonth'),
      value: data.this_month_orders,
      icon: <ShoppingCartOutlined />,
      color: ACCENT_DARK,
    },
    {
      title: t('analytics.periodOrders', { days: period }),
      value: comparison.current_orders,
      suffix: orderChange !== 0 ? (
        <span style={{
          fontSize: 12, color: orderChange > 0 ? '#10b981' : '#ef4444',
          marginLeft: 4, fontWeight: 600,
        }}>
          {orderChange > 0 ? <RiseOutlined /> : <FallOutlined />} {Math.abs(orderChange)}%
        </span>
      ) : null,
      icon: <RiseOutlined />,
      color: '#10b981',
    },
    {
      title: t('analytics.estRevenue'),
      value: `${currency.symbol}${data.revenue.total_estimated.toLocaleString()}`,
      icon: <WalletOutlined />,
      color: '#f59e0b',
      isStr: true,
    },
    {
      title: t('analytics.completionRate'),
      value: `${rates.completion}%`,
      icon: <CheckCircleOutlined />,
      color: '#10b981',
      isStr: true,
    },
    {
      title: t('analytics.cancellationRate'),
      value: `${rates.cancellation}%`,
      icon: <FallOutlined />,
      color: '#ef4444',
      isStr: true,
    },
    {
      title: t('analytics.avgCompletionTime'),
      value: `${avgCompletionHours} ${t('analytics.hours')}`,
      icon: <ClockCircleOutlined />,
      color: '#ec4899',
      isStr: true,
    },
  ];

  const handleExportCsv = () => {
    const fmt = (n) => (n == null ? '' : Number(n));
    const rangeLabel = (data.date_from && data.date_to)
      ? `${data.date_from} → ${data.date_to}`
      : t('analytics.last30').replace('30', String(period));
    const sections = [
      {
        title: `${t('analytics.summary')} (${rangeLabel})`,
        headers: [t('analytics.metric'), t('analytics.value')],
        rows: [
          [t('analytics.dateRange'), rangeLabel],
          [t('analytics.today'), data.today_orders],
          [t('analytics.thisWeek'), data.this_week_orders],
          [t('analytics.thisMonth'), data.this_month_orders],
          [t('analytics.periodOrders', { days: period }), comparison.current_orders],
          [t('analytics.estRevenue'), `${currency.symbol}${data.revenue.total_estimated}`],
          [t('analytics.completionRate'), `${rates.completion}%`],
          [t('analytics.cancellationRate'), `${rates.cancellation}%`],
          [`${t('analytics.avgCompletionTime')} (${t('analytics.hours')})`, avgCompletionHours],
        ],
      },
      {
        title: t('analytics.dailyOrders'),
        headers: ['Date', t('analytics.total'), t('status.completed'), 'Cancelled', 'Rejected'],
        rows: (data.daily_orders || []).map((d) => [
          d.date, d.total, d.completed, d.cancelled, d.rejected,
        ]),
      },
      {
        title: t('analytics.ordersByService'),
        headers: [t('adminOrders.service'), t('analytics.orders')],
        rows: (data.by_service || []).map((c) => [c.name, c.count]),
      },
      {
        title: t('analytics.revenueByService'),
        headers: [t('adminOrders.service'), t('analytics.orders'), `${t('analytics.revenue')} (${currency.code})`],
        rows: (data.revenue.by_service || []).map((c) => [c.name, c.orders, fmt(c.revenue)]),
      },
      {
        title: t('analytics.topCustomers'),
        headers: [t('analytics.customer'), 'Email', t('analytics.orders'), t('analytics.completed'), `${t('analytics.revenue')} (${currency.code})`],
        rows: topCustomers.map((c) => [c.name, c.email, c.orders, c.completed, fmt(c.revenue)]),
      },
    ];
    const from = data.date_from || dayjs().subtract(period - 1, 'day').format('YYYY-MM-DD');
    const to = data.date_to || dayjs().format('YYYY-MM-DD');
    downloadCsv(`analytics-${from}-to-${to}.csv`, joinSheets(sections));
  };

  return (
    <div className="page-enter">
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 28, flexWrap: 'wrap', gap: 12,
      }}>
        <Title level={3} style={{
          margin: 0, fontWeight: 800, letterSpacing: '-0.02em',
          color: 'var(--text-primary)',
        }}>
          <BarChartOutlined style={{ marginRight: 10, color: 'var(--accent)' }} />
          {t('analytics.title')}
        </Title>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Select
            value={period}
            onChange={(days) => setDateRange([
              dayjs().subtract(days - 1, 'day').startOf('day'),
              dayjs().startOf('day'),
            ])}
            style={{ width: isMobile ? 130 : 150 }}
            options={[
              { value: 7, label: t('analytics.last7') },
              { value: 14, label: t('analytics.last14') },
              { value: 30, label: t('analytics.last30') },
              { value: 60, label: t('analytics.last60') },
              { value: 90, label: t('analytics.last90') },
            ]}
          />
          <DatePicker.RangePicker
            value={dateRange}
            onChange={(range) => {
              if (range && range[0] && range[1]) {
                setDateRange([range[0].startOf('day'), range[1].startOf('day')]);
              }
            }}
            allowClear={false}
            disabledDate={(d) => d && d > dayjs().endOf('day')}
            style={{ borderRadius: 10 }}
          />
          <Button
            icon={<DownloadOutlined />}
            onClick={handleExportCsv}
            style={{ borderRadius: 10, fontWeight: 600 }}
          >
            {!isMobile && t('analytics.exportCsv')}
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 28 }}>
        {statCards.map((s, i) => (
          <Col xs={12} sm={8} md={6} lg={6} key={i}>
            <div style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--border-color)',
              borderRadius: 16,
              padding: isMobile ? 14 : 20,
              minWidth: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: `color-mix(in srgb, ${s.color} 12%, transparent)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, color: s.color, flexShrink: 0,
                }}>
                  {s.icon}
                </div>
                <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                  <div style={{
                    fontSize: isMobile ? 18 : 24, fontWeight: 800,
                    color: s.color, lineHeight: 1.1, letterSpacing: '-0.02em',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {s.isStr ? s.value : s.value || 0}
                    {s.suffix}
                  </div>
                  <div style={{
                    fontSize: 11, color: 'var(--text-tertiary)',
                    fontWeight: 500, marginTop: 2,
                    lineHeight: 1.3,
                    overflow: 'hidden', textOverflow: 'ellipsis',
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    wordBreak: 'break-word',
                  }}>
                    {s.title}
                  </div>
                </div>
              </div>
            </div>
          </Col>
        ))}
      </Row>

      {/* Daily Orders Chart */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={16}>
          <div style={chartCardStyle}>
            <div style={chartHeaderStyle}>{t('analytics.dailyOrders')}</div>
            <div style={chartBodyStyle}>
              <ResponsiveContainer width="100%" height={isMobile ? 220 : 280}>
                <AreaChart data={data.daily_orders}>
                  <defs>
                    <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={ACCENT} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradCompleted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis
                    dataKey="date" tickFormatter={(v) => v.slice(5)}
                    tick={{ fontSize: 11, fill: subTextColor }} stroke={gridColor}
                  />
                  <YAxis tick={{ fontSize: 11, fill: subTextColor }} stroke={gridColor} allowDecimals={false} />
                  <Tooltip {...customTooltip} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="total" stroke={ACCENT} fill="url(#gradTotal)" name={t('analytics.total')} strokeWidth={2} />
                  <Area type="monotone" dataKey="completed" stroke="#10b981" fill="url(#gradCompleted)" name={t('status.completed')} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Col>

        <Col xs={24} lg={8}>
          <div style={chartCardStyle}>
            <div style={chartHeaderStyle}>{t('analytics.ordersByStatus')}</div>
            <div style={chartBodyStyle}>
              <ResponsiveContainer width="100%" height={isMobile ? 260 : 280}>
                <PieChart>
                  <Pie
                    data={data.by_status.map((s) => ({ ...s, name: t('status.' + s.status) }))}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={isMobile ? 60 : 90}
                    innerRadius={isMobile ? 30 : 45}
                    paddingAngle={2}
                    label={isMobile ? ({ count }) => count : ({ name, count }) => `${name} (${count})`}
                    labelLine={isMobile ? false : { stroke: subTextColor }}
                  >
                    {data.by_status.map((s, i) => (
                      <Cell key={i} fill={STATUS_COLORS[s.status] || PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip {...customTooltip} />
                  {isMobile && <Legend wrapperStyle={{ fontSize: 11 }} />}
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Col>
      </Row>

      {/* Revenue & Category Breakdown */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <div style={chartCardStyle}>
            <div style={chartHeaderStyle}>{t('analytics.ordersByService')}</div>
            <div style={chartBodyStyle}>
              <ResponsiveContainer width="100%" height={isMobile ? 240 : 280}>
                <BarChart data={data.by_service} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: subTextColor }} stroke={gridColor} allowDecimals={false} />
                  <YAxis
                    dataKey="name" type="category" width={isMobile ? 110 : 140}
                    tick={{ fontSize: isMobile ? 10 : 11, fill: subTextColor }} stroke={gridColor}
                    interval={0}
                  />
                  <Tooltip {...customTooltip} />
                  <Bar dataKey="count" name={t('nav.orders')} radius={[0, 6, 6, 0]}>
                    {(data.by_service || []).map((entry, i) => (
                      <Cell key={i} fill={entry.color || PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Col>

        <Col xs={24} lg={12}>
          <div style={chartCardStyle}>
            <div style={chartHeaderStyle}>{t('analytics.revenueByService')}</div>
            <div style={chartBodyStyle}>
              {(data.revenue.by_service || []).length > 0 ? (
                <ResponsiveContainer width="100%" height={isMobile ? 240 : 280}>
                  <BarChart data={data.revenue.by_service} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis
                      type="number" tick={{ fontSize: 11, fill: subTextColor }} stroke={gridColor}
                      tickFormatter={(v) => `${currency.symbol}${v}`}
                    />
                    <YAxis
                      dataKey="name" type="category" width={isMobile ? 110 : 140}
                      tick={{ fontSize: isMobile ? 10 : 11, fill: subTextColor }} stroke={gridColor}
                      interval={0}
                    />
                    <Tooltip
                      {...customTooltip}
                      formatter={(value, name) => [`${currency.symbol}${Number(value).toLocaleString()}`, name]}
                    />
                    <Bar dataKey="revenue" name={`${t('analytics.revenue')} (${currency.symbol})`} fill="#f59e0b" radius={[0, 6, 6, 0]}>
                      {(data.revenue.by_service || []).map((entry, i) => (
                        <Cell key={i} fill={entry.color || PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>
                  {t('analytics.noRevenueData')}
                </div>
              )}
            </div>
          </div>
        </Col>
      </Row>

      {/* Monthly Trend */}
      <div style={{ ...chartCardStyle, marginBottom: 24 }}>
        <div style={chartHeaderStyle}>{t('analytics.monthlyTrend')}</div>
        <div style={chartBodyStyle}>
          <ResponsiveContainer width="100%" height={isMobile ? 220 : 260}>
            <LineChart data={data.monthly_orders}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis
                dataKey="month" tickFormatter={(v) => v.slice(5)}
                tick={{ fontSize: 11, fill: subTextColor }} stroke={gridColor}
              />
              <YAxis tick={{ fontSize: 11, fill: subTextColor }} stroke={gridColor} allowDecimals={false} />
              <Tooltip {...customTooltip} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="total" stroke={ACCENT} name={t('analytics.total')} strokeWidth={2.5} dot={{ r: 4, fill: ACCENT }} />
              <Line type="monotone" dataKey="completed" stroke="#10b981" name={t('status.completed')} strokeWidth={2.5} dot={{ r: 4, fill: '#10b981' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Urgency, Fleet, New Users */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={8}>
          <div style={chartCardStyle}>
            <div style={chartHeaderStyle}>{t('analytics.ordersByUrgency')}</div>
            <div style={chartBodyStyle}>
              <ResponsiveContainer width="100%" height={isMobile ? 220 : 220}>
                <PieChart>
                  <Pie
                    data={data.by_urgency.map((u) => ({
                      name: t('urgency.' + u.urgency),
                      count: u.count,
                      urgency: u.urgency,
                    }))}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={isMobile ? 55 : 70}
                    label={isMobile ? ({ count }) => count : ({ name, count }) => `${name} (${count})`}
                    labelLine={isMobile ? false : { stroke: subTextColor }}
                  >
                    {data.by_urgency.map((u, i) => (
                      <Cell key={i} fill={URGENCY_COLORS[u.urgency] || PIE_COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip {...customTooltip} />
                  {isMobile && <Legend wrapperStyle={{ fontSize: 11 }} />}
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Col>

        <Col xs={24} sm={12} lg={8}>
          <div style={chartCardStyle}>
            <div style={chartHeaderStyle}>{t('analytics.fleetStatus')}</div>
            <div style={chartBodyStyle}>
              <ResponsiveContainer width="100%" height={isMobile ? 220 : 220}>
                <PieChart>
                  <Pie
                    data={data.fleet_by_status.map((f) => ({
                      name: f.status === 'available' ? t('adminVehicles.available')
                        : f.status === 'in_use' ? t('adminVehicles.inUse')
                        : f.status === 'maintenance' ? t('adminVehicles.maintenance')
                        : f.status === 'retired' ? t('adminVehicles.retired')
                        : f.status,
                      count: f.count,
                      status: f.status,
                    }))}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={isMobile ? 55 : 70}
                    label={isMobile ? ({ count }) => count : ({ name, count }) => `${name} (${count})`}
                    labelLine={isMobile ? false : { stroke: subTextColor }}
                  >
                    {data.fleet_by_status.map((f, i) => (
                      <Cell key={i} fill={FLEET_STATUS_COLORS[f.status] || PIE_COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip {...customTooltip} />
                  {isMobile && <Legend wrapperStyle={{ fontSize: 11 }} />}
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Col>

        <Col xs={24} sm={24} lg={8}>
          <div style={chartCardStyle}>
            <div style={{ ...chartHeaderStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{t('analytics.newUsers')}</span>
              <UserAddOutlined style={{ color: 'var(--text-tertiary)', fontSize: 16 }} />
            </div>
            <div style={chartBodyStyle}>
              <ResponsiveContainer width="100%" height={isMobile ? 200 : 220}>
                <AreaChart data={data.new_users_daily}>
                  <defs>
                    <linearGradient id="gradUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={ACCENT_DARK} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={ACCENT_DARK} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis
                    dataKey="date" tickFormatter={(v) => v.slice(5)}
                    tick={{ fontSize: 10, fill: subTextColor }} stroke={gridColor}
                  />
                  <YAxis tick={{ fontSize: 10, fill: subTextColor }} stroke={gridColor} allowDecimals={false} />
                  <Tooltip {...customTooltip} />
                  <Area type="monotone" dataKey="count" stroke={ACCENT_DARK} fill="url(#gradUsers)" name={t('analytics.newUsers')} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Col>
      </Row>

      {/* Fleet by Category */}
      {data.fleet_by_category.length > 0 && (
        <div style={{ ...chartCardStyle, marginBottom: 24 }}>
          <div style={chartHeaderStyle}>{t('analytics.vehiclesByCategory')}</div>
          <div style={chartBodyStyle}>
            <ResponsiveContainer width="100%" height={Math.max(180, data.fleet_by_category.length * 36)}>
              <BarChart data={data.fleet_by_category} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis type="number" tick={{ fontSize: 11, fill: subTextColor }} stroke={gridColor} allowDecimals={false} />
                <YAxis
                  dataKey="name" type="category" width={isMobile ? 110 : 160}
                  tick={{ fontSize: isMobile ? 10 : 11, fill: subTextColor }} stroke={gridColor}
                  interval={0}
                />
                <Tooltip {...customTooltip} />
                <Bar dataKey="count" name={t('nav.vehicles')} radius={[0, 6, 6, 0]}>
                  {data.fleet_by_category.map((entry, i) => (
                    <Cell key={i} fill={entry.color || PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Orders by User Type & Top Customers */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={10}>
          <div style={chartCardStyle}>
            <div style={chartHeaderStyle}>{t('analytics.ordersByUserType')}</div>
            <div style={chartBodyStyle}>
              <ResponsiveContainer width="100%" height={isMobile ? 240 : 280}>
                <PieChart>
                  <Pie
                    data={(data.orders_by_user_type || []).map((d) => ({
                      name: d.user_type === 'company' ? t('analytics.companyUsers') : t('analytics.personalUsers'),
                      count: d.count,
                      user_type: d.user_type,
                    }))}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={isMobile ? 60 : 90}
                    innerRadius={isMobile ? 30 : 45}
                    paddingAngle={2}
                    label={isMobile ? ({ count }) => count : ({ name, count }) => `${name} (${count})`}
                    labelLine={isMobile ? false : { stroke: subTextColor }}
                  >
                    {(data.orders_by_user_type || []).map((d, i) => (
                      <Cell key={i} fill={USER_TYPE_COLORS[d.user_type] || PIE_COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip {...customTooltip} />
                  {isMobile && <Legend wrapperStyle={{ fontSize: 11 }} />}
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Col>

        <Col xs={24} lg={14}>
          <div style={chartCardStyle}>
            <div style={chartHeaderStyle}>{t('analytics.topCustomers')}</div>
            <div style={{ padding: '12px 16px 16px' }}>
              <Table
                size="small"
                pagination={false}
                rowKey="user_id"
                dataSource={topCustomers}
                locale={{ emptyText: t('common.noData') }}
                scroll={{ x: 'max-content' }}
                columns={[
                  {
                    title: t('analytics.customer'),
                    dataIndex: 'name',
                    ellipsis: true,
                    render: (name, r) => (
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span style={{
                          fontWeight: 600, color: 'var(--text-primary)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{name}</span>
                        <span style={{
                          fontSize: 11, color: 'var(--text-tertiary)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{r.email}</span>
                      </div>
                    ),
                  },
                  {
                    title: t('analytics.ordersByUserType').split(' ')[0],
                    dataIndex: 'user_type',
                    width: 90,
                    render: (type) => (
                      <Tag color={type === 'company' ? 'orange' : 'green'} style={{ margin: 0 }}>
                        {type === 'company' ? t('analytics.companyUsers') : t('analytics.personalUsers')}
                      </Tag>
                    ),
                  },
                  {
                    title: t('analytics.orders'),
                    dataIndex: 'orders',
                    width: 70,
                    align: 'right',
                    render: (v) => <span style={{ fontWeight: 600 }}>{v}</span>,
                  },
                  {
                    title: t('analytics.revenue'),
                    dataIndex: 'revenue',
                    width: 100,
                    align: 'right',
                    render: (v) => (
                      <span style={{ fontWeight: 600, color: '#f59e0b' }}>
                        {currency.symbol}{Number(v || 0).toLocaleString()}
                      </span>
                    ),
                  },
                ]}
              />
            </div>
          </div>
        </Col>
      </Row>

      {/* Revenue Trend */}
      {data.revenue.daily_trend.length > 0 && (
        <div style={{ ...chartCardStyle, marginBottom: 24 }}>
          <div style={chartHeaderStyle}>{t('analytics.dailyRevenue')}</div>
          <div style={chartBodyStyle}>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={data.revenue.daily_trend}>
                <defs>
                  <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis
                  dataKey="date" tickFormatter={(v) => v.slice(5)}
                  tick={{ fontSize: 11, fill: subTextColor }} stroke={gridColor}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: subTextColor }} stroke={gridColor}
                  tickFormatter={(v) => `${currency.symbol}${v}`}
                />
                <Tooltip
                  {...customTooltip}
                  formatter={(value) => [`${currency.symbol}${Number(value).toLocaleString()}`, t('analytics.revenue')]}
                />
                <Area type="monotone" dataKey="revenue" stroke="#f59e0b" fill="url(#gradRevenue)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
