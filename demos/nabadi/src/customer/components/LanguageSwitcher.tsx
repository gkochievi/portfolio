import { useTranslation } from 'react-i18next';

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation('common');
  const cur = i18n.language?.startsWith('ka') ? 'ka' : 'en';
  const toggle = () => void i18n.changeLanguage(cur === 'ka' ? 'en' : 'ka');
  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink transition px-3 py-2 rounded-pill"
      aria-label={t('language_toggle')}
    >
      <span className={cur === 'ka' ? 'text-ink' : ''}>KA</span>
      <span className="text-line-strong">·</span>
      <span className={cur === 'en' ? 'text-ink' : ''}>EN</span>
    </button>
  );
}
