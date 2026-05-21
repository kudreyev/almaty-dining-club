'use client'

import {
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from 'react'

type Props = {
  /** Уникальный ключ текущего порядка — анимация запускается при его изменении. */
  orderKey: string
  className?: string
  style?: CSSProperties
  children: ReactNode
}

const TRANSITION = 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1)'

/**
 * FLIP-анимация для сетки карточек.
 * Каждая карточка-ребёнок должна быть HTMLElement с атрибутом data-flip-id="<id>".
 * Перемещение происходит плавно: запоминаем DOMRect перед изменением,
 * затем translate с прошлой позиции в новую через requestAnimationFrame.
 */
export function AnimatedGrid({ orderKey, className, style, children }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const prevRectsRef = useRef<Map<string, DOMRect>>(new Map())
  const prevOrderKeyRef = useRef<string>(orderKey)

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    const items = container.querySelectorAll<HTMLElement>('[data-flip-id]')
    const nextRects = new Map<string, DOMRect>()
    for (const el of items) {
      const id = el.dataset.flipId
      if (!id) continue
      nextRects.set(id, el.getBoundingClientRect())
    }

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    if (!prefersReducedMotion && prevOrderKeyRef.current !== orderKey) {
      for (const el of items) {
        const id = el.dataset.flipId
        if (!id) continue
        const prevRect = prevRectsRef.current.get(id)
        const nextRect = nextRects.get(id)
        if (!prevRect || !nextRect) continue
        const dx = prevRect.left - nextRect.left
        const dy = prevRect.top - nextRect.top
        if (dx === 0 && dy === 0) continue

        // FLIP: «invert»
        el.style.transition = 'none'
        el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`
        el.style.willChange = 'transform'
      }

      // «play»
      requestAnimationFrame(() => {
        for (const el of items) {
          el.style.transition = TRANSITION
          el.style.transform = ''
        }
        // Снять will-change после завершения анимации.
        window.setTimeout(() => {
          for (const el of items) {
            el.style.willChange = ''
            el.style.transition = ''
          }
        }, 320)
      })
    }

    prevRectsRef.current = nextRects
    prevOrderKeyRef.current = orderKey
  }, [orderKey, children])

  return (
    <div ref={containerRef} className={className} style={style}>
      {children}
    </div>
  )
}
