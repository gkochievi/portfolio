import { createContext, useContext } from 'react';

export type ToastVariant = 'success' | 'error';

export interface ToastApi {
  /** Bottom-right success toast, auto-dismisses. */
  success: (message: string) => void;
  /** Bottom-right error toast, auto-dismisses (a bit slower). */
  error: (message: string) => void;
}

// No-op default so components render safely outside the provider (tests,
// isolated rendering). The app mounts <ToastProvider> in main.tsx.
export const ToastContext = createContext<ToastApi>({
  success: () => undefined,
  error: () => undefined,
});

export function useToast(): ToastApi {
  return useContext(ToastContext);
}
