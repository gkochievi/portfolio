import { Toaster as Sonner, toast } from 'sonner'

import { useResolvedTheme } from '@/styles/theme'

/** Themed sonner toaster; mounted once by the RootLayout. Use `toast.success(...)` etc. anywhere. */
export function Toaster() {
  const theme = useResolvedTheme()
  return <Sonner theme={theme} position="top-right" closeButton richColors={false} duration={4000} offset={16} toastOptions={{ className: 'chiti-toast' }} />
}

export { toast }
