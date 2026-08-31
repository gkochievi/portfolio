/**
 * Quiz config — moods/occasions/intentions/budgets that drive the
 * /quiz flow. Bilingual labels live on each item; pick by language at
 * the call site.
 */
import { api } from '@/lib/api';
import type { Purpose } from '@/data/products';

export interface QuizMood {
  id: string;
  icon: string;
  labelEn: string;
  labelKa: string;
  purposes: Purpose[];
}

export interface QuizOccasion {
  id: string;
  icon: string;
  labelEn: string;
  labelKa: string;
  hintEn: string;
  hintKa: string;
}

export interface QuizIntention {
  id: string;
  icon: string;
  labelEn: string;
  labelKa: string;
  hintEn: string;
  hintKa: string;
  purposes: Purpose[];
}

export interface QuizBudget {
  id: string;
  icon: string;
  labelEn: string;
  labelKa: string;
  /** Decimal string from the API. */
  min: string;
  /** null = no upper bound. */
  max: string | null;
}

export interface QuizConfig {
  moods: QuizMood[];
  occasions: QuizOccasion[];
  intentions: QuizIntention[];
  budgets: QuizBudget[];
}

export const quizApi = {
  get: () => api.get<QuizConfig>('/quiz-config', { skipAuth: true }),
};

export const adminQuiz = {
  get: () => api.get<QuizConfig>('/admin/quiz-config'),
  update: (input: QuizConfig) => api.patch<QuizConfig>('/admin/quiz-config', input),
};

/** Convert backend Decimal-string min/max to numbers (Infinity for no bound). */
export const budgetRange = (b: QuizBudget): { min: number; max: number } => ({
  min: Number(b.min) || 0,
  max: b.max === null ? Number.POSITIVE_INFINITY : Number(b.max),
});

/** Pick the right language variant. */
export const pickLabel = (en: string, ka: string, lang: string): string => {
  const v = lang === 'ka' ? ka : en;
  return v || ka || en || '';
};
