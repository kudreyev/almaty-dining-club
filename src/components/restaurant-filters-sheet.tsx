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
      className="font-medium transition-colors"
      style={
        active
          ? {
              background: '#D85A30',
              color: '#ffffff',
              borderWidth: '0.5px',
              borderStyle: 'solid',
              borderColor: '#D85A30',
              borderRadius: '9999px',
              padding: '6px 14px',
              fontSize: '13px',
            }
          : {
              background: '#ffffff',
              color: 'rgb(64 64 64)',
              borderWidth: '0.5px',
              borderStyle: 'solid',
              borderColor: 'rgb(229 229 229)',
              borderRadius: '9999px',
              padding: '6px 14px',
              fontSize: '13px',
            }
      }
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
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        className="absolute inset-x-0 bottom-0 bg-white shadow-xl"
        style={{
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px',
          borderTopWidth: '0.5px',
          borderTopStyle: 'solid',
          borderTopColor: 'rgb(229 229 229)',
        }}
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
        <div
          aria-hidden="true"
          className="mx-auto"
          style={{
            width: '36px',
            height: '4px',
            borderRadius: '9999px',
            background: 'rgb(229 229 229)',
            marginTop: '8px',
          }}
        />
        <div className="mx-auto w-full max-w-lg" style={{ padding: '16px 20px 20px' }}>
          <div className="flex items-center justify-between" style={{ gap: '12px', marginBottom: '20px' }}>
            <p
              className="font-medium text-neutral-900"
              style={{ fontSize: '18px', letterSpacing: '-0.2px' }}
            >
              {title}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
              style={{ height: '32px', width: '32px' }}
              aria-label="Закрыть"
            >
              <svg viewBox="0 0 24 24" fill="none" style={{ width: '16px', height: '16px' }} aria-hidden="true">
                <path
                  d="M6 6l12 12M18 6 6 18"
                  stroke="currentColor"
                  strokeWidth="1.8"
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
      <div className="flex flex-col" style={{ gap: '20px' }}>
        <div>
          <p
            className="font-medium text-neutral-700"
            style={{ fontSize: '13px', marginBottom: '10px' }}
          >
            Быстрые фильтры
          </p>
          <div className="flex flex-wrap" style={{ gap: '8px' }}>
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
            <p
              className="font-medium text-neutral-700"
              style={{ fontSize: '13px', marginBottom: '10px' }}
            >
              Кухня
            </p>
            <div className="flex flex-wrap" style={{ gap: '8px' }}>
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
          <p className="text-neutral-500" style={{ fontSize: '12px', lineHeight: 1.5 }}>{geoHint}</p>
        ) : null}

        <div className="flex items-center justify-between" style={{ gap: '12px' }}>
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
            className="font-medium text-neutral-500 transition-colors hover:text-neutral-900"
            style={{ fontSize: '13px' }}
          >
            Сбросить
          </button>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center font-medium text-white transition-opacity hover:opacity-95"
            style={{
              background: '#D85A30',
              borderRadius: '8px',
              padding: '11px 20px',
              fontSize: '14px',
            }}
          >
            Применить ({applyCount})
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}

