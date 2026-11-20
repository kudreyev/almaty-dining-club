import Link from 'next/link'
import { formatActiveEventBanner } from '@/lib/home/load-home-restaurants'
import type { FestivalEvent } from '@/lib/events'
import type { City } from '@/lib/cities'
import { isFestivalAdminOnly } from '@/lib/festival-access'

type Props = {
  city: City
  event: FestivalEvent
}

/** Отдельная плашка активного фестиваля над каталогом. */
export function FestivalBanner({ city, event }: Props) {
  return (
    <div className="mx-auto max-w-6xl px-5 pt-4 md:pt-6">
      {isFestivalAdminOnly() ? (
        <p className="mb-2 text-xs text-amber-800">
          Превью для админов — гости плашку не видят
        </p>
      ) : null}
      <Link
        href={`/${city}/${event.slug}`}
        className="block overflow-hidden rounded-2xl shadow-sm transition-opacity hover:opacity-95"
        style={{ backgroundColor: event.accent_color }}
      >
        <div className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5 sm:py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-white/75">
              Фестиваль
            </p>
            <p className="mt-0.5 truncate text-base font-semibold text-white sm:text-lg">
              {formatActiveEventBanner(event)}
            </p>
          </div>
          <span className="shrink-0 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium text-white">
            Смотреть →
          </span>
        </div>
      </Link>
    </div>
  )
}
