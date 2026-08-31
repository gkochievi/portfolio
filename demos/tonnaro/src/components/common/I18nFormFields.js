import React, { useEffect, useRef, useState } from 'react';
import { Tabs, Input } from 'antd';
import { useLang } from '../../contexts/LanguageContext';

const { TextArea } = Input;

export const LANG_TABS = [
  { key: 'en', label: '🇬🇧 EN' },
  { key: 'ka', label: '🇬🇪 KA' },
  { key: 'ru', label: '🇷🇺 RU' },
];

// Per-tab disallowed character ranges.
// - EN tab: strict Latin-only (block Cyrillic + Georgian). Admins were
//   pasting Georgian into the EN field, which produced empty slugs and
//   broke uniqueness — see the related slug-fix migrations.
// - KA tab: only block Cyrillic. Latin is allowed in KA fields because
//   brand names, abbreviations, and product codes are commonly written
//   in English even in Georgian copy.
// - RU tab: only block Georgian. Latin is allowed for the same reason.
const FORBIDDEN_RANGES = {
  en: /[Ѐ-ӿႠ-ჿ]/g, // Cyrillic + Georgian
  ka: /[Ѐ-ӿ]/g,              // Cyrillic
  ru: /[Ⴀ-ჿ]/g,              // Georgian
};

const WARNING_KEY_BY_TAB = {
  en: 'i18nInput.englishOnly',
  ka: 'i18nInput.noCyrillic',
  ru: 'i18nInput.noGeorgian',
};

function filterByScript(text, lang) {
  const pattern = FORBIDDEN_RANGES[lang];
  if (!pattern || !text) return { text, stripped: false };
  const filtered = text.replace(pattern, '');
  return { text: filtered, stripped: filtered.length !== text.length };
}

function withLang(value = {}, onChange, lang, raw) {
  onChange?.({ ...(value || {}), [lang]: raw });
}

// Tracks transient "stripped chars" warnings per language tab. Each warning
// auto-hides 2.5s after the last keystroke that triggered it so the message
// doesn't linger after the admin moves on.
function useScriptWarnings() {
  const [warnings, setWarnings] = useState({});
  const timers = useRef({});

  const flash = (lang) => {
    setWarnings((w) => ({ ...w, [lang]: true }));
    clearTimeout(timers.current[lang]);
    timers.current[lang] = setTimeout(() => {
      setWarnings((w) => ({ ...w, [lang]: false }));
    }, 2500);
  };

  useEffect(() => {
    const stored = timers.current;
    return () => Object.values(stored).forEach(clearTimeout);
  }, []);

  return [warnings, flash];
}

function ScriptWarning({ show, messageKey, t }) {
  if (!show) return null;
  return (
    <div
      role="alert"
      style={{
        marginTop: 6,
        fontSize: 12,
        lineHeight: '16px',
        color: '#b45309',
        background: 'color-mix(in srgb, #f59e0b 12%, transparent)',
        border: '1px solid color-mix(in srgb, #f59e0b 35%, transparent)',
        padding: '4px 8px',
        borderRadius: 6,
      }}
    >
      ⚠️ {t(messageKey)}
    </div>
  );
}

export function I18nInput({ value = {}, onChange, placeholder, style }) {
  const { t } = useLang();
  const [warnings, flash] = useScriptWarnings();

  return (
    <Tabs
      size="small"
      style={{ marginTop: -8 }}
      items={LANG_TABS.map((tab) => ({
        key: tab.key,
        label: tab.label,
        children: (
          <>
            <Input
              value={value?.[tab.key] || ''}
              onChange={(e) => {
                const { text, stripped } = filterByScript(e.target.value, tab.key);
                if (stripped) flash(tab.key);
                withLang(value, onChange, tab.key, text);
              }}
              placeholder={placeholder}
              style={{ borderRadius: 10, ...(style || {}) }}
            />
            <ScriptWarning
              show={!!warnings[tab.key]}
              messageKey={WARNING_KEY_BY_TAB[tab.key]}
              t={t}
            />
          </>
        ),
      }))}
    />
  );
}

export function I18nTextArea({ value = {}, onChange, placeholder, rows = 3, style }) {
  const { t } = useLang();
  const [warnings, flash] = useScriptWarnings();

  return (
    <Tabs
      size="small"
      style={{ marginTop: -8 }}
      items={LANG_TABS.map((tab) => ({
        key: tab.key,
        label: tab.label,
        children: (
          <>
            <TextArea
              value={value?.[tab.key] || ''}
              onChange={(e) => {
                const { text, stripped } = filterByScript(e.target.value, tab.key);
                if (stripped) flash(tab.key);
                withLang(value, onChange, tab.key, text);
              }}
              placeholder={placeholder}
              rows={rows}
              style={{ borderRadius: 10, ...(style || {}) }}
            />
            <ScriptWarning
              show={!!warnings[tab.key]}
              messageKey={WARNING_KEY_BY_TAB[tab.key]}
              t={t}
            />
          </>
        ),
      }))}
    />
  );
}
