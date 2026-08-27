import { FreeCheckout } from '@/app/free/free-checkout'
import { FreeHowItWorks } from '@/app/free/free-how-it-works'
import { FreePageViewTracker } from '@/app/free/free-page-view-tracker'
import { FreeVenuesLogoGrid, type FreeVenueLogo } from '@/app/free/free-venues-logo-grid'
import { loadHomeRestaurants } from '@/lib/home/load-home-restaurants'
import { getBrandKey } from '@/lib/brand'
import { pluralizeRu } from '@/lib/ru-plural'
import { parseUtmFromSearchParams } from '@/lib/utm'
import { resolveFreeCity } from '@/lib/free-city'
import {
  CITY_LABELS,
  CITY_LABELS_PREPOSITIONAL,
} from '@/lib/cities'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams: Promise<{
    promo?: string
    promo_code?: string
    utm_source?: string
    utm_medium?: string
    utm_campaign?: string
    city?: string
  }>
}

const DEFAULT_MEMBER_DISCOUNT_PERCENT = 50

/** utm_source=qr_{venue_slug} → slug (не city-маркеры). */
function parseQrVenueSlug(utmSource: string | null): string | null {
  if (!utmSource) return null
  const raw = utmSource.trim()
  const lower = raw.toLowerCase()
  if (
    lower === 'qr' ||
    lower === 'qr_almaty' ||
    lower === 'qr_astana' ||
    lower === 'qr-almaty' ||
    lower === 'qr-astana'
  ) {
    return null
  }
  const match = /^qr_(.+)$/i.exec(raw)
  const slug = match?.[1]?.trim()
  return slug || null
}

function memberDiscountPercent(
  offers: ReadonlyArray<{ offer_type: string; is_active: boolean }>,
): number {
  const has2for1 = offers.some(
    (o) => o.is_active && o.offer_type === '2for1',
  )
  return has2for1 ? 50 : DEFAULT_MEMBER_DISCOUNT_PERCENT
}

export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  const sp = await searchParams
  const utm = parseUtmFromSearchParams(sp)
  const city = resolveFreeCity(sp.city, utm.utm_source)
  const inCity = CITY_LABELS_PREPOSITIONAL[city]

  return {
    title: 'kudaclub — первый месяц 1 ₸',
    description: `Подписка на скидки в ресторанах в ${inCity}. Первый месяц 1 ₸ — оформите по QR.`,
    robots: { index: false, follow: false },
  }
}

export default async function FreePage({ searchParams }: PageProps) {
  const sp = await searchParams
  const utm = parseUtmFromSearchParams(sp)
  const promoCode = utm.promo_code ?? 'FREE30'
  const city = resolveFreeCity(sp.city, utm.utm_source)
  const venueSlug = parseQrVenueSlug(utm.utm_source)

  const { restaurantsWithStatus } = await loadHomeRestaurants(city)
  const venuesCount = restaurantsWithStatus.length
  const cityLabel = CITY_LABELS[city]

  const matchedVenue = venueSlug
    ? restaurantsWithStatus.find((r) => r.slug === venueSlug) ?? null
    : null

  const venuesWord = pluralizeRu(venuesCount, [
    'заведении',
    'заведениях',
    'заведениях',
  ])

  const headline = matchedVenue
    ? `В ${matchedVenue.restaurant_name} — скидка ${memberDiscountPercent(matchedVenue.offers)}% для участников kudaclub`
    : `Скидки в ${venuesCount} ${venuesWord} ${cityLabel}`

  const checkoutSource = matchedVenue
    ? `free-qr-${matchedVenue.slug}`
    : `free-page-${city}`

  const seenBrands = new Set<string>()
  const logoVenues: FreeVenueLogo[] = []
  for (const r of restaurantsWithStatus) {
    const key = getBrandKey(r)
    if (seenBrands.has(key)) continue
    seenBrands.add(key)
    logoVenues.push({
      id: r.id,
      name: r.restaurant_name,
      slug: r.slug,
      photoUrl: r.cover_photo_url ?? null,
    })
  }

  return (
    <>
      <FreePageViewTracker
        utmSource={utm.utm_source}
        venueSlug={matchedVenue?.slug ?? null}
        promoCode={promoCode}
        city={city}
      />

      <section className="px-5 pt-10 pb-8 md:pt-14 md:pb-10">
        <div className="mx-auto max-w-[440px] text-center">
          <h1 className="text-[26px] font-medium leading-[1.2] tracking-[-0.4px] text-neutral-900 md:text-[30px]">
            {headline}
          </h1>
          <p className="mt-3 text-sm leading-[1.55] text-neutral-600">
            kudaclub — подписка на скидки. Первый месяц 1 ₸
          </p>

          <div className="mt-7 text-left">
            <FreeCheckout source={checkoutSource} promoCode={promoCode} />
          </div>
        </div>
      </section>

      <FreeVenuesLogoGrid venues={logoVenues} cityLabel={cityLabel} />

      <div className="bg-neutral-50">
        <FreeHowItWorks venuesCount={venuesCount} cityLabel={cityLabel} />
      </div>
    </>
  )
}
