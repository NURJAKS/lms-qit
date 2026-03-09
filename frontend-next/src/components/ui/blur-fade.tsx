"use client"

import { useRef } from "react"
import {
  AnimatePresence,
  motion,
  useInView,
  type MotionProps,
  type UseInViewOptions,
  type Variants,
} from "motion/react"

type MarginType = UseInViewOptions["margin"]

interface BlurFadeProps extends MotionProps {
  children: React.ReactNode
  className?: string
  variant?: {
    hidden: { y: number }
    visible: { y: number }
  }
  duration?: number
  delay?: number
  offset?: number
  direction?: "up" | "down" | "left" | "right" | "diagonal-top-left" | "diagonal-top-right" | "diagonal-bottom-left" | "diagonal-bottom-right" | "scale"
  inView?: boolean
  inViewMargin?: MarginType
  blur?: string
  scale?: boolean
  rotation?: number
}

const getFilter = (v: Variants[string]) =>
  typeof v === "function" ? undefined : v.filter

export function BlurFade({
  children,
  className,
  variant,
  duration = 0.8,
  delay = 0,
  offset = 50,
  direction = "down",
  inView = false,
  inViewMargin = "-100px",
  blur = "12px",
  scale = false,
  rotation = 0,
  ...props
}: BlurFadeProps) {
  const ref = useRef(null)
  const inViewResult = useInView(ref, { once: true, margin: inViewMargin })
  const isInView = !inView || inViewResult

  // Создаем более драматичные варианты анимации
  const getDefaultVariants = (): Variants => {
    const baseHidden: any = {
      opacity: 0,
      filter: `blur(${blur})`,
    }
    const baseVisible: any = {
      opacity: 1,
      filter: `blur(0px)`,
    }

    switch (direction) {
      case "diagonal-top-left":
        return {
          hidden: {
            ...baseHidden,
            x: -offset * 1.5,
            y: -offset * 1.5,
            scale: scale ? 0.8 : 1,
            rotate: rotation || -5,
          },
          visible: {
            ...baseVisible,
            x: 0,
            y: 0,
            scale: 1,
            rotate: 0,
          },
        }
      case "diagonal-top-right":
        return {
          hidden: {
            ...baseHidden,
            x: offset * 1.5,
            y: -offset * 1.5,
            scale: scale ? 0.8 : 1,
            rotate: rotation || 5,
          },
          visible: {
            ...baseVisible,
            x: 0,
            y: 0,
            scale: 1,
            rotate: 0,
          },
        }
      case "diagonal-bottom-left":
        return {
          hidden: {
            ...baseHidden,
            x: -offset * 1.5,
            y: offset * 1.5,
            scale: scale ? 0.8 : 1,
            rotate: rotation || -5,
          },
          visible: {
            ...baseVisible,
            x: 0,
            y: 0,
            scale: 1,
            rotate: 0,
          },
        }
      case "diagonal-bottom-right":
        return {
          hidden: {
            ...baseHidden,
            x: offset * 1.5,
            y: offset * 1.5,
            scale: scale ? 0.8 : 1,
            rotate: rotation || 5,
          },
          visible: {
            ...baseVisible,
            x: 0,
            y: 0,
            scale: 1,
            rotate: 0,
          },
        }
      case "scale":
        return {
          hidden: {
            ...baseHidden,
            scale: 0.7,
            y: offset * 0.5,
          },
          visible: {
            ...baseVisible,
            scale: 1,
            y: 0,
          },
        }
      case "left":
        return {
          hidden: {
            ...baseHidden,
            x: -offset * 1.2,
            scale: scale ? 0.9 : 1,
            rotate: rotation || -3,
          },
          visible: {
            ...baseVisible,
            x: 0,
            scale: 1,
            rotate: 0,
          },
        }
      case "right":
        return {
          hidden: {
            ...baseHidden,
            x: offset * 1.2,
            scale: scale ? 0.9 : 1,
            rotate: rotation || 3,
          },
          visible: {
            ...baseVisible,
            x: 0,
            scale: 1,
            rotate: 0,
          },
        }
      case "up":
        return {
          hidden: {
            ...baseHidden,
            y: offset * 1.2,
            scale: scale ? 0.9 : 1,
          },
          visible: {
            ...baseVisible,
            y: 0,
            scale: 1,
          },
        }
      case "down":
      default:
        return {
          hidden: {
            ...baseHidden,
            y: -offset * 1.2,
            scale: scale ? 0.9 : 1,
          },
          visible: {
            ...baseVisible,
            y: 0,
            scale: 1,
          },
        }
    }
  }

  const defaultVariants = getDefaultVariants()
  const combinedVariants = variant ?? defaultVariants

  const hiddenFilter = getFilter(combinedVariants.hidden)
  const visibleFilter = getFilter(combinedVariants.visible)

  const shouldTransitionFilter =
    hiddenFilter != null &&
    visibleFilter != null &&
    hiddenFilter !== visibleFilter

  // Более драматичная easing функция с bounce эффектом
  const dramaticEase: [number, number, number, number] = [0.34, 1.56, 0.64, 1]

  return (
    <AnimatePresence>
      <motion.div
        ref={ref}
        initial="hidden"
        animate={isInView ? "visible" : "hidden"}
        exit="hidden"
        variants={combinedVariants}
        transition={{
          delay: delay,
          duration,
          ease: dramaticEase,
          ...(shouldTransitionFilter ? { filter: { duration: duration * 0.8, ease: dramaticEase } } : {}),
        }}
        className={className}
        {...props}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
