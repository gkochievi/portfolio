/**
 * Motion presets (framer-motion). Everything enters by falling: a 12px drop
 * with a fade over 220ms, staggered 30ms. Under prefers-reduced-motion
 * framer's MotionConfig (reducedMotion="user", set in RootLayout) skips them.
 */
import type { Transition, Variants } from 'framer-motion'

export { useReducedMotion } from 'framer-motion'

export const EASE_DROP: [number, number, number, number] = [0.2, 0.8, 0.2, 1]

/** Single element: `<motion.div variants={dropIn} initial="hidden" animate="show">`. */
export const dropIn: Variants = {
  hidden: { opacity: 0, y: -12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: EASE_DROP } },
}

/** Parent of `dropIn` children: staggers them 30ms apart. */
export const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.03 } },
}

/** "+N" persimmon chip: rises 24px and fades over 600ms. */
export const floatUp: Variants = {
  initial: { opacity: 1, y: 0 },
  animate: { opacity: 0, y: -24, transition: { duration: 0.6, ease: EASE_DROP } },
}

/** FLIP reorder for leaderboards: `<motion.li layout transition={flip}>`. */
export const flip: Transition = { layout: { duration: 0.3, ease: EASE_DROP } }

/** New rows slide in from the right. */
export const slideIn: Variants = {
  hidden: { opacity: 0, x: 24 },
  show: { opacity: 1, x: 0, transition: { duration: 0.3, ease: EASE_DROP } },
}

/** Spread onto a motion element for the standard drop-in: `<motion.div {...dropInProps}>`. */
export const dropInProps = { variants: dropIn, initial: 'hidden', animate: 'show' } as const
