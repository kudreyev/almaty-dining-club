import { RestaurantHeroMeta } from './restaurant-hero-meta'
import type { RestaurantHour } from '@/lib/opening-hours'

type ExternalRating = {
  rating: number
  reviewsCount: number
  url: string
}

type RestaurantHeroProps = {
  restaurantName: string
  cuisines: string[]
  tags: string[]
  address: string
  restaurantHours: RestaurantHour[]
  restaurantLat: number | null
  restaurantLng: number | null
  externalRating: ExternalRating | null
  mapSectionId: string
}

export function RestaurantHero({
  restaurantName,
  cuisines,
  tags,
  address,
  restaurantHours,
  restaurantLat,
  restaurantLng,
  externalRating,
  mapSectionId,
}: RestaurantHeroProps) {
  return (
    <section style={{ padding: '24px 20px 16px' }}>
      <div className="flex flex-wrap" style={{ gap: '6px', marginBottom: '12px' }}>
        {cuisines.map((cuisine) => (
          <span
            key={`cuisine-${cuisine}`}
            className="font-medium"
            style={{
              fontSize: '11px',
              padding: '4px 10px',
              borderRadius: '9999px',
              background: '#FAECE7',
              color: '#712B13',
            }}
          >
            {cuisine}
          </span>
        ))}
        {tags.map((tag) => (
          <span
            key={`tag-${tag}`}
            className="bg-neutral-100 text-neutral-600"
            style={{
              fontSize: '11px',
              padding: '4px 10px',
              borderRadius: '9999px',
              fontWeight: 400,
            }}
          >
            {tag}
          </span>
        ))}
      </div>

      <h1
        className="font-medium text-neutral-900"
        style={{
          fontSize: 'clamp(26px, 6vw, 30px)',
          letterSpacing: '-0.4px',
          marginBottom: '16px',
          lineHeight: 1.15,
        }}
      >
        {restaurantName}
      </h1>

      <RestaurantHeroMeta
        restaurantHours={restaurantHours}
        address={address}
        restaurantLat={restaurantLat}
        restaurantLng={restaurantLng}
        externalRating={externalRating}
        mapSectionId={mapSectionId}
      />
    </section>
  )
}
