'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, Clock, MapPin, Star } from 'lucide-react'
import {
  DEFAULT_TZ,
  WEEKDAY_LABELS_RU,
  computeOpenStatus,
  formatHoursRange,
  getTodayDow,
  type RestaurantHour,
} from '@/lib/opening-hours'
import { haversineDistanceKm, formatDistanceFromUser } from '@/lib/distance'
import { useUserLocation } from '@/lib/user-location'

type ExternalRating = {
  rating: number
  reviewsCount: number
  url: string
}

type RestaurantHeroMetaProps = {
  restaurantHours: RestaurantHour[]
  address: string
  restaurantLat: number | null
  restaurantLng: number | null
  externalRating: ExternalRating | null
  mapSectionId: string
}

const ICON_SIZE = 13

const STATUS_OPEN_COLOR = '#0F6E56'

export function RestaurantHeroMeta({
  restaurantHours,
  address,
  restaurantLat,
  restaurantLng,
  externalRating,
  mapSectionId,
}: RestaurantHeroMetaProps) {
  const [hoursExpanded, setHoursExpanded] = useState(false)
  const userLocation = useUserLocation()

  const status = useMemo(
    () => computeOpenStatus(restaurantHours, new Date(), DEFAULT_TZ),
    [restaurantHours]
  )

  const todayDow = useMemo(() => getTodayDow(new Date(), DEFAULT_TZ), [])

  const hoursByDay = useMemo(
    () => new Map(restaurantHours.map((item) => [item.day_of_week, item])),
    [restaurantHours]
  )

  const distanceLabel = useMemo(() => {
    if (restaurantLat == null || restaurantLng == null) return null
    if (!userLocation) return null
    const km = haversineDistanceKm(
      userLocation.lat,
      userLocation.lng,
      restaurantLat,
      restaurantLng
    )
    return formatDistanceFromUser(km)
  }, [userLocation, restaurantLat, restaurantLng])

  const handleScrollToMap = () => {
    if (typeof document === 'undefined') return
    document.getElementById(mapSectionId)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }

  const statusLabel = formatStatusInline(status)
  const statusIsOpen = status.isOpen
  const hasAddress = address && address.trim().length > 0
  const hasCoordinates = restaurantLat != null && restaurantLng != null
  const hasHours = restaurantHours.length > 0

  return (
    <div className="flex flex-col text-sm" style={{ gap: '8px' }}>
      {/* Row 1: opening hours */}
      {hasHours ? (
        <div>
          <div className="flex items-center" style={{ gap: '6px' }}>
            <Clock
              size={ICON_SIZE}
              style={{ opacity: 0.55 }}
              strokeWidth={1.5}
              aria-hidden="true"
            />
            <span
              style={{
                color: statusIsOpen ? STATUS_OPEN_COLOR : undefined,
                fontWeight: 500,
              }}
              className={statusIsOpen ? '' : 'text-neutral-500'}
            >
              {statusLabel}
            </span>
            <button
              type="button"
              onClick={() => setHoursExpanded((prev) => !prev)}
              aria-expanded={hoursExpanded}
              className="inline-flex items-center text-neutral-400 transition-colors hover:text-neutral-600"
              style={{ marginLeft: '4px', fontSize: '12px' }}
            >
              <span>часы работы</span>
              <ChevronDown
                size={10}
                strokeWidth={1.8}
                className={`ml-1 transition-transform ${hoursExpanded ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>
          </div>

          {hoursExpanded ? (
            <ul
              className="mt-2 ml-[19px] flex flex-col"
              style={{ gap: '4px', fontSize: '12px' }}
            >
              {Array.from({ length: 7 }, (_, idx) => idx + 1).map((day) => {
                const item = hoursByDay.get(day)
                const isToday = day === todayDow
                const isClosed = !item || item.is_closed
                return (
                  <li
                    key={day}
                    className={isClosed ? 'text-neutral-400' : 'text-neutral-600'}
                    style={{ fontWeight: isToday ? 500 : 400 }}
                  >
                    <span>{WEEKDAY_LABELS_RU[day]}:</span>{' '}
                    <span>{formatHoursRange(item)}</span>
                  </li>
                )
              })}
            </ul>
          ) : null}
        </div>
      ) : null}

      {/* Row 2: address + distance + scroll-to-map */}
      {hasAddress ? (
        <div className="flex items-center" style={{ gap: '6px' }}>
          <MapPin
            size={ICON_SIZE}
            style={{ opacity: 0.55 }}
            strokeWidth={1.5}
            aria-hidden="true"
          />
          <span className="text-neutral-700">
            {address}
            {distanceLabel ? (
              <span className="text-neutral-500"> · {distanceLabel}</span>
            ) : null}
          </span>
          {hasCoordinates ? (
            <button
              type="button"
              onClick={handleScrollToMap}
              className="text-neutral-400 underline-offset-2 transition-colors hover:text-neutral-600 hover:underline"
              style={{ marginLeft: '4px', fontSize: '12px' }}
            >
              показать на карте
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Row 3: external rating */}
      {externalRating ? (
        <a
          href={externalRating.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="inline-flex items-center text-neutral-600 transition-colors hover:text-neutral-700 hover:underline"
          style={{ gap: '6px' }}
        >
          <Star
            size={ICON_SIZE}
            style={{ opacity: 0.55 }}
            strokeWidth={1.5}
            aria-hidden="true"
          />
          <span>
            {externalRating.rating.toFixed(1)} · {externalRating.reviewsCount} отзывов
          </span>
          <span className="text-neutral-400" style={{ fontSize: '11px', marginLeft: '3px' }}>
            в 2GIS
          </span>
        </a>
      ) : null}
    </div>
  )
}

function formatStatusInline(status: { isOpen: boolean; labelDetail: string | null }): string {
  if (status.isOpen) {
    if (status.labelDetail?.startsWith('Работает до ')) {
      return `Открыто ${status.labelDetail.replace('Работает до ', 'до ')}`
    }
    return 'Открыто'
  }

  if (!status.labelDetail) return 'Закрыто'

  if (status.labelDetail.startsWith('Откроется завтра в ')) {
    const time = status.labelDetail.replace('Откроется завтра в ', '')
    return `Закрыто, откроется завтра в ${time}`
  }

  const todayMatch = status.labelDetail.match(/^Откроется в (\d{2}:\d{2})$/)
  if (todayMatch) {
    return `Закрыто, откроется в ${todayMatch[1]}`
  }

  const laterMatch = status.labelDetail.match(/^Откроется в ([а-я]{2}) в (\d{2}:\d{2})$/i)
  if (laterMatch) {
    return `Закрыто, откроется в ${laterMatch[1]} в ${laterMatch[2]}`
  }

  return 'Закрыто'
}
