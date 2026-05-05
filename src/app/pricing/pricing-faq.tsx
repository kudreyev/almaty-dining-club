'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

type FaqItem = {
  q: string
  a: string
}

type PricingFaqProps = {
  items: FaqItem[]
}

export function PricingFaq({ items }: PricingFaqProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <div>
      {items.map((item, idx) => {
        const isOpen = openIndex === idx
        const isLast = idx === items.length - 1
        return (
          <div
            key={idx}
            className={
              isLast
                ? 'border-t-[0.5px] border-b-[0.5px] border-neutral-200'
                : 'border-t-[0.5px] border-neutral-200'
            }
          >
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpenIndex(isOpen ? null : idx)}
              className="flex w-full items-center justify-between gap-4 py-4 text-left"
            >
              <span className="text-sm font-medium text-neutral-900">
                {item.q}
              </span>
              <ChevronDown
                size={12}
                aria-hidden="true"
                className={`shrink-0 text-neutral-500 transition-transform duration-200 ${
                  isOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
            {isOpen ? (
              <p className="mt-1.5 pb-4 text-[13px] leading-[1.55] text-neutral-600">
                {item.a}
              </p>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
