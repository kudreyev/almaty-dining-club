'use client'

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { Clock, MapPin } from 'lucide-react'
import type { OfferType } from '@/lib/types'

type Props = {
  openNow: boolean
  nearby: boolean
  offers: Set<OfferType>
  cuisines: Set<string>
  cuisineOptions: string[]
  onToggleOpenNow: () => void
  onToggleNearby: () => void
  onToggleOffer: (offer: OfferType) => void
  onToggleCuisine: (cuisine: string) => void
  proximityDisabled: boolean
}

export function FilterChipsBar({
  openNow,
  nearby,
  offers,
  cuisines,
  cuisineOptions,
  onToggleOpenNow,
  onToggleNearby,
  onToggleOffer,
  onToggleCuisine,
  proximityDisabled,
}: Props) {
  const barRef = useRef<HTMLDivElement | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const [isStuck, setIsStuck] = useState(false)

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

  return (
    <>
      <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />
      <div
        ref={barRef}
        className={`sticky top-0 z-10 -mx-5 px-5 transition-colors duration-150 ${
          isStuck
            ? 'bg-white/90 backdrop-blur-sm border-b border-neutral-100'
            : 'bg-transparent'
        }`}
      >
        <div className="flex flex-wrap items-center gap-2 py-2.5">
          <Chip
            active={openNow}
            onClick={onToggleOpenNow}
            icon={<Clock size={12} aria-hidden="true" />}
          >
            Открыто сейчас
          </Chip>

          <ProximityChip
            active={nearby}
            disabled={proximityDisabled}
            onClick={onToggleNearby}
          />

          <Chip active={offers.has('2for1')} onClick={() => onToggleOffer('2for1')}>
            2 за 1
          </Chip>

          <Chip
            active={offers.has('compliment')}
            onClick={() => onToggleOffer('compliment')}
          >
            В подарок
          </Chip>

          {cuisineOptions.map((cuisine) => (
            <Chip
              key={cuisine}
              active={cuisines.has(cuisine)}
              onClick={() => onToggleCuisine(cuisine)}
            >
              {cuisine}
            </Chip>
          ))}
        </div>
      </div>
    </>
  )
}

type ChipProps = {
  active: boolean
  onClick: () => void
  icon?: ReactNode
  children: ReactNode
}

function Chip({ active, onClick, icon, children }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border text-sm transition-colors duration-150 ${
        active
          ? 'border-primary bg-primary text-white font-normal'
          : 'border-neutral-200 bg-white text-neutral-900 font-normal hover:border-neutral-400 hover:bg-neutral-50'
      } px-3.5 py-[7px]`}
      style={{ borderWidth: '0.5px' }}
    >
      {icon ? (
        <span className={active ? 'opacity-100' : 'opacity-60'}>{icon}</span>
      ) : null}
      {children}
    </button>
  )
}

function ProximityChip({
  active,
  disabled,
  onClick,
}: {
  active: boolean
  disabled: boolean
  onClick: () => void
}) {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!popoverOpen) return

    function onDocClick(event: MouseEvent) {
      if (!wrapperRef.current) return
      if (!wrapperRef.current.contains(event.target as Node)) {
        setPopoverOpen(false)
      }
    }
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') setPopoverOpen(false)
    }

    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [popoverOpen])

  function handleClick() {
    if (disabled) {
      setPopoverOpen((prev) => !prev)
      return
    }
    onClick()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault()
      setPopoverOpen((prev) => !prev)
    }
  }

  return (
    <div
      ref={wrapperRef}
      className="relative"
      onMouseEnter={() => disabled && setPopoverOpen(true)}
      onMouseLeave={() => disabled && setPopoverOpen(false)}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onFocus={() => disabled && setPopoverOpen(true)}
        onBlur={() => disabled && setPopoverOpen(false)}
        aria-pressed={active}
        aria-disabled={disabled || undefined}
        aria-describedby={disabled && popoverOpen ? 'proximity-tooltip' : undefined}
        className={`inline-flex items-center gap-1.5 rounded-full border text-sm transition-colors duration-150 px-3.5 py-[7px] ${
          active
            ? 'border-primary bg-primary text-white'
            : disabled
              ? 'border-neutral-200 bg-white text-neutral-400 cursor-not-allowed'
              : 'border-neutral-200 bg-white text-neutral-900 hover:border-neutral-400 hover:bg-neutral-50'
        }`}
        style={{ borderWidth: '0.5px' }}
      >
        <span className={active ? 'opacity-100' : 'opacity-60'}>
          <MapPin size={12} aria-hidden="true" />
        </span>
        По близости
      </button>

      {disabled && popoverOpen ? (
        <div
          id="proximity-tooltip"
          role="tooltip"
          className="absolute left-1/2 top-full z-20 mt-2 w-max max-w-[260px] -translate-x-1/2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-700 shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
        >
          <span
            aria-hidden="true"
            className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-l border-t border-neutral-200 bg-white"
          />
          Включите геолокацию в настройках браузера
        </div>
      ) : null}
    </div>
  )
}
