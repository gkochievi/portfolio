import type { i18n as I18n } from 'i18next';

/**
 * Upstream the two apps are separate deployments, so each owns the default
 * `i18next` singleton and neither can see the other. Here they share a tab, and
 * `i18next.init()` called twice on one singleton means whichever surface mounted
 * last wins — the console's four namespaces would erase the site's eleven.
 *
 * So the console's `lib/i18n.ts` creates its own instance and the surface that
 * mounts provides it through `<I18nextProvider>`. That fixes the clash and
 * introduces a smaller one: a visitor who switches the language in the console
 * and then crosses to the site would find the other instance still holding the
 * language it booted with.
 *
 * Neither instance persists the choice — the demo pins EN on every load — so
 * this relay is the only thing keeping the two in step. It hands the change to
 * the other instance in-tab, and the one that mounts later reads the current
 * language off `<html lang>`, which the change handler has already updated.
 */
const registry = new Set<I18n>();

/*
 * Earlier builds cached the chosen language under this key and read it back
 * ahead of `<html lang>`, which is what made the demo open in Georgian for
 * anyone who had ever switched. Neither instance reads or writes it now, but a
 * returning visitor still carries the value, and a dead key left in storage is
 * how the next person debugging this ends up looking for a second mechanism
 * that no longer exists. There is only one, and it is `<html lang>`.
 *
 * Module scope, not inside `registerI18n`: this runs once for whichever surface
 * loads first, and the other imports the same evaluated module.
 */
try {
  window.localStorage.removeItem('language');
} catch {
  // Private-mode Safari throws on any localStorage access. Nothing to clean up.
}

export function registerI18n(instance: I18n): void {
  if (registry.has(instance)) return;
  registry.add(instance);
  instance.on('languageChanged', (lng: string) => {
    for (const other of registry) {
      if (other !== instance && other.language !== lng) void other.changeLanguage(lng);
    }
  });
}
