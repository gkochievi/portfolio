import { CenteredLoader } from '@/components/ui'

/** Suspense fallback while a lazy page chunk loads. Owner: shell agent. */
export function PageFallback() {
  return <CenteredLoader />
}
