import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Table, Select, Button, Input, Typography, Space, Grid, Empty, Badge, DatePicker, TimePicker,
  Modal, message, Tag, Tabs,
} from 'antd';
import {
  EyeOutlined, SearchOutlined, RightOutlined, FilterOutlined, UserOutlined,
  CloseOutlined, DownloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../api/client';
import { StatusBadge, UrgencyBadge } from '../../components/common/StatusBadge';
import { buildStatusOptions, buildUrgencyOptions } from '../../utils/status';
import { useLang } from '../../contexts/LanguageContext';
import { useRealtimeRefresh, useNotifications } from '../../contexts/NotificationContext';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

export default function AdminOrdersPage({ historyMode = false }) {
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const { t, lang } = useLang();
  const localized = (v) => {
    if (!v) return '';
    if (typeof v === 'string') return v;
    return v[lang] || v['en'] || '';
  };
  const [searchParams, setSearchParams] = useSearchParams();
  const { viewCounts } = useNotifications();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [categories, setCategories] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [search, setSearch] = useState('');
  // Server-side sort. Stored as a DRF-style `ordering` string: e.g.
  // `requested_date` (ascending) or `-status` (descending). Backend
  // whitelist lives in OrdersAdminListView.ordering_fields.
  const [ordering, setOrdering] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportRange, setExportRange] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [rowExportingId, setRowExportingId] = useState(null);

  // Re-translate filter options when the UI language changes.
  const statusOptions = useMemo(() => buildStatusOptions(t), [t, lang]);
  const urgencyOptions = useMemo(() => buildUrgencyOptions(t), [t, lang]);

  useEffect(() => {
    api.get('/services/').then(({ data }) => {
      setCategories(Array.isArray(data) ? data : data.results || []);
    });
    api.get('/vehicles/admin/').then(({ data }) => {
      const results = data.results || data;
      setVehicles(Array.isArray(results) ? results : []);
    }).catch(() => {});
  }, []);

  const fetchOrders = useCallback((page = 1, { silent = false } = {}) => {
    if (!silent) setLoading(true);
    const params = { page };

    const status = searchParams.get('status');
    const urgency = searchParams.get('urgency');
    const service = searchParams.get('service');
    const userId = searchParams.get('user_id');
    const requestedDateFrom = searchParams.get('requested_date_from');
    const requestedDateTo = searchParams.get('requested_date_to');
    const requestedTime = searchParams.get('requested_time');
    const vehicleId = searchParams.get('vehicle');

    if (status) params.status = status;
    if (urgency) params.urgency = urgency;
    if (service) params.selected_service = service;
    if (userId) params.user_id = userId;
    if (requestedDateFrom) params.requested_date_from = requestedDateFrom;
    if (requestedDateTo) params.requested_date_to = requestedDateTo;
    if (requestedTime) params.requested_time = requestedTime;
    if (vehicleId) params.assigned_vehicle = vehicleId;
    if (search) params.search = search;
    if (ordering) params.ordering = ordering;
    const view = searchParams.get('view');
    if (view) params.view = view;

    if (historyMode) {
      if (!status) params.status = 'completed';
    }

    return api.get('/orders/admin/', { params }).then(({ data }) => {
      const results = data.results || data;
      setOrders(Array.isArray(results) ? results : []);
      setPagination((p) => ({ ...p, current: page, total: data.count || results.length }));
    }).catch(() => {})
      .finally(() => { if (!silent) setLoading(false); });
  }, [searchParams, search, historyMode, ordering]);

  useEffect(() => { fetchOrders(); }, [searchParams, historyMode, ordering]); // eslint-disable-line

  // Debounced search-as-you-type. Skip the first render so the searchParams
  // effect above isn't followed by a duplicate fetch on initial load.
  const firstSearchRef = useRef(true);
  useEffect(() => {
    if (firstSearchRef.current) {
      firstSearchRef.current = false;
      return;
    }
    const handler = setTimeout(() => fetchOrders(1), 350);
    return () => clearTimeout(handler);
  }, [search]); // eslint-disable-line

  useRealtimeRefresh(useCallback(() => {
    fetchOrders(pagination.current, { silent: true });
  }, [fetchOrders, pagination.current]));

  const updateFilter = (key, val) => {
    const params = Object.fromEntries(searchParams.entries());
    if (val) params[key] = val; else delete params[key];
    setSearchParams(params);
  };

  const triggerDownload = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const filenameFromHeaders = (headers, fallback) => {
    const disposition = headers?.['content-disposition'] || '';
    const match = /filename="?([^";]+)"?/.exec(disposition);
    return match ? match[1] : fallback;
  };

  const buildActiveFilterParams = ({ includeHistoryDefault = true } = {}) => {
    const params = {};
    const status = searchParams.get('status');
    const urgency = searchParams.get('urgency');
    const service = searchParams.get('service');
    const userId = searchParams.get('user_id');
    const requestedDateFrom = searchParams.get('requested_date_from');
    const requestedDateTo = searchParams.get('requested_date_to');
    const requestedTime = searchParams.get('requested_time');
    const vehicleId = searchParams.get('vehicle');

    if (status) params.status = status;
    if (urgency) params.urgency = urgency;
    if (service) params.selected_service = service;
    if (userId) params.user_id = userId;
    if (requestedDateFrom) params.requested_date_from = requestedDateFrom;
    if (requestedDateTo) params.requested_date_to = requestedDateTo;
    if (requestedTime) params.requested_time = requestedTime;
    if (vehicleId) params.assigned_vehicle = vehicleId;
    if (search) params.search = search;
    if (historyMode && includeHistoryDefault && !status) params.status = 'completed';
    return params;
  };

  // Count only user-selected filters; the implicit history-mode `completed`
  // filter shouldn't show up in the "N filters will be applied" chip.
  const activeFilterCount = Object.keys(buildActiveFilterParams({ includeHistoryDefault: false })).length;

  const buildActiveFilterChips = () => {
    const chips = [];
    if (search) {
      chips.push({
        key: 'search',
        icon: <SearchOutlined />,
        label: search,
        onClose: () => setSearch(''),
      });
    }
    const statusVal = searchParams.get('status');
    if (statusVal) {
      chips.push({
        key: 'status',
        label: `${t('adminOrders.status')}: ${t('status.' + statusVal)}`,
        onClose: () => updateFilter('status', null),
      });
    }
    const urgencyVal = searchParams.get('urgency');
    if (urgencyVal) {
      chips.push({
        key: 'urgency',
        label: `${t('adminOrders.urgencyLabel')}: ${t('urgency.' + urgencyVal)}`,
        onClose: () => updateFilter('urgency', null),
      });
    }
    const serviceVal = searchParams.get('service');
    if (serviceVal) {
      const cat = categories.find((c) => String(c.id) === serviceVal);
      chips.push({
        key: 'service',
        label: `${t('adminOrders.service')}: ${localized(cat?.name) || `#${serviceVal}`}`,
        onClose: () => updateFilter('service', null),
      });
    }
    const vehicleVal = searchParams.get('vehicle');
    if (vehicleVal) {
      const v = vehicles.find((vv) => String(vv.id) === vehicleVal);
      chips.push({
        key: 'vehicle',
        label: `${t('adminOrders.vehicle')}: ${v ? `${v.name} (${v.plate_number})` : `#${vehicleVal}`}`,
        onClose: () => updateFilter('vehicle', null),
      });
    }
    const dateFrom = searchParams.get('requested_date_from');
    const dateTo = searchParams.get('requested_date_to');
    if (dateFrom && dateTo) {
      chips.push({
        key: 'date_range',
        label: `${t('orders.date')}: ${dateFrom} → ${dateTo}`,
        onClose: () => {
          const params = Object.fromEntries(searchParams.entries());
          delete params.requested_date_from;
          delete params.requested_date_to;
          setSearchParams(params);
        },
      });
    }
    const timeVal = searchParams.get('requested_time');
    if (timeVal) {
      chips.push({
        key: 'time',
        label: `${t('orders.time')}: ${timeVal}`,
        onClose: () => updateFilter('requested_time', null),
      });
    }
    return chips;
  };

  const activeFilterChips = buildActiveFilterChips();

  const handleExportOrders = async () => {
    const params = buildActiveFilterParams();
    if (exportRange && exportRange[0] && exportRange[1]) {
      params.date_from = exportRange[0].format('YYYY-MM-DD');
      params.date_to = exportRange[1].format('YYYY-MM-DD');
    }
    setExporting(true);
    try {
      const resp = await api.get('/orders/admin/export/', { params, responseType: 'blob' });
      const filename = filenameFromHeaders(resp.headers, `orders_${dayjs().format('YYYYMMDD_HHmm')}.csv`);
      triggerDownload(resp.data, filename);
      setExportOpen(false);
    } catch {
      message.error(t('adminOrders.exportFailed'));
    } finally {
      setExporting(false);
    }
  };

  const handleExportOrder = async (e, orderId) => {
    e.stopPropagation();
    setRowExportingId(orderId);
    try {
      const resp = await api.get(`/orders/admin/${orderId}/export/`, { responseType: 'blob' });
      const filename = filenameFromHeaders(resp.headers, `order_${orderId}.csv`);
      triggerDownload(resp.data, filename);
    } catch {
      message.error(t('adminOrders.exportFailed'));
    } finally {
      setRowExportingId(null);
    }
  };

  const isMobile = !screens.md;

  // Map AntD column identifiers to DRF ordering field names. The date column
  // uses key='date_time' for React reconciliation but ships back as
  // `requested_date` to match the backend whitelist.
  const SORT_FIELD_MAP = {
    id: 'id',
    requested_date: 'requested_date',
    date_time: 'requested_date',
    status: 'status',
    urgency: 'urgency',
  };
  const sortOrderFor = (backendField) => {
    if (!ordering) return null;
    const fieldName = ordering.startsWith('-') ? ordering.slice(1) : ordering;
    if (fieldName !== backendField) return null;
    return ordering.startsWith('-') ? 'descend' : 'ascend';
  };
  const handleTableChange = (paginationCfg, _filters, sorter, extra) => {
    if (extra?.action === 'sort') {
      const key = sorter?.field || sorter?.columnKey;
      const backendField = SORT_FIELD_MAP[key];
      if (sorter?.order && backendField) {
        setOrdering(sorter.order === 'descend' ? `-${backendField}` : backendField);
      } else {
        setOrdering(null);
      }
      return;
    }
    if (paginationCfg?.current) fetchOrders(paginationCfg.current);
  };

  const columns = [
    {
      title: 'ID', dataIndex: 'id', width: 90,
      sorter: true,
      sortOrder: sortOrderFor('id'),
      render: (id, record) => (
        <span style={{ fontWeight: 600, color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {record.is_unread && (
            <span
              title={t('notifications.unread')}
              style={{
                display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
                background: '#ef4444', boxShadow: '0 0 0 3px rgba(239,68,68,0.18)',
              }}
            />
          )}
          #{id}
        </span>
      ),
    },
    {
      title: t('adminOrders.customer'),
      key: 'customer',
      width: 240,
      render: (_, r) => {
        // Show the customer's account name when present, fall back to the
        // contact_name typed on the order. Secondary line lists email +
        // phone (account first, contact second), separated by · and trimmed
        // to one line so the row stays compact.
        const primaryName = r.user_full_name || r.contact_name || '—';
        const phone = r.user_phone || r.contact_phone;
        const meta = [r.user_email, phone].filter(Boolean).join(' · ');
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0, lineHeight: 1.3 }}>
            <span style={{
              fontWeight: 600, color: 'var(--text-primary)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {primaryName}
            </span>
            {meta && (
              <span style={{
                fontSize: 11, color: 'var(--text-tertiary)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {meta}
              </span>
            )}
          </div>
        );
      },
    },
    { title: t('adminOrders.service'), dataIndex: 'selected_category_name', width: 140, ellipsis: true, render: (v) => localized(v) },
    {
      title: t('orders.date'),
      key: 'date_time',
      dataIndex: 'requested_date',
      sorter: true,
      sortOrder: sortOrderFor('requested_date'),
      width: 140,
      render: (_, r) => (
        <span>
          {r.requested_date || '—'}
          {r.requested_time && (
            <span style={{ color: 'var(--text-tertiary)', marginLeft: 6 }}>
              {/* DB ships HH:MM:SS — strip seconds for display. */}
              {String(r.requested_time).slice(0, 5)}
            </span>
          )}
        </span>
      ),
    },
    { title: t('adminOrders.status'), dataIndex: 'status', width: 130, sorter: true, sortOrder: sortOrderFor('status'), render: (s) => <StatusBadge status={s} /> },
    { title: t('adminOrders.urgencyLabel'), dataIndex: 'urgency', width: 100, sorter: true, sortOrder: sortOrderFor('urgency'), render: (u) => <UrgencyBadge urgency={u} /> },
    {
      title: '', width: 90,
      render: (_, r) => (
        <Space size={0}>
          <Button
            type="text"
            icon={<DownloadOutlined />}
            loading={rowExportingId === r.id}
            onClick={(e) => handleExportOrder(e, r.id)}
            title={t('adminOrders.downloadOrder')}
            style={{ color: 'var(--text-secondary)' }}
          />
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/admin/orders/${r.id}`)}
            style={{ color: 'var(--accent)' }}
          />
        </Space>
      ),
    },
  ];

  const hasMore = pagination.current * pagination.pageSize < pagination.total;

  return (
    <div className="page-enter">
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, margin: '0 0 24px 0', flexWrap: 'wrap',
      }}>
        <Title level={3} style={{
          margin: 0, fontWeight: 800,
          letterSpacing: '-0.02em', color: 'var(--text-primary)',
        }}>
          {historyMode ? t('adminOrders.orderHistory') : t('adminOrders.activeOrders')}
        </Title>
        <Button
          icon={<DownloadOutlined />}
          onClick={() => setExportOpen(true)}
          style={{ borderRadius: 10, fontWeight: 600 }}
        >
          {t('adminOrders.exportOrders')}
        </Button>
      </div>

      <Modal
        title={t('adminOrders.exportOrdersTitle')}
        open={exportOpen}
        onCancel={() => setExportOpen(false)}
        onOk={handleExportOrders}
        okText={t('adminOrders.downloadCsv')}
        cancelText={t('common.cancel')}
        confirmLoading={exporting}
        width={isMobile ? '94vw' : 520}
        styles={{
          content: { borderRadius: 16 },
          body: { padding: isMobile ? '12px 18px 18px' : '16px 24px 24px' },
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Text style={{ color: 'var(--text-secondary)' }}>
            {t('adminOrders.exportDateHint')}
          </Text>
          <DatePicker.RangePicker
            value={exportRange}
            onChange={(range) => setExportRange(range)}
            style={{ width: '100%' }}
            allowClear
          />
          {activeFilterCount > 0 && (
            <div style={{
              background: 'var(--accent-bg, rgba(0, 184, 86, 0.08))',
              border: '1px solid var(--accent)',
              borderRadius: 10,
              padding: '10px 12px',
              display: 'flex', alignItems: 'flex-start', gap: 8,
            }}>
              <FilterOutlined style={{ color: 'var(--accent)', marginTop: 2 }} />
              <Text style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                {t('adminOrders.exportFiltersNotice', { count: activeFilterCount })}
              </Text>
            </div>
          )}
        </div>
      </Modal>

      {/* User filter banner */}
      {searchParams.get('user_id') && (
        <div style={{
          background: 'var(--accent-bg, rgba(0, 184, 86, 0.08))',
          border: '1px solid var(--accent)',
          borderRadius: 12,
          padding: '10px 16px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserOutlined style={{ color: 'var(--accent)', fontSize: 15 }} />
            <Text style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>
              {t('adminOrders.showingOrdersFor', { name: searchParams.get('user_name') || `#${searchParams.get('user_id')}` })}
            </Text>
          </div>
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined />}
            onClick={() => {
              const params = Object.fromEntries(searchParams.entries());
              delete params.user_id;
              delete params.user_name;
              setSearchParams(params);
            }}
            style={{ color: 'var(--text-tertiary)' }}
          />
        </div>
      )}

      {/* Saved-view tabs — replace the binary Active/History toggle with
          the dispatcher's mental model. Counts come from the admin
          notifications endpoint and stay live via the realtime poll. */}
      {(() => {
        const view = searchParams.get('view') || 'all';
        const activeKey = historyMode ? 'history' : view;
        const tabSpecs = [
          { key: 'all', label: t('adminOrders.tabAll'), countKey: 'all' },
          { key: 'unread', label: t('adminOrders.tabUnread'), countKey: 'unread' },
          { key: 'awaiting_price', label: t('adminOrders.tabAwaitingPrice'), countKey: 'awaiting_price' },
          { key: 'pending_customer', label: t('adminOrders.tabPendingCustomer'), countKey: 'pending_customer' },
          { key: 'today', label: t('adminOrders.tabToday'), countKey: 'today' },
          { key: 'in_progress', label: t('adminOrders.tabInProgress'), countKey: 'in_progress' },
          { key: 'history', label: t('adminOrders.tabHistory'), countKey: 'history' },
        ];
        const renderLabel = (spec) => {
          const count = viewCounts?.[spec.countKey] ?? 0;
          return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {spec.label}
              {count > 0 && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  minWidth: 20, height: 18, padding: '0 6px',
                  fontSize: 11, fontWeight: 700, lineHeight: 1,
                  borderRadius: 9,
                  background: spec.key === activeKey ? 'var(--accent)' : 'var(--bg-tertiary)',
                  color: spec.key === activeKey ? '#fff' : 'var(--text-secondary)',
                }}>
                  {count}
                </span>
              )}
            </span>
          );
        };
        const handleTabChange = (key) => {
          if (key === 'history') {
            navigate('/admin/history');
            return;
          }
          if (historyMode) {
            // Leaving history → land on the active list with the picked view.
            const params = key === 'all' ? '' : `?view=${key}`;
            navigate(`/admin/orders${params}`);
            return;
          }
          // Replace just the `view` param; keep the rest of the filters.
          const params = Object.fromEntries(searchParams.entries());
          if (key === 'all') delete params.view;
          else params.view = key;
          setSearchParams(params);
        };
        return (
          <Tabs
            activeKey={activeKey}
            onChange={handleTabChange}
            items={tabSpecs.map((s) => ({ key: s.key, label: renderLabel(s) }))}
            style={{ marginBottom: 12 }}
            tabBarStyle={{ marginBottom: 0 }}
          />
        );
      })()}

      {/* Filter bar */}
      <div style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: 14,
        padding: isMobile ? '14px 16px' : '16px 20px',
        marginBottom: 20,
        boxShadow: 'var(--shadow-xs)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          marginBottom: 12, color: 'var(--text-tertiary)',
        }}>
          <FilterOutlined style={{ fontSize: 13 }} />
          <Text style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('common.filters')}
          </Text>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: isMobile ? 8 : 12,
        }}>
          <Input
            placeholder={t('adminOrders.searchUsers')}
            prefix={<SearchOutlined style={{ color: 'var(--text-tertiary)' }} />}
            allowClear
            style={{ width: '100%', borderRadius: 10 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size={isMobile ? 'large' : 'middle'}
          />
          <Select
            placeholder={t('adminOrders.status')}
            allowClear
            style={{ width: '100%', borderRadius: 10 }}
            value={searchParams.get('status') || undefined}
            onChange={(val) => updateFilter('status', val)}
            options={statusOptions}
          />
          <Select
            placeholder={t('adminOrders.urgencyLabel')}
            allowClear
            style={{ width: '100%' }}
            value={searchParams.get('urgency') || undefined}
            onChange={(val) => updateFilter('urgency', val)}
            options={urgencyOptions}
          />
          <Select
            placeholder={t('adminOrders.service')}
            allowClear
            style={{ width: '100%' }}
            value={searchParams.get('service') || undefined}
            onChange={(val) => updateFilter('service', val)}
            showSearch
            filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
            options={categories.map((c) => ({ value: String(c.id), label: localized(c.name) }))}
          />
          <Select
            placeholder={t('adminOrders.vehicle')}
            allowClear
            style={{ width: '100%' }}
            value={searchParams.get('vehicle') || undefined}
            onChange={(val) => updateFilter('vehicle', val)}
            showSearch
            filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
            options={vehicles.map((v) => ({
              value: String(v.id),
              label: `${v.name} (${v.plate_number})`,
            }))}
          />
          <DatePicker.RangePicker
            value={[
              searchParams.get('requested_date_from') ? dayjs(searchParams.get('requested_date_from')) : null,
              searchParams.get('requested_date_to') ? dayjs(searchParams.get('requested_date_to')) : null,
            ]}
            onChange={(range) => {
              const params = Object.fromEntries(searchParams.entries());
              if (range && range[0] && range[1]) {
                params.requested_date_from = range[0].format('YYYY-MM-DD');
                params.requested_date_to = range[1].format('YYYY-MM-DD');
              } else {
                delete params.requested_date_from;
                delete params.requested_date_to;
              }
              setSearchParams(params);
            }}
            placeholder={[t('orders.date'), t('orders.date')]}
            style={{ width: '100%', borderRadius: 10 }}
          />
          <TimePicker
            format="HH:mm"
            value={searchParams.get('requested_time')
              ? dayjs(searchParams.get('requested_time'), 'HH:mm')
              : null}
            onChange={(val) => {
              updateFilter('requested_time', val ? val.format('HH:mm') : null);
            }}
            placeholder={t('orders.time')}
            style={{ width: '100%', borderRadius: 10 }}
          />
        </div>
      </div>

      {activeFilterChips.length > 0 && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 20,
        }}>
          {activeFilterChips.map((chip) => (
            <Tag
              key={chip.key}
              closable
              icon={chip.icon}
              onClose={(e) => { e.preventDefault(); chip.onClose(); }}
              style={{
                padding: '4px 10px',
                borderRadius: 8,
                fontSize: 13,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                margin: 0,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {chip.label}
            </Tag>
          ))}
          <Button
            type="link"
            size="small"
            icon={<CloseOutlined />}
            onClick={() => {
              setSearch('');
              const params = Object.fromEntries(searchParams.entries());
              [
                'status', 'urgency', 'service', 'vehicle',
                'requested_date_from', 'requested_date_to', 'requested_time',
              ].forEach((k) => delete params[k]);
              setSearchParams(params);
            }}
            style={{ padding: '0 8px', height: 28, fontWeight: 500 }}
          >
            {t('common.clearFilters')}
          </Button>
        </div>
      )}

      {/* Content */}
      {isMobile ? (
        <>
          {loading && orders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>
              {t('common.loading')}
            </div>
          ) : orders.length === 0 ? (
            <Empty description={t('adminOrders.noOrdersFound')} />
          ) : (
            <>
              {orders.map((order) => (
                <div
                  key={order.id}
                  onClick={() => navigate(`/admin/orders/${order.id}`)}
                  style={{
                    background: 'var(--card-bg)',
                    border: `1px solid ${order.is_unread ? 'var(--accent)' : 'var(--border-color)'}`,
                    borderRadius: 14,
                    padding: '14px 16px',
                    marginBottom: 10,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                  }}
                >
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', marginBottom: 8,
                  }}>
                    <Text style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {order.is_unread && (
                        <span style={{
                          display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                          background: '#ef4444', boxShadow: '0 0 0 3px rgba(239,68,68,0.18)',
                        }} />
                      )}
                      #{order.id}
                    </Text>
                    <Space size={6} wrap={false}>
                      <UrgencyBadge urgency={order.urgency} />
                      <StatusBadge status={order.status} />
                    </Space>
                  </div>
                  {(order.user_full_name || order.contact_name) && (
                    <div style={{
                      fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      <UserOutlined style={{ fontSize: 11, color: 'var(--text-tertiary)' }} />
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {order.user_full_name || order.contact_name}
                      </span>
                      {(order.user_phone || order.contact_phone) && (
                        <span style={{ color: 'var(--text-tertiary)' }}>
                          · {order.user_phone || order.contact_phone}
                        </span>
                      )}
                    </div>
                  )}
                  <div style={{
                    fontSize: 14, fontWeight: 500,
                    color: 'var(--text-primary)', marginBottom: 6,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {order.pickup_location}
                  </div>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <Text style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                      {order.requested_date}
                      {order.requested_time && ` ${String(order.requested_time).slice(0, 5)}`}
                      {' · '}{localized(order.selected_category_name) || '—'}
                    </Text>
                    <Space size={0}>
                      <Button
                        type="text"
                        size="small"
                        icon={<DownloadOutlined />}
                        loading={rowExportingId === order.id}
                        onClick={(e) => handleExportOrder(e, order.id)}
                        title={t('adminOrders.downloadOrder')}
                        style={{ color: 'var(--text-tertiary)' }}
                      />
                      <RightOutlined style={{ color: 'var(--text-tertiary)', fontSize: 11 }} />
                    </Space>
                  </div>
                </div>
              ))}
              {hasMore && (
                <Button
                  block
                  loading={loading}
                  onClick={() => fetchOrders(pagination.current + 1)}
                  style={{
                    marginTop: 12, height: 46, borderRadius: 12,
                    fontWeight: 600, border: '1px solid var(--border-color)',
                  }}
                >
                  {t('common.loadMore')}
                </Button>
              )}
            </>
          )}
        </>
      ) : (
        <div style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border-color)',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: 'var(--shadow-xs)',
        }}>
          <Table
            columns={columns}
            dataSource={orders}
            rowKey="id"
            loading={loading}
            size="middle"
            scroll={{ x: 'max-content' }}
            pagination={{
              ...pagination,
              showSizeChanger: false,
              style: { padding: '0 16px' },
            }}
            onChange={handleTableChange}
            onRow={(record) => ({
              onClick: () => navigate(`/admin/orders/${record.id}`),
              style: { cursor: 'pointer' },
            })}
          />
        </div>
      )}
    </div>
  );
}
