'use client'

import { useState } from 'react'

type Item = { q: string; a: string }

export function FaqAccordion({ items }: { items: Item[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <div className="divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white">
      {items.map((item, idx) => {
        const isOpen = openIndex === idx
        return (
          <div key={idx}>
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : idx)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50"
            >
              {item.q}
              <svg
                className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
            <div
              className={`overflow-hidden transition-all duration-200 ${
                isOpen ? 'max-h-60 pb-4' : 'max-h-0'
              }`}
            >
              <p className="px-5 text-sm leading-relaxed text-gray-500">{item.a}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
