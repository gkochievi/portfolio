import { StrictMode, Suspense, lazy, useEffect, useState, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import './demo';
import { currentSurface, onSurfaceChange, type SurfaceName } from './surface';

/**
 * The two surfaces are reached through `import.meta.glob` rather than two plain
 * imports, and that is a type-checking decision, not a bundling one.
 *
 * Each ported tree resolves `@/` to itself — `@/lib/api` means one file inside
 * `customer/` and a different file inside `admin/`. Vite handles that with an
 * importer-aware resolver (see vite.config.ts), but `tsc` has only one `paths`
 * table per project, so the two trees are checked as two separate projects.
 * A static `import './admin-entry'` here would drag both of them into a third
 * project and resolve half its `@/` imports against the wrong tree.
 *
 * `import.meta.glob` is typed as `Record<string, () => Promise<unknown>>`, so
 * TypeScript stops at this file — and Vite still gets a literal, statically
 * analysable graph, code-split per surface. The console's 16k lines and its
 * chart library never reach a visitor who only books a haircut.
 */
const ENTRIES = import.meta.glob<{ default: ComponentType }>('./*-entry.tsx');

const SURFACES: Record<SurfaceName, ComponentType> = {
  customer: lazy(() => ENTRIES['./customer-entry.tsx']()),
  admin: lazy(() => ENTRIES['./admin-entry.tsx']()),
};

/** Painted by index.html; removed once React has something to show. */
function clearBootSplash(): void {
  document.querySelector('.boot-splash')?.remove();
}

function Shell() {
  const [surface, setSurface] = useState<SurfaceName>(currentSurface);

  useEffect(() => onSurfaceChange(() => setSurface(currentSurface())), []);
  useEffect(clearBootSplash, []);

  const Surface = SURFACES[surface];
  // `key` forces a clean remount across the boundary: each surface owns its own
  // QueryClient and i18n instance, and neither should inherit the other's.
  return (
    <Suspense fallback={null}>
      <Surface key={surface} />
    </Suspense>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Shell />
  </StrictMode>,
);
