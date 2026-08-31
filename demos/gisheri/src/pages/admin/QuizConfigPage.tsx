import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import PageHeader from '@/components/admin/PageHeader';
import FormActionsBar from '@/components/admin/FormActionsBar';
import MultiSelectChips from '@/components/admin/MultiSelectChips';
import { adminQuiz } from '@/lib/quiz-api';
import type {
  QuizBudget,
  QuizConfig,
  QuizIntention,
  QuizMood,
  QuizOccasion,
} from '@/lib/quiz-api';
import { ApiError } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { purposeInfo, type Purpose } from '@/data/products';

const PURPOSES: Purpose[] = ['luck', 'protection', 'love', 'safety', 'energy', 'balance'];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

type Item = QuizMood | QuizOccasion | QuizIntention | QuizBudget;

interface SectionProps<T extends Item> {
  title: string;
  items: T[];
  onChange: (next: T[]) => void;
  /** Render the per-item fields beyond the common id+icon+labels. */
  renderExtras?: (item: T, update: (patch: Partial<T>) => void) => React.ReactNode;
  blank: () => T;
  /** Render hint inputs (occasions / intentions) when present. */
  hasHints?: boolean;
}

function Section<T extends Item>({ title, items, onChange, renderExtras, blank, hasHints }: SectionProps<T>) {
  const { t } = useTranslation();

  const update = (idx: number, patch: Partial<T>) => {
    const next = items.slice();
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  const remove = (idx: number) => {
    onChange(items.filter((_, i) => i !== idx));
  };

  const add = () => {
    onChange([...items, blank()]);
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-lg font-medium">{title}</h2>
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus size={14} />
          {t('admin.quiz.addItem', { defaultValue: 'Add item' })}
        </Button>
      </div>

      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">—</p>
      )}

      <div className="space-y-4">
        {items.map((item, idx) => {
          const i = item as Item & { hintEn?: string; hintKa?: string };
          return (
            <div key={idx} className="border border-border rounded-md p-4 space-y-3">
              <div className="flex items-start gap-2">
                <Input
                  className="w-16 text-center text-2xl"
                  value={item.icon}
                  onChange={(e) => update(idx, { icon: e.target.value } as Partial<T>)}
                  aria-label={t('admin.quiz.icon', { defaultValue: 'Icon' })}
                />
                <div className="flex-1">
                  <Input
                    className="font-mono text-xs"
                    value={item.id}
                    onChange={(e) => update(idx, { id: slug(e.target.value) } as Partial<T>)}
                    placeholder={t('admin.quiz.idLabel', { defaultValue: 'ID' }) as string}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {t('admin.quiz.idHint', { defaultValue: 'Stable slug; never shown to shoppers.' })}
                  </p>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => remove(idx)} className="text-destructive shrink-0">
                  <Trash2 size={14} />
                </Button>
              </div>

              <div className="grid sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">{t('admin.quiz.labelEn')}</label>
                  <Input
                    value={item.labelEn}
                    onChange={(e) => update(idx, { labelEn: e.target.value } as Partial<T>)}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">{t('admin.quiz.labelKa')}</label>
                  <Input
                    value={item.labelKa}
                    onChange={(e) => update(idx, { labelKa: e.target.value } as Partial<T>)}
                  />
                </div>
              </div>

              {hasHints && (
                <div className="grid sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">{t('admin.quiz.hintEn')}</label>
                    <Input
                      value={i.hintEn ?? ''}
                      onChange={(e) => update(idx, { hintEn: e.target.value } as unknown as Partial<T>)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">{t('admin.quiz.hintKa')}</label>
                    <Input
                      value={i.hintKa ?? ''}
                      onChange={(e) => update(idx, { hintKa: e.target.value } as unknown as Partial<T>)}
                    />
                  </div>
                </div>
              )}

              {renderExtras?.(item, (patch) => update(idx, patch))}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

const QuizConfigPage = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<QuizConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminQuiz
      .get()
      .then((res) => {
        if (!cancelled) setConfig(res);
      })
      .catch((err) => {
        if (cancelled) return;
        toast({
          title: t('admin.quiz.loadFailed', { defaultValue: 'Failed to load quiz config' }),
          description: err instanceof ApiError ? err.detail : undefined,
          variant: 'destructive',
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [toast, t]);

  const save = async () => {
    if (!config) return;
    setSubmitting(true);
    try {
      await adminQuiz.update(config);
      queryClient.invalidateQueries({ queryKey: ['quiz-config'] });
      toast({ title: t('admin.quiz.saved', { defaultValue: 'Quiz saved' }) });
    } catch (err) {
      toast({
        title: t('admin.users.saveFailed', { defaultValue: 'Failed to save' }),
        description: err instanceof ApiError ? err.detail : undefined,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="text-muted-foreground text-sm">{t('admin.common.loading', { defaultValue: 'Loading…' })}</div>;
  if (!config) return null;

  return (
    <div>
      <PageHeader
        title={t('admin.quiz.title', { defaultValue: 'Quiz config' })}
        description={t('admin.quiz.subtitle', {
          defaultValue: 'Edit the labels, icons, and recommendation mappings the customer-facing /quiz uses.',
        })}
      />

      <div className="space-y-6 max-w-4xl">
        <Section<QuizMood>
          title={t('admin.quiz.moods', { defaultValue: 'Moods' })}
          items={config.moods}
          onChange={(moods) => setConfig({ ...config, moods })}
          blank={() => ({ id: '', icon: '', labelEn: '', labelKa: '', purposes: [] })}
          renderExtras={(item, update) => (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                {t('admin.quiz.purposes', { defaultValue: 'Recommends purposes' })}
              </label>
              <MultiSelectChips
                options={PURPOSES.map((p) => ({ value: p, label: purposeInfo[p].name }))}
                values={item.purposes}
                onChange={(values) => update({ purposes: values as Purpose[] })}
              />
            </div>
          )}
        />

        <Section<QuizOccasion>
          title={t('admin.quiz.occasions', { defaultValue: 'Occasions' })}
          items={config.occasions}
          onChange={(occasions) => setConfig({ ...config, occasions })}
          blank={() => ({ id: '', icon: '', labelEn: '', labelKa: '', hintEn: '', hintKa: '' })}
          hasHints
        />

        <Section<QuizIntention>
          title={t('admin.quiz.intentions', { defaultValue: 'Intentions' })}
          items={config.intentions}
          onChange={(intentions) => setConfig({ ...config, intentions })}
          blank={() => ({ id: '', icon: '', labelEn: '', labelKa: '', hintEn: '', hintKa: '', purposes: [] })}
          hasHints
          renderExtras={(item, update) => (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                {t('admin.quiz.purposes', { defaultValue: 'Recommends purposes' })}
              </label>
              <MultiSelectChips
                options={PURPOSES.map((p) => ({ value: p, label: purposeInfo[p].name }))}
                values={item.purposes}
                onChange={(values) => update({ purposes: values as Purpose[] })}
              />
            </div>
          )}
        />

        <Section<QuizBudget>
          title={t('admin.quiz.budgets', { defaultValue: 'Budgets' })}
          items={config.budgets}
          onChange={(budgets) => setConfig({ ...config, budgets })}
          blank={() => ({ id: '', icon: '', labelEn: '', labelKa: '', min: '0', max: null })}
          renderExtras={(item, update) => (
            <div className="grid sm:grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  {t('admin.quiz.minPrice', { defaultValue: 'Min ₾' })}
                </label>
                <Input
                  inputMode="decimal"
                  value={item.min}
                  onChange={(e) => update({ min: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  {t('admin.quiz.maxPrice', { defaultValue: 'Max ₾ (blank = no upper)' })}
                </label>
                <Input
                  inputMode="decimal"
                  value={item.max ?? ''}
                  onChange={(e) => update({ max: e.target.value === '' ? null : e.target.value })}
                />
              </div>
            </div>
          )}
        />

      </div>

      <FormActionsBar className="mt-6">
        <Button onClick={save} disabled={submitting} size="lg">
          {submitting ? t('admin.common.saving', { defaultValue: 'Saving…' }) : t('admin.quiz.saveAll', { defaultValue: 'Save quiz config' })}
        </Button>
      </FormActionsBar>
    </div>
  );
};

export default QuizConfigPage;
