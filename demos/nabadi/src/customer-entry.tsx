import { QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import './customer/index.css';
import App from './customer/App';
import { queryClient } from './customer/lib/query-client';
import i18n from './customer/lib/i18n';
import { registerI18n } from './i18n-bridge';
import { DemoBanner } from './components/demo/DemoBanner';

/**
 * The customer site's `main.tsx`, minus the root it no longer owns.
 *
 * `StrictMode` and `createRoot` moved up to the shell, which mounts one root for
 * both surfaces; everything else is the upstream entry point unchanged. The
 * banner sits beside `<App />` rather than inside it because `App` *is* the
 * router — and the banner has to keep working on a route the router does not
 * recognise.
 *
 * The i18n instance is provided explicitly rather than left to react-i18next's
 * module-global default, because the console sets that default too and whichever
 * surface mounted last would otherwise be answering both of them.
 */
registerI18n(i18n);

export default function CustomerSurface() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <App />
        <DemoBanner surface="customer" />
      </I18nextProvider>
    </QueryClientProvider>
  );
}
