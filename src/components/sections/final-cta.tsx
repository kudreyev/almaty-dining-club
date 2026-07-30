'use client'

import { CheckCircle2 } from 'lucide-react'
import SubscribeCTA from '@/components/checkout/subscribe-cta'
import { formatPriceKzt } from '@/lib/pricing'

export function FinalCta() {
  return (
    <section className="mx-auto my-12 max-w-6xl px-4 md:my-16 md:px-6">
      <div className="rounded-md bg-[#1a1a1a] px-8 py-12 text-center md:px-12 md:py-16">
        <h2 className="mb-3 text-[26px] font-medium leading-[1.2] tracking-tight text-white md:text-[32px]">
          Каждый ужин дешевле на <span className="text-[#FF8A5C]">~2 500 ₸</span>
        </h2>

        <p className="mx-auto mb-7 max-w-[480px] text-sm leading-[1.5] text-white/65 md:text-[15px]">
          {formatPriceKzt()} в месяц. Окупается с первого визита. Отменить можно в любой момент.
        </p>

        <SubscribeCTA
          source="home-final"
          className="inline-flex items-center rounded-md bg-[#D85A30] px-7 py-3.5 text-[15px] font-medium text-white transition-all duration-150 hover:bg-[#BA4A26] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
        >
          Попробовать за {formatPriceKzt()}
        </SubscribeCTA>

        <ul className="mt-5 flex flex-col items-center justify-center gap-2 text-xs text-white/50 sm:flex-row sm:gap-4">
          <li className="inline-flex items-center gap-1.5">
            <CheckCircle2 size={11} aria-hidden="true" />
            1 визит окупает подписку
          </li>
          <li className="inline-flex items-center gap-1.5">
            <CheckCircle2 size={11} aria-hidden="true" />
            Отмена в любой момент
          </li>
        </ul>
      </div>
    </section>
  )
}
