import Link from 'next/link'
import { formatActiveEventBanner } from '@/lib/home/load-home-restaurants'
import type { FestivalEvent } from '@/lib/events'
import type { City } from '@/lib/cities'
import { isFestivalAdminOnly } from '@/lib/festival-access'

type Props = {
  city: City
  event: FestivalEvent
}

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
        className="flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-95"
        style={{ backgroundColor: event.accent_color }}
      >
        <span>{formatActiveEventBanner(event)}</span>
        <span className="shrink-0 text-white/85">Смотреть →</span>
      </Link>
    </div>
  )
}
