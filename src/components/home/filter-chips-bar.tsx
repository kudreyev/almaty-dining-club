'use client'

import {
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { Clock } from 'lucide-react'
import { SortModeSegment } from '@/components/home/sort-mode-segment'
import type { SortMode } from '@/lib/restaurant-filters'
import type { OfferType } from '@/lib/types'

type Props = {
  openNow: boolean
  offers: Set<OfferType>
  cuisines: Set<string>
  cuisineOptions: string[]
  onToggleOpenNow: () => void
  onToggleOffer: (offer: OfferType) => void
  onToggleCuisine: (cuisine: string) => void
  sortMode: SortMode
  distanceDisabled: boolean
  onSortModeChange: (mode: SortMode) => void
  onRequestDistanceMode: () => void
}

const DRAG_THRESHOLD_PX = 5

export function FilterChipsBar({
  openNow,
  offers,
  cuisines,
  cuisineOptions,
  onToggleOpenNow,
  onToggleOffer,
  onToggleCuisine,
  sortMode,
  distanceDisabled,
  onSortModeChange,
  onRequestDistanceMode,
}: Props) {
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const [isStuck, setIsStuck] = useState(false)

  const dragStateRef = useRef<{
    isDown: boolean
    moved: boolean
    startX: number
    startScrollLeft: number
  }>({ isDown: false, moved: false, startX: 0, startScrollLeft: 0 })

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      ([entry]) => setIsStuck(!entry.isIntersecting),
      { rootMargin: '-1px 0px 0px 0px', threshold: [0, 1] }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [])

  function handleMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    const scroller = scrollerRef.current
    if (!scroller) return
    dragStateRef.current = {
      isDown: true,
      moved: false,
      startX: event.pageX,
      startScrollLeft: scroller.scrollLeft,
    }
  }

  function handleMouseMove(event: MouseEvent<HTMLDivElement>) {
    const state = dragStateRef.current
    if (!state.isDown) return
    const scroller = scrollerRef.current
    if (!scroller) return
    const dx = event.pageX - state.startX
    if (!state.moved && Math.abs(dx) > DRAG_THRESHOLD_PX) {
      state.moved = true
    }
    if (state.moved) {
      event.preventDefault()
      scroller.scrollLeft = state.startScrollLeft - dx
    }
  }

  function endDrag() {
    dragStateRef.current.isDown = false
  }

  function handleClickCapture(event: MouseEvent<HTMLDivElement>) {
    if (dragStateRef.current.moved) {
      event.preventDefault()
      event.stopPropagation()
      dragStateRef.current.moved = false
    }
  }

  function handleChipFocus(event: FocusEvent<HTMLElement>) {
    const target = event.target as HTMLElement
    if (typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
  }

  return (
    <>
      <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />
      <div
        className={`sticky top-0 z-10 -mx-5 mb-6 transition-colors duration-150 ${
          isStuck
            ? 'bg-white/90 backdrop-blur-sm border-b border-neutral-100'
            : 'bg-transparent'
        }`}
      >
        <div className="relative">
          <div
            ref={scrollerRef}
            className="scrollbar-hide flex gap-2 overflow-x-auto overflow-y-hidden px-4 py-2.5 md:px-6 cursor-grab active:cursor-grabbing scroll-smooth [-webkit-overflow-scrolling:touch]"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={endDrag}
            onMouseLeave={endDrag}
            onClickCapture={handleClickCapture}
          >
            <SortModeSegment
              sortMode={sortMode}
              distanceDisabled={distanceDisabled}
              onChange={onSortModeChange}
              onRequestDistance={onRequestDistanceMode}
              onFocus={handleChipFocus}
            />

            <Chip
              active={openNow}
              onClick={onToggleOpenNow}
              onFocus={handleChipFocus}
              icon={<Clock size={12} aria-hidden="true" />}
            >
              Открыто сейчас
            </Chip>

            <Chip
              active={offers.has('2for1')}
              onClick={() => onToggleOffer('2for1')}
              onFocus={handleChipFocus}
            >
              2 за 1
            </Chip>

            <Chip
              active={offers.has('compliment')}
              onClick={() => onToggleOffer('compliment')}
              onFocus={handleChipFocus}
            >
              В подарок
            </Chip>

            {cuisineOptions.map((cuisine) => (
              <Chip
                key={cuisine}
                active={cuisines.has(cuisine)}
                onClick={() => onToggleCuisine(cuisine)}
                onFocus={handleChipFocus}
              >
                {cuisine}
              </Chip>
            ))}
          </div>

          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-white to-transparent"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-white to-transparent"
          />
        </div>
      </div>
    </>
  )
}

type ChipProps = {
  active: boolean
  onClick: () => void
  onFocus?: (event: FocusEvent<HTMLButtonElement>) => void
  icon?: ReactNode
  children: ReactNode
}

function Chip({ active, onClick, onFocus, icon, children }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      onFocus={onFocus}
      aria-pressed={active}
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border text-sm transition-colors duration-150 px-3.5 py-[7px] ${
        active
          ? 'border-primary bg-primary text-white font-normal'
          : 'border-neutral-200 bg-white text-neutral-900 font-normal hover:border-neutral-400 hover:bg-neutral-50'
      }`}
      style={{ borderWidth: '0.5px' }}
    >
      {icon ? (
        <span className={active ? 'opacity-100' : 'opacity-60'}>{icon}</span>
      ) : null}
      {children}
    </button>
  )
}
