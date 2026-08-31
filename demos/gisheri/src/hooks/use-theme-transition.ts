import { useTheme } from 'next-themes';
import { useCallback, useRef } from 'react';

function spawnSparkles(x: number, y: number, count = 10) {
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'theme-sparkle';
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
    const dist = 40 + Math.random() * 60;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.setProperty('--sx', `${Math.cos(angle) * dist}px`);
    el.style.setProperty('--sy', `${Math.sin(angle) * dist}px`);
    el.style.animationDuration = `${0.5 + Math.random() * 0.4}s`;
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }
}

export function useThemeTransition() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const isTransitioning = useRef(false);

  const setThemeWithTransition = useCallback(
    (newTheme: string, event?: React.MouseEvent) => {
      if (isTransitioning.current) return;

      const rect = (event?.currentTarget as HTMLElement)?.getBoundingClientRect();
      const cx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
      const cy = rect ? rect.top + rect.height / 2 : 0;

      spawnSparkles(cx, cy, 12);

      // `'startViewTransition' in document` is what upstream wrote. It narrows
      // `document` to `never` in the else branch under strictNullChecks, and the
      // truthiness clause that followed it read to tsc as a forgotten call. A
      // typeof test on the value is the same guard without either effect.
      if (
        typeof document !== 'undefined' &&
        typeof (document as any).startViewTransition === 'function'
      ) {
        isTransitioning.current = true;

        document.documentElement.style.setProperty(
          '--theme-x',
          `${(cx / window.innerWidth) * 100}%`
        );
        document.documentElement.style.setProperty(
          '--theme-y',
          `${(cy / window.innerHeight) * 100}%`
        );

        const transition = (document as any).startViewTransition(() => {
          setTheme(newTheme);
        });

        transition.finished.then(() => {
          isTransitioning.current = false;
        });
      } else {
        isTransitioning.current = true;

        const overlay = document.createElement('div');
        overlay.className = 'theme-transition-overlay';

        const isDarkToLight = resolvedTheme === 'dark' && newTheme === 'light';
        overlay.classList.add(
          isDarkToLight ? 'theme-transition-light' : 'theme-transition-dark'
        );

        document.body.appendChild(overlay);

        requestAnimationFrame(() => {
          overlay.classList.add('active');
          setTimeout(() => setTheme(newTheme), 300);
          setTimeout(() => {
            overlay.classList.add('complete');
            setTimeout(() => {
              overlay.remove();
              isTransitioning.current = false;
            }, 380);
          }, 620);
        });
      }
    },
    [setTheme, resolvedTheme]
  );

  const toggleTheme = useCallback(
    (event?: React.MouseEvent) => {
      const newTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
      setThemeWithTransition(newTheme, event);
    },
    [resolvedTheme, setThemeWithTransition]
  );

  return {
    theme,
    resolvedTheme,
    setTheme: setThemeWithTransition,
    toggleTheme,
  };
}
