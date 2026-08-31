import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, Plus, Save, Star, X } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Input } from '@/components/Input';
import { SectionError } from '@/components/SectionError';
import {
  useAdminLanding,
  useAdminUpdateLanding,
  type LandingContent,
} from '@/features/admin/cms-hooks';
import { useAdminPublishedReviewsAll, type AdminReview } from '@/features/admin/reviews-hooks';
import { cn } from '@/lib/cn';

type Edits = Partial<LandingContent>;

export function AdminLanding() {
  const { t } = useTranslation('admin');
  const landing = useAdminLanding();
  const { data, isLoading } = landing;
  const update = useAdminUpdateLanding();
  const [edits, setEdits] = useState<Edits>({});

  const merged = useMemo<LandingContent | null>(() => {
    if (!data) return null;
    return { ...data, ...edits };
  }, [data, edits]);

  const dirty = Object.keys(edits).length > 0;

  const setField = <K extends keyof LandingContent>(k: K, v: LandingContent[K]) =>
    setEdits((prev) => ({ ...prev, [k]: v }));

  const onSave = async () => {
    if (!dirty) return;
    try {
      await update.mutateAsync(edits);
      setEdits({});
    } catch {
      /* surfaced */
    }
  };

  if (isLoading || landing.isError || !merged) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          eyebrow={t('page.landing')}
          title={t('page.landing')}
          subtitle={t('landing_page.subtitle')}
        />
        {landing.isError ? (
          <SectionError error={landing.error} onRetry={() => landing.refetch()} />
        ) : (
          <Card>
            <p role="status" aria-live="polite" className="text-ink-muted text-sm">
              {t('actions.loading')}
            </p>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={t('page.landing')}
        title={t('page.landing')}
        subtitle={t('landing_page.subtitle')}
        actions={
          <Button
            onClick={onSave}
            disabled={!dirty}
            loading={update.isPending}
            variant="accent"
            className="rounded-pill"
          >
            <Save className="h-4 w-4" />
            {t('landing_page.save')}
          </Button>
        }
      />

      <Card>
        <h2 className="font-display text-xl mb-4 tracking-tight">
          {t('landing_page.section_hero')}
        </h2>
        <div className="grid md:grid-cols-2 gap-3">
          <Input
            label={t('landing_page.f_heading_ka')}
            value={merged.hero_heading_ka}
            onChange={(e) => setField('hero_heading_ka', e.target.value)}
          />
          <Input
            label={t('landing_page.f_heading_en')}
            value={merged.hero_heading_en}
            onChange={(e) => setField('hero_heading_en', e.target.value)}
          />
          <Input
            label={t('landing_page.f_subheading_ka')}
            value={merged.hero_subheading_ka}
            onChange={(e) => setField('hero_subheading_ka', e.target.value)}
          />
          <Input
            label={t('landing_page.f_subheading_en')}
            value={merged.hero_subheading_en}
            onChange={(e) => setField('hero_subheading_en', e.target.value)}
          />
          <Input
            label={t('landing_page.f_hero_image')}
            value={merged.hero_image_url}
            onChange={(e) => setField('hero_image_url', e.target.value)}
            className="md:col-span-2"
          />
        </div>
      </Card>

      <Card>
        <h2 className="font-display text-xl mb-4 tracking-tight">
          {t('landing_page.section_about')}
        </h2>
        <div className="grid md:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">{t('landing_page.f_about_ka')}</span>
            <textarea
              rows={6}
              value={merged.about_text_ka}
              onChange={(e) => setField('about_text_ka', e.target.value)}
              className="px-3.5 py-2.5 bg-surface-2 border border-line rounded-md text-[15px] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">{t('landing_page.f_about_en')}</span>
            <textarea
              rows={6}
              value={merged.about_text_en}
              onChange={(e) => setField('about_text_en', e.target.value)}
              className="px-3.5 py-2.5 bg-surface-2 border border-line rounded-md text-[15px] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
            />
          </label>
        </div>
      </Card>

      <FeaturedReviewsPicker
        selected={merged.featured_review_ids ?? []}
        onChange={(ids) => setField('featured_review_ids', ids)}
      />

      <ListEditor
        title={t('landing_page.section_gallery')}
        values={merged.gallery_image_urls}
        onChange={(v) => setField('gallery_image_urls', v)}
        placeholder={t('landing_page.ph_image')}
      />

      <ErrorMessage error={update.error} />
    </div>
  );
}

function Stars({ rating }: { rating: number }) {
  const { t } = useTranslation('admin');
  return (
    <span
      className="inline-flex items-center gap-0.5 shrink-0"
      role="img"
      aria-label={t('landing_page.stars_label', { rating })}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          aria-hidden
          className={cn(
            'h-3.5 w-3.5',
            i <= rating ? 'text-accent fill-accent' : 'text-line-strong',
          )}
        />
      ))}
    </span>
  );
}

/**
 * Featured-reviews picker (spec §9.10): checkbox list of every published
 * review + an orderable "selected" list on top. The ids land in the page's
 * `edits` and PATCH /admin/landing/1/ as featured_review_ids via the shared
 * Save button. Ordering note: the public payload currently sorts featured
 * reviews newest-first, so the order here is advisory until the backend
 * persists M2M ordering.
 */
function FeaturedReviewsPicker({
  selected,
  onChange,
}: {
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const { t } = useTranslation('admin');
  const reviews = useAdminPublishedReviewsAll();
  const items = useMemo(() => reviews.data ?? [], [reviews.data]);
  const byId = useMemo(() => new Map(items.map((r) => [r.id, r])), [items]);

  const toggle = (id: number) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  const move = (idx: number, delta: -1 | 1) => {
    const next = [...selected];
    const swap = idx + delta;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    onChange(next);
  };

  return (
    <Card>
      <h2 className="font-display text-xl mb-1 tracking-tight">
        {t('landing_page.section_featured')}
      </h2>
      <p className="text-sm text-ink-muted mb-4">{t('landing_page.featured_hint')}</p>

      {reviews.isError ? (
        <SectionError error={reviews.error} onRetry={() => reviews.refetch()} />
      ) : reviews.isLoading ? (
        <p role="status" aria-live="polite" className="text-ink-muted text-sm">
          {t('actions.loading')}
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm text-ink-muted">{t('landing_page.featured_no_published')}</p>
      ) : (
        <div className="flex flex-col gap-5">
          <div>
            <h3 className="text-[10px] uppercase tracking-[0.12em] text-ink-muted font-medium mb-2">
              {t('landing_page.featured_selected')}
            </h3>
            {selected.length === 0 ? (
              <p className="text-sm text-ink-muted">{t('landing_page.featured_none_selected')}</p>
            ) : (
              <ol className="flex flex-col">
                {selected.map((id, idx) => {
                  const review = byId.get(id);
                  return (
                    <li
                      key={id}
                      className="flex items-center gap-3 py-2 border-b border-line last:border-b-0"
                    >
                      <span className="text-xs text-ink-muted tabular-nums w-5 shrink-0">
                        {idx + 1}.
                      </span>
                      {review ? (
                        <ReviewSummary review={review} />
                      ) : (
                        <span className="flex-1 text-sm text-ink-muted italic">#{id}</span>
                      )}
                      <span className="flex items-center gap-1 shrink-0">
                        <IconBtn
                          label={t('landing_page.featured_move_up')}
                          disabled={idx === 0}
                          onClick={() => move(idx, -1)}
                        >
                          <ChevronUp className="h-4 w-4" aria-hidden />
                        </IconBtn>
                        <IconBtn
                          label={t('landing_page.featured_move_down')}
                          disabled={idx === selected.length - 1}
                          onClick={() => move(idx, 1)}
                        >
                          <ChevronDown className="h-4 w-4" aria-hidden />
                        </IconBtn>
                        <IconBtn label={t('landing_page.remove')} onClick={() => toggle(id)}>
                          <X className="h-4 w-4" aria-hidden />
                        </IconBtn>
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          <div className="border-t border-line pt-4">
            <h3 className="text-[10px] uppercase tracking-[0.12em] text-ink-muted font-medium mb-2">
              {t('landing_page.featured_available')}
            </h3>
            <div className="flex flex-col">
              {items.map((r) => (
                <label
                  key={r.id}
                  className="flex items-center gap-3 py-2 border-b border-line last:border-b-0 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(r.id)}
                    onChange={() => toggle(r.id)}
                    aria-label={t('landing_page.featured_toggle_label', {
                      name: r.customer_name,
                    })}
                  />
                  <ReviewSummary review={r} />
                </label>
              ))}
            </div>
          </div>

          <p className="text-xs text-ink-muted">{t('landing_page.featured_order_note')}</p>
        </div>
      )}
    </Card>
  );
}

function ReviewSummary({ review }: { review: AdminReview }) {
  const { t } = useTranslation('admin');
  return (
    <span className="flex-1 min-w-0 flex items-center gap-2">
      <Stars rating={review.rating} />
      <span className="text-sm text-ink truncate">
        {review.text || <em className="text-ink-muted">{t('landing_page.featured_no_text')}</em>}
      </span>
      <span className="text-xs text-ink-muted shrink-0 hidden sm:inline">
        {review.customer_name} · {review.barber_name}
      </span>
    </span>
  );
}

function IconBtn({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'inline-flex items-center justify-center w-7 h-7 rounded-pill transition',
        disabled
          ? 'text-ink-muted/40 cursor-not-allowed'
          : 'text-ink-muted hover:text-ink hover:bg-line/50',
      )}
    >
      {children}
    </button>
  );
}

function ListEditor({
  title,
  values,
  onChange,
  placeholder,
}: {
  title: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const { t } = useTranslation('admin');
  const [draft, setDraft] = useState('');

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...values, v]);
    setDraft('');
  };
  const remove = (i: number) => {
    onChange(values.filter((_, idx) => idx !== i));
  };

  return (
    <Card>
      <h2 className="font-display text-xl mb-4 tracking-tight">{title}</h2>
      <div className="flex flex-col gap-2 mb-3">
        {values.length === 0 && (
          <p className="text-ink-muted text-sm">{t('landing_page.list_no_entries')}</p>
        )}
        {values.map((v, i) => (
          <div
            key={`${v}-${i}`}
            className="flex items-center gap-2 border-b border-line pb-2 last:border-b-0"
          >
            <code className="flex-1 text-sm text-ink font-mono truncate">{v}</code>
            <Button variant="ghost" size="sm" onClick={() => remove(i)} className="rounded-pill">
              {t('landing_page.remove')}
            </Button>
          </div>
        ))}
      </div>
      <div className="flex gap-2 items-end">
        <Input
          label={t('landing_page.f_add')}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
        />
        <Button
          type="button"
          onClick={add}
          variant="accent"
          className="rounded-pill"
          aria-label={t('landing_page.f_add')}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}
