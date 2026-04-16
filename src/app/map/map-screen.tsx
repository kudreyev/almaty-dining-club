'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { YandexRestaurantsMap } from '@/components/map/yandex-restaurants-map'

type Place = {
  slug: string
  name: string
  lat: number | null
  lng: number | null
  offerChips: string[]
  offerTypes: Array<'2for1' | 'compliment'>
  cuisines: string[]
  isOpen: boolean
  statusLine: string
}

type FiltersState = {
  openNow: boolean
  offer2for1: boolean
  offerCompliment: boolean
  cuisines: Set<string>
}

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
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
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
            <div className="min-w-0">
              <p className="text-lg font-semibold tracking-tight text-gray-950">{title}</p>
            </div>
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

export function MapScreen({
  places,
  allCuisineOptions,
}: {
  places: Place[]
  allCuisineOptions: string[]
}) {
  const [mode, setMode] = useState<'map' | 'list'>('map')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [filters, setFilters] = useState<FiltersState>(() => ({
    openNow: false,
    offer2for1: false,
    offerCompliment: false,
    cuisines: new Set<string>(),
  }))

  const filteredPlaces = useMemo(() => {
    return places.filter((p) => {
      if (filters.openNow && !p.isOpen) return false

      if (filters.offer2for1 && !p.offerTypes.includes('2for1')) return false
      if (filters.offerCompliment && !p.offerTypes.includes('compliment')) return false

      if (filters.cuisines.size > 0) {
        const hasCuisine = p.cuisines.some((c) => filters.cuisines.has(c))
        if (!hasCuisine) return false
      }

      return true
    })
  }, [places, filters])

  const coordsCount = useMemo(
    () => filteredPlaces.filter((p) => p.lat != null && p.lng != null).length,
    [filteredPlaces]
  )

  const openFilters = useCallback(() => setSheetOpen(true), [])
  const closeFilters = useCallback(() => setSheetOpen(false), [])

  const onFloatingPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation()
  }

  return (
    <div className="relative h-[calc(100dvh-3.5rem)] w-full overflow-hidden sm:h-auto sm:min-h-[calc(100dvh-3.5rem)]">
      {/* CONTENT */}
      <div className="absolute inset-0">
        {mode === 'map' ? (
          <div className="h-full w-full">
            <YandexRestaurantsMap places={filteredPlaces} />
          </div>
        ) : (
          <div className="h-full w-full overflow-y-auto bg-white">
            <div className="mx-auto w-full max-w-6xl px-5 py-5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-lg font-semibold tracking-tight text-gray-950">Список заведений</p>
                <p className="text-sm text-gray-500">{filteredPlaces.length} шт.</p>
              </div>

              {filteredPlaces.length === 0 ? (
                <p className="mt-4 text-base leading-6 text-gray-500">Ничего не найдено. Попробуйте изменить фильтры.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {filteredPlaces.map((p) => (
                    <Link
                      key={p.slug}
                      href={`/r/${encodeURIComponent(p.slug)}`}
                      className="block rounded-2xl border border-gray-200 bg-white p-4 transition-colors hover:bg-gray-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold text-gray-950">{p.name}</p>
                          <p className="mt-1 text-sm text-gray-500">{p.statusLine}</p>
                          {p.offerChips.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {p.offerChips.slice(0, 2).map((chip) => (
                                <span
                                  key={`${p.slug}-${chip}`}
                                  className="inline-flex max-w-full items-center rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-800"
                                >
                                  <span className="truncate">{chip}</span>
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <span className="shrink-0 text-sm font-medium text-gray-900">Открыть →</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* FLOATING CONTROLS (mobile-first) */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center px-4 sm:bottom-6"
        aria-hidden={false}
      >
        <div
          className="pointer-events-auto flex items-center gap-2 rounded-3xl border border-gray-200 bg-white/90 p-1 shadow-sm backdrop-blur"
          onPointerDown={onFloatingPointerDown}
        >
          <button
            type="button"
            onClick={openFilters}
            className="inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-100"
          >
            Фильтр
          </button>
          <button
            type="button"
            onClick={() => setMode((m) => (m === 'map' ? 'list' : 'map'))}
            className="inline-flex items-center justify-center rounded-2xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-black"
          >
            {mode === 'map' ? 'Список' : 'Карта'}
          </button>
        </div>
      </div>

      <BottomSheet open={sheetOpen} title="Фильтры" onClose={closeFilters}>
        <div className="space-y-5">
          <div>
            <p className="text-sm font-medium text-gray-700">Быстрые фильтры</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <FilterChip
                active={filters.openNow}
                onClick={() => setFilters((f) => ({ ...f, openNow: !f.openNow }))}
              >
                Открыто сейчас
              </FilterChip>
              <FilterChip
                active={filters.offer2for1}
                onClick={() => setFilters((f) => ({ ...f, offer2for1: !f.offer2for1 }))}
              >
                2за1
              </FilterChip>
              <FilterChip
                active={filters.offerCompliment}
                onClick={() => setFilters((f) => ({ ...f, offerCompliment: !f.offerCompliment }))}
              >
                В подарок
              </FilterChip>
            </div>
          </div>

          {allCuisineOptions.length > 0 ? (
            <div>
              <p className="text-sm font-medium text-gray-700">Кухня</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {allCuisineOptions.map((c) => (
                  <FilterChip
                    key={c}
                    active={filters.cuisines.has(c)}
                    onClick={() => setFilters((f) => ({ ...f, cuisines: toggleSet(f.cuisines, c) }))}
                  >
                    {c}
                  </FilterChip>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() =>
                setFilters({
                  openNow: false,
                  offer2for1: false,
                  offerCompliment: false,
                  cuisines: new Set<string>(),
                })
              }
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Сбросить
            </button>
            <button
              type="button"
              onClick={closeFilters}
              className="inline-flex items-center justify-center rounded-2xl bg-gray-900 px-5 py-3 text-base font-semibold text-white transition-colors hover:bg-black"
            >
              Применить ({filteredPlaces.length})
            </button>
          </div>

          {process.env.NODE_ENV !== 'production' ? (
            <p className="text-xs text-gray-400">
              dev: всего {places.length} · после фильтра {filteredPlaces.length} · с координатами {coordsCount}
            </p>
          ) : null}
        </div>
      </BottomSheet>
    </div>
  )
}

