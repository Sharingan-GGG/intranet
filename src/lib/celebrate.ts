/**
 * Thin wrapper over public/celebrate.js (loaded by the Audit layout), which
 * sets window.celebrate. A no-op until that script has loaded, and for anyone
 * who has asked their OS for reduced motion.
 */
export type CelebrateOptions = {
  origin?: Element | null
  name?: string
  title?: string
  findings?: number | null
  progress?: string
  label?: string
  message?: string
  intensity?: 'subtle' | 'festive' | 'epic'
  duration?: number
}

declare global {
  interface Window {
    celebrate?: (opts?: CelebrateOptions) => void
  }
}

export function celebrate(opts: CelebrateOptions = {}) {
  if (typeof window === 'undefined') return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  window.celebrate?.(opts)
}
