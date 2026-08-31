import React, { useMemo } from 'react';
import { Typography, Tag, Spin } from 'antd';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea,
} from 'recharts';

import { useLang } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { formatDuration, steepnessColor } from '../../utils/elevation';

const { Text } = Typography;

const STEEP_WARNING_THRESHOLD = 8; // percent

/**
 * Renders an elevation chart + summary stats for a fetched truck route.
 * Pass the result of useTruckRoute() in directly.
 */
export default function ElevationProfile({
  loading,
  error,
  points,
  smoothedElevations,
  cumulativeKm,
  steepnessSegments,
  summary,
}) {
  const { t } = useLang();
  const { isDark } = useTheme();

  const chartData = useMemo(() => {
    if (!Array.isArray(points) || points.length === 0) return [];
    return points.map((p, i) => ({
      km: Number((cumulativeKm[i] || 0).toFixed(3)),
      elevation: Math.round(smoothedElevations[i] ?? p[2] ?? 0),
    }));
  }, [points, cumulativeKm, smoothedElevations]);

  const segmentBands = useMemo(() => {
    if (!Array.isArray(steepnessSegments) || !cumulativeKm.length) return [];
    return steepnessSegments
      .filter(([s, e]) => s != null && e != null && cumulativeKm[s] != null && cumulativeKm[e] != null)
      .map(([s, e, cat], idx) => ({
        key: `seg-${idx}`,
        x1: cumulativeKm[s],
        x2: cumulativeKm[e],
        color: steepnessColor(cat),
      }));
  }, [steepnessSegments, cumulativeKm]);

  if (error) {
    return (
      <div style={panelStyle(isDark)}>
        <Text type="danger" style={{ fontSize: 13 }}>
          {errorMessage(t, error.code)}
        </Text>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ ...panelStyle(isDark), textAlign: 'center', padding: 32 }}>
        <Spin />
        <div style={{ marginTop: 12, color: 'var(--text-tertiary)', fontSize: 13 }}>
          {t('routeProfile.loading')}
        </div>
      </div>
    );
  }

  if (!summary || chartData.length < 2) return null;

  const { distanceKm, durationSec, ascentM, descentM, maxGradePct } = summary;
  const isSteep = maxGradePct >= STEEP_WARNING_THRESHOLD;

  return (
    <div style={panelStyle(isDark)}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12, flexWrap: 'wrap', gap: 8,
      }}>
        <Text strong style={{ fontSize: 14 }}>{t('routeProfile.title')}</Text>
        {isSteep && (
          <Tag color="warning" style={{ margin: 0 }}>
            {t('routeProfile.steepWarning', { grade: maxGradePct.toFixed(1) })}
          </Tag>
        )}
      </div>

      <div style={{
        display: 'grid', gap: 12, marginBottom: 16,
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
      }}>
        <Stat label={t('routeProfile.distance')} value={`${distanceKm.toFixed(1)} km`} />
        <Stat label={t('routeProfile.duration')} value={formatDuration(durationSec)} />
        <Stat label={t('routeProfile.ascent')} value={`${Math.round(ascentM)} m`} />
        <Stat label={t('routeProfile.descent')} value={`${Math.round(descentM)} m`} />
        <Stat
          label={t('routeProfile.maxGrade')}
          value={`${maxGradePct.toFixed(1)}%`}
          accent={isSteep ? '#f97316' : undefined}
        />
      </div>

      <div style={{ width: '100%', height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="elevGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.45} />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
              </linearGradient>
            </defs>

            {segmentBands.map((b) => (
              <ReferenceArea
                key={b.key}
                x1={b.x1}
                x2={b.x2}
                strokeOpacity={0}
                fill={b.color}
                fillOpacity={0.18}
                ifOverflow="extendDomain"
              />
            ))}

            <XAxis
              dataKey="km"
              type="number"
              domain={[0, 'dataMax']}
              tickFormatter={(v) => `${v.toFixed(0)}`}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: isDark ? '#6b7280' : '#9ca3af' }}
              label={{
                value: 'km', position: 'insideBottomRight', offset: -2,
                style: { fontSize: 11, fill: isDark ? '#6b7280' : '#9ca3af' },
              }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: isDark ? '#6b7280' : '#9ca3af' }}
              width={40}
              tickFormatter={(v) => `${v}`}
            />
            <Tooltip
              contentStyle={{
                background: isDark ? '#1a1c24' : '#fff',
                border: `1px solid ${isDark ? '#1f2128' : '#e5e7eb'}`,
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: isDark ? '#e8e8e8' : '#333', fontWeight: 600 }}
              formatter={(v) => [`${v} m`, t('routeProfile.elevation')]}
              labelFormatter={(v) => `${Number(v).toFixed(2)} km`}
            />
            <Area
              type="monotone"
              dataKey="elevation"
              stroke="var(--accent)"
              strokeWidth={2}
              fill="url(#elevGradient)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 12,
        marginTop: 10, fontSize: 11, color: 'var(--text-tertiary)',
      }}>
        <LegendDot color={steepnessColor(0)} label={t('routeProfile.legend.flat')} />
        <LegendDot color={steepnessColor(1)} label={t('routeProfile.legend.moderate')} />
        <LegendDot color={steepnessColor(2)} label={t('routeProfile.legend.steep')} />
        <LegendDot color={steepnessColor(3)} label={t('routeProfile.legend.verySteep')} />
      </div>
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: accent || 'var(--text-primary)' }}>
        {value}
      </div>
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        width: 10, height: 10, borderRadius: 2, background: color, display: 'inline-block',
      }} />
      {label}
    </span>
  );
}

function panelStyle(isDark) {
  return {
    background: 'var(--card-bg)',
    border: `1px solid ${isDark ? '#1f2128' : '#f0f0f0'}`,
    borderRadius: 12,
    padding: 16,
  };
}

function errorMessage(t, code) {
  switch (code) {
    case 'missing_key': return t('routeProfile.errors.missingKey');
    case 'no_route': return t('routeProfile.errors.noRoute');
    case 'rate_limited': return t('routeProfile.errors.rateLimited');
    case 'invalid_input': return t('routeProfile.errors.invalidInput');
    case 'unauthorized': return t('routeProfile.errors.unauthorized');
    default: return t('routeProfile.errors.network');
  }
}
