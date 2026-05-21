'use client'

import { MapPin, X } from 'lucide-react'

type Props = {
  onEnable: () => void
  onDismiss: () => void
}

export function GeoSuggestionBanner({ onEnable, onDismiss }: Props) {
  return (
    <div
      role="status"
      className="mb-4 flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
    >
      <span
        aria-hidden="true"
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary"
      >
        <MapPin size={14} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium leading-tight text-neutral-900">
          Показать заведения рядом с вами?
        </p>
        <p className="mt-0.5 text-xs leading-snug text-neutral-500">
          Отсортируем каталог по близости к вашему местоположению.
        </p>
      </div>

      <button
        type="button"
        onClick={onEnable}
        className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
      >
        Включить
      </button>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Скрыть"
        className="shrink-0 rounded-full p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  )
}
