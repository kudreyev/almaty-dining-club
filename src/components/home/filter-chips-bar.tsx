'use client'

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
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

const DRAG_THRESHOLD_PX = 5

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
            <Chip
              active={openNow}
              onClick={onToggleOpenNow}
              onFocus={handleChipFocus}
              icon={<Clock size={12} aria-hidden="true" />}
            >
              Открыто сейчас
            </Chip>

            <ProximityChip
              active={nearby}
              disabled={proximityDisabled}
              onClick={onToggleNearby}
              onFocus={handleChipFocus}
            />

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

function ProximityChip({
  active,
  disabled,
  onClick,
  onFocus,
}: {
  active: boolean
  disabled: boolean
  onClick: () => void
  onFocus?: (event: FocusEvent<HTMLButtonElement>) => void
}) {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)

  const updatePos = () => {
    const button = buttonRef.current
    if (!button) return
    const rect = button.getBoundingClientRect()
    setPopoverPos({
      top: rect.bottom + 8,
      left: rect.left + rect.width / 2,
    })
  }

  useLayoutEffect(() => {
    if (!popoverOpen) return
    updatePos()
  }, [popoverOpen])

  useEffect(() => {
    if (!popoverOpen) return

    function onScroll() {
      updatePos()
    }
    function onResize() {
      updatePos()
    }
    function onDocClick(event: globalThis.MouseEvent) {
      if (!buttonRef.current) return
      if (!buttonRef.current.contains(event.target as Node)) {
        setPopoverOpen(false)
      }
    }
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') setPopoverOpen(false)
    }

    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)

    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
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

  function handleFocus(event: FocusEvent<HTMLButtonElement>) {
    if (onFocus) onFocus(event)
    if (disabled) setPopoverOpen(true)
  }

  function handleBlur() {
    if (disabled) setPopoverOpen(false)
  }

  return (
    <div
      className="relative shrink-0"
      onMouseEnter={() => disabled && setPopoverOpen(true)}
      onMouseLeave={() => disabled && setPopoverOpen(false)}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        aria-pressed={active}
        aria-disabled={disabled || undefined}
        aria-describedby={disabled && popoverOpen ? 'proximity-tooltip' : undefined}
        className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border text-sm transition-colors duration-150 px-3.5 py-[7px] ${
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

      {disabled && popoverOpen && popoverPos && typeof document !== 'undefined'
        ? createPortal(
            <div
              id="proximity-tooltip"
              role="tooltip"
              style={{
                position: 'fixed',
                top: popoverPos.top,
                left: popoverPos.left,
                transform: 'translateX(-50%)',
              }}
              className="z-[60] w-max max-w-[260px] rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-700 shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
            >
              <span
                aria-hidden="true"
                className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-l border-t border-neutral-200 bg-white"
              />
              Включите геолокацию в настройках браузера
            </div>,
            document.body
          )
        : null}
    </div>
  )
}
