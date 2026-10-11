import { Link } from 'react-router-dom'

import { useLang } from '@/i18n/LanguageContext'
import { LanguageFlags } from './LanguageSwitchArt'
import { CHROME_COPY } from './chromeCopy'

// The GE/EN switch in the header — boulder.ge's two drawn flags. On
// boulder.ge it is a button that flips a context; here the language is in
// the address ("/" English, "/ka/" Georgian), so it is a real link to the
// same page in the other language: ⌘-click, "copy link" and a crawler all
// get the address, and Back undoes a switch.
//
// The aria-label names the TARGET language, written in that language — the
// person hunting for this control is the one who cannot read the current one
// — so the link carries that language's `lang` and `hrefLang`.
export default function LanguageSwitch() {
  const { lang, switchHref } = useLang()
  const target = lang === 'ka' ? 'en' : 'ka'

  return (
    <Link
      to={switchHref}
      className="language-switch"
      aria-label={CHROME_COPY[lang].a11y.langSwitch}
      lang={target}
      hrefLang={target}
    >
      <LanguageFlags lang={lang} />
    </Link>
  )
}

export { LanguageSwitch }
