import { QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import './customer/index.css';
import App from './admin/App';
import { ToastProvider } from './admin/components/Toast';
import { queryClient } from './admin/lib/query-client';
import i18n from './admin/lib/i18n';
import { registerI18n } from './i18n-bridge';
import { DemoBanner } from './components/demo/DemoBanner';

/**
 * The console's `main.tsx`, with two changes.
 *
 * It imports the customer app's `index.css`, because the console's own was a
 * strict subset of it — same `@theme` block, same tokens, two comments apart —
 * and two `@import 'tailwindcss'` entries in one bundle means two copies of the
 * utility layer. The console's stylesheet is the one file of the port that was
 * dropped rather than changed.
 *
 * And it provides its i18n instance explicitly. Upstream both apps configure the
 * default `i18next` singleton; sharing a tab, the second `init()` would replace
 * the first. See `i18n-bridge.ts`.
 */
registerI18n(i18n);

export default function AdminSurface() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <ToastProvider>
          <App />
          <DemoBanner surface="admin" />
        </ToastProvider>
      </I18nextProvider>
    </QueryClientProvider>
  );
}
