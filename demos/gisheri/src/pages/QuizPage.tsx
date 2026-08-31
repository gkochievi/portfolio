import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Steps } from '@/components/ui/steps';
import { cn } from '@/lib/utils';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Seo from '@/components/Seo';
import ProductCard from '@/components/products/ProductCard';
import { type ZodiacSign } from '@/data/products';
import { useProducts, useZodiacInfo } from '@/hooks/use-catalog';
import { useQuizConfig } from '@/hooks/use-quiz-config';
import { budgetRange, pickLabel } from '@/lib/quiz-api';
import { useTranslation } from 'react-i18next';
import { tStone, tZodiacInfo } from '@/lib/catalog-i18n';

const TOTAL_STEPS = 5;

interface ChoiceCardProps {
  selected: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}

const ChoiceCard = ({ selected, onClick, className, children }: ChoiceCardProps) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'rounded-lg border bg-card text-card-foreground shadow-sm text-center transition-all hover:shadow-md',
      selected ? 'border-gold bg-gold/10' : 'border-border',
      className,
    )}
  >
    {children}
  </button>
);

const QuizPage = () => {
  const { t, i18n } = useTranslation();
  const { data: products = [] } = useProducts();
  const { data: zodiacData = [] } = useZodiacInfo();
  const { data: quizConfig } = useQuizConfig();
  const moods = quizConfig?.moods ?? [];
  const occasions = quizConfig?.occasions ?? [];
  const intentions = quizConfig?.intentions ?? [];
  const budgets = quizConfig?.budgets ?? [];
  const lang = i18n.language;
  const [step, setStep] = useState(0);
  const [selectedZodiac, setSelectedZodiac] = useState<ZodiacSign | null>(null);
  const [selectedOccasion, setSelectedOccasion] = useState<string | null>(null);
  const [selectedIntention, setSelectedIntention] = useState<string | null>(null);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [selectedBudget, setSelectedBudget] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const url = typeof window !== 'undefined' ? window.location.href : '';

  const canProceed = () => {
    switch (step) {
      case 0: return !!selectedZodiac;
      case 1: return !!selectedOccasion;
      case 2: return !!selectedIntention;
      case 3: return !!selectedMood;
      case 4: return !!selectedBudget;
      default: return false;
    }
  };

  const handleNext = () => {
    if (!canProceed()) return;
    if (step < TOTAL_STEPS - 1) {
      setStep(step + 1);
    } else {
      setShowResults(true);
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const resetQuiz = () => {
    setStep(0);
    setSelectedZodiac(null);
    setSelectedOccasion(null);
    setSelectedIntention(null);
    setSelectedMood(null);
    setSelectedBudget(null);
    setShowResults(false);
  };

  const getRecommendedProducts = () => {
    if (!selectedZodiac || !selectedMood || !selectedIntention || !selectedBudget) return [];

    const moodPurposes = moods.find((m) => m.id === selectedMood)?.purposes ?? [];
    const intentionPurposes = intentions.find((i) => i.id === selectedIntention)?.purposes ?? [];
    const allPurposes = [...new Set([...moodPurposes, ...intentionPurposes])];
    const budget = budgets.find((b) => b.id === selectedBudget);
    const range = budget ? budgetRange(budget) : null;

    return products
      .map((p) => {
        let score = 0;
        if (p.zodiacSigns.includes(selectedZodiac)) score += 3;
        score += allPurposes.filter((purpose) => p.purposes.includes(purpose)).length * 2;
        if (range && p.price >= range.min && p.price <= range.max) score += 1;
        return { product: p, score };
      })
      .filter(({ product, score }) => {
        if (score === 0) return false;
        if (range && budget && budget.id !== 'any') {
          return product.price >= range.min && product.price <= range.max;
        }
        return true;
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(({ product }) => product);
  };

  const recommendedProducts = getRecommendedProducts();
  const localizedZodiacData = zodiacData.map((z) => tZodiacInfo(t, z));
  const zodiacInfo = localizedZodiacData.find((z) => z.sign === selectedZodiac);
  const moodInfo = moods.find((m) => m.id === selectedMood);
  const intentionInfo = intentions.find((i) => i.id === selectedIntention);
  const occasionInfo = occasions.find((o) => o.id === selectedOccasion);
  const budgetInfo = budgets.find((b) => b.id === selectedBudget);
  const moodLabel = moodInfo ? pickLabel(moodInfo.labelEn, moodInfo.labelKa, lang) : '';
  const intentionLabel = intentionInfo ? pickLabel(intentionInfo.labelEn, intentionInfo.labelKa, lang) : '';
  const occasionLabel = occasionInfo ? pickLabel(occasionInfo.labelEn, occasionInfo.labelKa, lang) : '';
  const budgetLabel = budgetInfo ? pickLabel(budgetInfo.labelEn, budgetInfo.labelKa, lang) : '';

  const progressPercent = showResults ? 100 : Math.round(((step + 1) / TOTAL_STEPS) * 100);

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title={t('seo.pages.quiz.title')}
        description={t('seo.pages.quiz.description')}
        type="WebPage"
        jsonLd={url ? {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: t('seo.pages.quiz.title'),
          description: t('seo.pages.quiz.description'),
          url,
          isPartOf: origin ? { '@type': 'WebSite', name: t('seo.siteName', { defaultValue: 'Gisheri' }), url: origin } : undefined,
        } : undefined}
      />
      <Header />
      <main className="pt-20 pb-16">
        <div className="container-main px-4 py-12 md:py-20">
          <AnimatePresence mode="wait">
            {!showResults ? (
              <motion.div
                key="quiz"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="max-w-3xl mx-auto"
              >
                {/* Header */}
                <div className="text-center mb-10">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-gold/10 rounded-full mb-4">
                    <Sparkles size={16} className="text-gold" />
                    <span className="text-sm font-medium">{t('quizPage.badge')}</span>
                  </div>
                  <h1 className="heading-hero mb-4">{t('quizPage.title')}</h1>
                  <p className="text-body">{t('quizPage.subtitle')}</p>
                </div>

                {/* Progress */}
                <div className="mb-2">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>{t('quizPage.stepLabel', { current: step + 1, total: TOTAL_STEPS, defaultValue: `Step ${step + 1} of ${TOTAL_STEPS}` })}</span>
                    <span>{progressPercent}%</span>
                  </div>
                  <Progress value={progressPercent} className="h-2 [&>div]:bg-gold" />
                </div>

                {/* Steps indicator */}
                <Steps
                  current={step}
                  className="mb-8 mt-4"
                  items={[
                    { title: <span className="hidden sm:inline">{t('quizPage.stepLabels.zodiac', { defaultValue: 'Zodiac' })}</span> },
                    { title: <span className="hidden sm:inline">{t('quizPage.stepLabels.occasion', { defaultValue: 'Occasion' })}</span> },
                    { title: <span className="hidden sm:inline">{t('quizPage.stepLabels.intention', { defaultValue: 'Intention' })}</span> },
                    { title: <span className="hidden sm:inline">{t('quizPage.stepLabels.mood', { defaultValue: 'Mood' })}</span> },
                    { title: <span className="hidden sm:inline">{t('quizPage.stepLabels.budget', { defaultValue: 'Budget' })}</span> },
                  ]}
                />

                {/* Step content */}
                <AnimatePresence mode="wait">
                  {/* Step 0: Zodiac */}
                  {step === 0 && (
                    <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                      <h2 className="heading-section text-center mb-8">{t('quizPage.stepZodiac')}</h2>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 sm:gap-3">
                        {localizedZodiacData.map((zodiac) => (
                          <ChoiceCard
                            key={zodiac.sign}
                            selected={selectedZodiac === zodiac.sign}
                            onClick={() => setSelectedZodiac(zodiac.sign)}
                            className="px-2 py-3"
                          >
                            <span className="text-xl sm:text-2xl block mb-1">{zodiac.symbol}</span>
                            <span className="text-[10px] sm:text-xs font-medium block">{zodiac.name}</span>
                          </ChoiceCard>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Step 1: Occasion */}
                  {step === 1 && (
                    <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                      <h2 className="heading-section text-center mb-3">{t('quizPage.stepOccasion')}</h2>
                      <p className="text-body text-center mb-8">{t('quizPage.stepOccasionHint')}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 max-w-xl mx-auto">
                        {occasions.map((occasion) => (
                          <ChoiceCard
                            key={occasion.id}
                            selected={selectedOccasion === occasion.id}
                            onClick={() => setSelectedOccasion(occasion.id)}
                            className="px-4 py-6"
                          >
                            <span className="text-3xl sm:text-4xl block mb-3">{occasion.icon}</span>
                            <span className="text-sm sm:text-base font-medium block">
                              {pickLabel(occasion.labelEn, occasion.labelKa, lang)}
                            </span>
                            <span className="text-xs text-muted-foreground block mt-1">
                              {pickLabel(occasion.hintEn, occasion.hintKa, lang)}
                            </span>
                          </ChoiceCard>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Step 2: Intention */}
                  {step === 2 && (
                    <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                      <h2 className="heading-section text-center mb-3">{t('quizPage.stepIntention')}</h2>
                      <p className="text-body text-center mb-8">{t('quizPage.stepIntentionHint')}</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                        {intentions.map((intention) => (
                          <ChoiceCard
                            key={intention.id}
                            selected={selectedIntention === intention.id}
                            onClick={() => setSelectedIntention(intention.id)}
                            className="px-3 py-5"
                          >
                            <span className="text-2xl sm:text-3xl block mb-2">{intention.icon}</span>
                            <span className="text-xs sm:text-sm font-medium block">
                              {pickLabel(intention.labelEn, intention.labelKa, lang)}
                            </span>
                            <span className="text-[10px] sm:text-xs text-muted-foreground block mt-1">
                              {pickLabel(intention.hintEn, intention.hintKa, lang)}
                            </span>
                          </ChoiceCard>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Step 3: Mood */}
                  {step === 3 && (
                    <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                      <h2 className="heading-section text-center mb-3">{t('quizPage.stepMood')}</h2>
                      <p className="text-body text-center mb-8">{t('quizPage.stepMoodHint')}</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                        {moods.map((mood) => (
                          <ChoiceCard
                            key={mood.id}
                            selected={selectedMood === mood.id}
                            onClick={() => setSelectedMood(mood.id)}
                            className="px-3 py-5"
                          >
                            <span className="text-2xl sm:text-3xl block mb-2">{mood.icon}</span>
                            <span className="text-xs sm:text-sm font-medium text-center block">
                              {pickLabel(mood.labelEn, mood.labelKa, lang)}
                            </span>
                          </ChoiceCard>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Step 4: Budget */}
                  {step === 4 && (
                    <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                      <h2 className="heading-section text-center mb-3">{t('quizPage.stepBudget')}</h2>
                      <p className="text-body text-center mb-8">{t('quizPage.stepBudgetHint')}</p>
                      <div className="grid grid-cols-2 gap-3 sm:gap-4 max-w-lg mx-auto">
                        {budgets.map((budget) => (
                          <ChoiceCard
                            key={budget.id}
                            selected={selectedBudget === budget.id}
                            onClick={() => setSelectedBudget(budget.id)}
                            className="px-3 py-5"
                          >
                            <span className="text-2xl sm:text-3xl block mb-2">{budget.icon}</span>
                            <span className="text-xs sm:text-sm font-medium block">
                              {pickLabel(budget.labelEn, budget.labelKa, lang)}
                            </span>
                          </ChoiceCard>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Navigation */}
                <div className="flex items-center justify-between mt-12">
                  {step > 0 ? (
                    <Button variant="ghost" onClick={handleBack}>
                      <ArrowLeft size={16} />
                      {t('quizPage.back')}
                    </Button>
                  ) : (
                    <div />
                  )}
                  <Button
                    size="lg"
                    onClick={handleNext}
                    disabled={!canProceed()}
                  >
                    {step === TOTAL_STEPS - 1 ? t('quizPage.seeResults') : t('quizPage.next')}
                    <ArrowRight size={16} />
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-4xl mx-auto"
              >
                <div className="text-center mb-8">
                  <div className="text-4xl sm:text-5xl md:text-6xl mb-4">✨</div>
                  <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-medium mb-3">{t('quizPage.resultsTitle')}</h2>
                  <p className="text-muted-foreground max-w-2xl mx-auto">
                    {t('quizPage.resultsDescriptionFull', {
                      zodiac: zodiacInfo?.name ?? '',
                      mood: moodLabel,
                      intention: intentionLabel,
                    })}
                  </p>
                </div>

                {/* Summary tags */}
                <div className="flex flex-wrap justify-center gap-2 mb-8">
                  {zodiacInfo && (
                    <Badge variant="outline" className="text-sm py-1 px-3 bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-300">
                      {zodiacInfo.symbol} {zodiacInfo.name}
                    </Badge>
                  )}
                  {occasionLabel && (
                    <Badge variant="outline" className="text-sm py-1 px-3 bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300">
                      {occasions.find((o) => o.id === selectedOccasion)?.icon} {occasionLabel}
                    </Badge>
                  )}
                  {intentionLabel && (
                    <Badge variant="outline" className="text-sm py-1 px-3 bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-300">
                      {intentions.find((i) => i.id === selectedIntention)?.icon} {intentionLabel}
                    </Badge>
                  )}
                  {moodLabel && (
                    <Badge variant="outline" className="text-sm py-1 px-3 bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-300">
                      {moodInfo?.icon} {moodLabel}
                    </Badge>
                  )}
                  {selectedBudget && budgetInfo && (
                    <Badge variant="outline" className="text-sm py-1 px-3 bg-gold/10 border-gold/30 text-foreground">
                      {budgetInfo.icon} {budgetLabel}
                    </Badge>
                  )}
                </div>

                {/* Zodiac info */}
                <Card className="mb-8 p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <span className="text-4xl">{zodiacInfo?.symbol}</span>
                    <div>
                      <h3 className="font-serif font-medium text-lg">{zodiacInfo?.name}</h3>
                      <p className="text-small">
                        {zodiacInfo ? t('quizPage.zodiacCard.header', { element: zodiacInfo.element, dates: zodiacInfo.dates }) : null}
                      </p>
                    </div>
                  </div>
                  <p className="text-body">{zodiacInfo?.description}</p>
                  <Separator className="my-4" />
                  <p className="text-sm font-medium mb-2">{t('quizPage.zodiacCard.luckyStones')}</p>
                  <div className="flex flex-wrap gap-2">
                    {zodiacInfo?.stones.map((stone) => (
                      <Badge key={stone} variant="outline" className="text-sm">{tStone(t, stone)}</Badge>
                    ))}
                  </div>
                </Card>

                {/* Products */}
                <h2 className="heading-section mb-6">{t('quizPage.recommended')}</h2>
                {recommendedProducts.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                    {recommendedProducts.map((product, index) => (
                      <ProductCard key={product.id} product={product} index={index} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 mb-12">
                    <p className="text-muted-foreground mb-4">{t('quizPage.noExactMatch')}</p>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-center gap-4">
                  <Button size="lg" variant="outline" onClick={resetQuiz}>
                    {t('quizPage.retake')}
                  </Button>
                  <Link to="/shop">
                    <Button size="lg">
                      {t('quizPage.browseAll')}
                    </Button>
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default QuizPage;
