import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { History } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { adminAudit, type AdminAction } from '@/lib/audit-api';

const formatRelative = (iso: string, locale: string): string => {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const min = 60_000;
  const hour = 60 * min;
  const day = 24 * hour;
  if (diff < min) return locale === 'ka' ? 'ეხლა' : 'just now';
  if (diff < hour) {
    const m = Math.floor(diff / min);
    return locale === 'ka' ? `${m} წთ წინ` : `${m}m ago`;
  }
  if (diff < day) {
    const h = Math.floor(diff / hour);
    return locale === 'ka' ? `${h} სთ წინ` : `${h}h ago`;
  }
  if (diff < 7 * day) {
    const d = Math.floor(diff / day);
    return locale === 'ka' ? `${d} დღის წინ` : `${d}d ago`;
  }
  return new Date(iso).toLocaleDateString();
};

const ActivityFeed = ({
  targetType,
  targetId,
  reloadKey,
}: {
  targetType: 'order' | 'user' | 'product' | 'discount';
  targetId: number;
  // Bump this to refetch (e.g. after a mutation on the same page)
  reloadKey?: unknown;
}) => {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<AdminAction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminAudit
      .list(targetType, targetId, 30)
      .then((res) => {
        if (!cancelled) setItems(res);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [targetType, targetId, reloadKey]);

  return (
    <Card className="p-6">
      <h2 className="font-serif text-lg font-medium mb-4 inline-flex items-center gap-2">
        <History size={18} className="text-gold" />
        {t('admin.activity.title', { defaultValue: 'Activity' })}
      </h2>
      {loading && items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t('admin.common.loading', { defaultValue: 'Loading…' })}
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t('admin.activity.empty', { defaultValue: 'No activity yet.' })}
        </p>
      ) : (
        <ol className="space-y-3 text-sm">
          {items.map((a) => (
            <li key={a.id} className="border-l-2 border-gold/40 pl-3">
              <p className="font-medium">
                {t(`admin.activity.verb.${a.verb}`, { defaultValue: a.verb.replace(/_/g, ' ') })}
              </p>
              {a.summary && <p className="text-xs text-muted-foreground">{a.summary}</p>}
              <p className="mt-0.5 text-xs text-muted-foreground">
                {a.actorName || a.actorEmail || t('admin.activity.system', { defaultValue: 'system' })}
                {' · '}
                {formatRelative(a.createdAt, i18n.language)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
};

export default ActivityFeed;
