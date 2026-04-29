'use client'

import { useMemo, useRef } from 'react'
import type { OfferType, RestaurantFilters } from '@/lib/restaurant-filters'

function toggleSet(set: Set<string>, key: string) {
  const next = new Set(set)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  return next
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
        active ? 'border-gray-900 bg-black text-white' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  )
}

function BottomSheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  const startY = useRef<number | null>(null)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        className="absolute inset-x-0 bottom-0 rounded-t-3xl border border-gray-200 bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => {
          startY.current = e.touches[0]?.clientY ?? null
        }}
        onTouchMove={(e) => {
          if (startY.current == null) return
          const y = e.touches[0]?.clientY ?? 0
          if (y - startY.current > 70) onClose()
        }}
        onTouchEnd={() => {
          startY.current = null
        }}
      >
        <div className="mx-auto w-full max-w-lg p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-lg font-semibold tracking-tight text-gray-950">{title}</p>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
              aria-label="Закрыть"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
                <path
                  d="M6 6l12 12M18 6 6 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}

function toggleOffer(set: Set<OfferType>, key: OfferType) {
  const next = new Set(set)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  return next
}

export function RestaurantFiltersSheet({
  open,
  onClose,
  filters,
  onChange,
  cuisineOptions,
  applyCount,
  geoHint,
}: {
  open: boolean
  onClose: () => void
  filters: RestaurantFilters
  onChange: (next: RestaurantFilters) => void
  cuisineOptions: string[]
  applyCount: number
  geoHint?: string | null
}) {
  const cuisineList = useMemo(() => cuisineOptions.filter(Boolean), [cuisineOptions])

  return (
    <BottomSheet open={open} title="Фильтры" onClose={onClose}>
      <div className="space-y-5">
        <div>
          <p className="text-sm font-medium text-gray-700">Быстрые фильтры</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <FilterChip
              active={filters.openNow}
              onClick={() => onChange({ ...filters, openNow: !filters.openNow })}
            >
              Открыто сейчас
            </FilterChip>
            <FilterChip
              active={filters.nearby}
              onClick={() => onChange({ ...filters, nearby: !filters.nearby })}
            >
              По близости
            </FilterChip>
            <FilterChip
              active={filters.offers.has('2for1')}
              onClick={() => onChange({ ...filters, offers: toggleOffer(filters.offers, '2for1') })}
            >
              2 за 1
            </FilterChip>
            <FilterChip
              active={filters.offers.has('compliment')}
              onClick={() => onChange({ ...filters, offers: toggleOffer(filters.offers, 'compliment') })}
            >
              В подарок
            </FilterChip>
          </div>
        </div>

        {cuisineList.length > 0 ? (
          <div>
            <p className="text-sm font-medium text-gray-700">Кухня</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {cuisineList.map((c) => (
                <FilterChip
                  key={c}
                  active={filters.cuisines.has(c)}
                  onClick={() => onChange({ ...filters, cuisines: toggleSet(filters.cuisines, c) })}
                >
                  {c}
                </FilterChip>
              ))}
            </div>
          </div>
        ) : null}

        {geoHint ? (
          <p className="text-sm leading-6 text-gray-500">{geoHint}</p>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() =>
              onChange({
                openNow: false,
                nearby: false,
                offers: new Set(),
                cuisines: new Set(),
              })
            }
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            Сбросить
          </button>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-2xl bg-gray-900 px-5 py-3 text-base font-semibold text-white transition-colors hover:bg-black"
          >
            Применить ({applyCount})
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}

