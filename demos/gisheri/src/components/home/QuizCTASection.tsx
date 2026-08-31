import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const QuizCTASection = () => {
  const { t } = useTranslation();

  return (
    <section className="section-padding">
      <div className="container-main">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative bg-gradient-to-br from-secondary via-card to-secondary/50 rounded-3xl p-8 md:p-12 lg:p-16 overflow-hidden border border-border"
        >
          {/* Decorations */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-gold/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl" />
          
          {/* Floating elements */}
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity }}
            className="absolute top-12 right-12 hidden lg:block"
          >
            <span className="text-6xl">💎</span>
          </motion.div>
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 5, repeat: Infinity }}
            className="absolute bottom-12 left-12 hidden lg:block"
          >
            <span className="text-5xl">🔮</span>
          </motion.div>

          <div className="relative z-10 max-w-2xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gold/10 rounded-full mb-6">
              <Sparkles size={16} className="text-gold" />
              <span className="text-sm font-medium text-foreground">{t('home.quizCta.badge')}</span>
            </div>

            <h2 className="heading-section mb-6">
              {t('home.quizCta.title')}
            </h2>
            
            <p className="text-body text-lg mb-8">
              {t('home.quizCta.description')}
            </p>

            <Link
              to="/quiz"
              className="btn-gold inline-flex items-center gap-2 group"
            >
              {t('home.quizCta.cta')}
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default QuizCTASection;
