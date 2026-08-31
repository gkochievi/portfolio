import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { BrandingProvider } from './contexts/BrandingContext';
import './theme.css';
import App from './App';

// DEMO: boots the in-browser backend before anything renders — registers every
// route handler, patches the geocoder and geolocation. Nothing above
// `api/client.js` knows it is there.
import './demo';
import { APP_BASE, HASH_ROUTING } from './demo/base';

function ThemedApp() {
  const { antdThemeConfig } = useTheme();
  return (
    <ConfigProvider theme={antdThemeConfig}>
      <App />
    </ConfigProvider>
  );
}

/**
 * DEMO: upstream this is a bare `<BrowserRouter>`, because nginx serves the app
 * from a domain root. Here the same bundle is mounted under `/demos/tonnaro/`
 * inside a portfolio, so the router needs the base path Vite compiled against —
 * and `VITE_ROUTER=hash` is the escape hatch for a static host that cannot
 * serve index.html for unknown paths. A hash router carries its own base in the
 * fragment and so takes no basename.
 */
function DemoRouter({ children }) {
  if (HASH_ROUTING) return <HashRouter>{children}</HashRouter>;
  return <BrowserRouter basename={APP_BASE || '/'}>{children}</BrowserRouter>;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <DemoRouter>
      <LanguageProvider>
        <BrandingProvider>
          <ThemeProvider>
            <ThemedApp />
          </ThemeProvider>
        </BrandingProvider>
      </LanguageProvider>
    </DemoRouter>
  </React.StrictMode>
);
