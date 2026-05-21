'use client'

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type MouseEvent as ReactMouseEvent,
  type KeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { MapPin, Sparkles } from 'lucide-react'
import { trackGoal } from '@/lib/analytics-client'
import type { SortMode } from '@/lib/restaurant-filters'

type Props = {
  sortMode: SortMode
  distanceDisabled: boolean
  onChange: (next: SortMode) => void
  onRequestDistance: () => void
  onFocus?: (event: FocusEvent<HTMLButtonElement>) => void
  /** Скрывать ли иконки (для компактных мобильных шитов). */
  compact?: boolean
}

export function SortModeSegment({
  sortMode,
  distanceDisabled,
  onChange,
  onRequestDistance,
  onFocus,
  compact = false,
}: Props) {
  function handleDistanceClick() {
    if (sortMode === 'distance') return
    trackGoal('sort_mode_switch', { mode: 'distance' })
    if (distanceDisabled) {
      // нет разрешения — спросим, родитель решит, что показать (диалог/плашка)
      onRequestDistance()
      return
    }
    onRequestDistance()
  }

  function handleBenefitClick() {
    if (sortMode === 'benefit') return
    trackGoal('sort_mode_switch', { mode: 'benefit' })
    onChange('benefit')
  }

  return (
    <div
      role="tablist"
      aria-label="Сортировка"
      className="inline-flex shrink-0 items-center rounded-full border border-neutral-200 bg-white p-[3px]"
      style={{ borderWidth: '0.5px' }}
    >
      <Segment
        isActive={sortMode === 'distance'}
        onClick={handleDistanceClick}
        onFocus={onFocus}
        icon={!compact ? <MapPin size={12} aria-hidden="true" /> : null}
        disabledHint={distanceDisabled}
        ariaLabel="Сортировка по близости"
      >
        По близости
      </Segment>
      <Segment
        isActive={sortMode === 'benefit'}
        onClick={handleBenefitClick}
        onFocus={onFocus}
        icon={!compact ? <Sparkles size={12} aria-hidden="true" /> : null}
        ariaLabel="Сортировка по выгоде"
      >
        По выгоде
      </Segment>
    </div>
  )
}

function Segment({
  isActive,
  onClick,
  onFocus,
  icon,
  ariaLabel,
  children,
  disabledHint = false,
}: {
  isActive: boolean
  onClick: () => void
  onFocus?: (event: FocusEvent<HTMLButtonElement>) => void
  icon?: React.ReactNode
  ariaLabel?: string
  disabledHint?: boolean
  children: React.ReactNode
}) {
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const [tooltipOpen, setTooltipOpen] = useState(false)
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null)

  const updatePos = () => {
    const button = buttonRef.current
    if (!button) return
    const rect = button.getBoundingClientRect()
    setTooltipPos({
      top: rect.bottom + 8,
      left: rect.left + rect.width / 2,
    })
  }

  useLayoutEffect(() => {
    if (!tooltipOpen) return
    updatePos()
  }, [tooltipOpen])

  useEffect(() => {
    if (!tooltipOpen) return
    function onScroll() {
      updatePos()
    }
    function onDocClick(event: globalThis.MouseEvent) {
      if (!buttonRef.current) return
      if (!buttonRef.current.contains(event.target as Node)) {
        setTooltipOpen(false)
      }
    }
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') setTooltipOpen(false)
    }
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', updatePos)
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', updatePos)
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [tooltipOpen])

  function handleClick(event: ReactMouseEvent<HTMLButtonElement>) {
    if (disabledHint && !isActive) {
      // Покажем тултип, но позволим родителю принять решение.
      onClick()
      setTooltipOpen(true)
      // Закроется автоматически по onDocClick.
      event.preventDefault()
      return
    }
    onClick()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabledHint && !isActive && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault()
      onClick()
      setTooltipOpen(true)
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        role="tab"
        aria-selected={isActive}
        aria-label={ariaLabel}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onFocus={onFocus}
        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-[5px] text-sm transition-colors duration-150 ${
          isActive
            ? 'bg-primary text-white shadow-[0_1px_2px_rgba(216,90,48,0.20)]'
            : 'bg-transparent text-neutral-600 hover:text-neutral-900'
        }`}
      >
        {icon ? (
          <span className={isActive ? 'opacity-100' : 'opacity-60'}>{icon}</span>
        ) : null}
        {children}
      </button>

      {tooltipOpen && tooltipPos && typeof document !== 'undefined'
        ? createPortal(
            <div
              role="tooltip"
              style={{
                position: 'fixed',
                top: tooltipPos.top,
                left: tooltipPos.left,
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
    </>
  )
}
