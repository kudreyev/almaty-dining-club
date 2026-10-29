'use client'

import { useEffect, useRef } from 'react'
import { formatSavingsDetails, formatSavingsKzt } from '@/lib/savings-format'

const DURATION_MS = 1600

type SavingsCounterProps = {
  totalSaved: number
  guests: number
  redemptions: number
}

/**
 * «Гости уже сэкономили X ₸». Число один раз «досчитывает» от нуля, когда блок
 * попадает в экран. Без JS и при prefers-reduced-motion сразу видно итоговое значение.
 * Ширина зарезервирована невидимым итоговым числом, поэтому вёрстка не прыгает.
 */
export function SavingsCounter({ totalSaved, guests, redemptions }: SavingsCounterProps) {
  const ref = useRef<HTMLDivElement>(null)
  const numberRef = useRef<HTMLSpanElement>(null)
  const finalText = formatSavingsKzt(totalSaved)

  useEffect(() => {
    const node = ref.current
    const number = numberRef.current
    if (!node || !number || typeof IntersectionObserver === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let frame = 0
    const show = (value: number) => {
      number.textContent = formatSavingsKzt(value, totalSaved)
    }
    show(0)

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        observer.disconnect()
        const start = performance.now()
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / DURATION_MS)
          show(Math.round(totalSaved * (1 - Math.pow(1 - t, 3))))
          if (t < 1) frame = requestAnimationFrame(tick)
        }
        frame = requestAnimationFrame(tick)
      },
      { threshold: 0.4 },
    )
    observer.observe(node)

    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
      show(totalSaved)
    }
  }, [totalSaved])

  return (
    <section className="px-5" aria-label="Сколько сэкономили гости KudaClub">
      <div
        ref={ref}
        className="mx-auto flex max-w-3xl flex-col items-center gap-2 rounded-2xl bg-[#FAECE7] px-6 py-7 text-center md:flex-row md:justify-center md:gap-8 md:py-8 md:text-left"
      >
        <div>
          <p className="text-4xl font-semibold leading-none tracking-[-0.02em] text-[#D85A30] tabular-nums md:text-5xl">
            <span className="sr-only">{finalText}</span>
            <span aria-hidden="true" className="inline-grid">
              <span className="invisible col-start-1 row-start-1">{finalText}</span>
              <span ref={numberRef} className="col-start-1 row-start-1">
                {finalText}
              </span>
            </span>
          </p>
          <p className="mt-2 text-sm text-neutral-700">уже сэкономили гости KudaClub</p>
        </div>
        <p className="max-w-[320px] text-sm text-neutral-600 md:text-base">
          {formatSavingsDetails(guests, redemptions)}
        </p>
      </div>
    </section>
  )
}
