import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { VenuesSection } from '@/components/home/venues-section'
import { HomeMobileControls } from '@/components/home/home-mobile-controls'
import { HeroGuest } from '@/components/home/hero-guest'
import { HeroMember } from '@/components/home/hero-member'
import { HowItWorks } from '@/components/home/how-it-works'
import { PopularOffers } from '@/components/home/popular-offers'
import {
  ForVenuesSection,
  FormerSubscribersSection,
  HomeFaq,
  WhyFreeSection,
} from '@/components/home/free-model-sections'
import { SavingsCounter } from '@/components/home/savings-counter'
import { getGuestAccess, getUserSavings } from '@/lib/guest-access'
import { getDisplayedSavingsStats } from '@/lib/savings-stats'
import { cityDescription, cityTitle, pageMetadata } from '@/lib/seo'
import { loadHomeRestaurants } from '@/lib/home/load-home-restaurants'
import { pickPopularOffers } from '@/lib/home/popular-offers'
import { pluralizeRu } from '@/lib/ru-plural'
import { CITY_LABELS_GENITIVE, isCity } from '@/lib/cities'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ city: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city } = await params
  if (!isCity(city)) return {}

  const venuesCount = await loadHomeRestaurants(city)
    .then((data) => data.restaurantsWithStatus.length)
    .catch(() => null)
  return pageMetadata({
    title: cityTitle(city),
    description: cityDescription(city, venuesCount),
    path: `/${city}`,
  })
}

export default async function CityCatalogPage({ params }: PageProps) {
  const { city } = await params
  if (!isCity(city)) notFound()

  const [access, restaurantsData, savingsStats] = await Promise.all([
    getGuestAccess(),
    loadHomeRestaurants(city),
    getDisplayedSavingsStats(city),
  ])
  const savingsCounter = savingsStats ? (
    <div className="pb-4 md:pb-6">
      <SavingsCounter {...savingsStats} />
    </div>
  ) : null

  const { restaurantsWithStatus, cuisineOptions } = restaurantsData
  const totalVenues = restaurantsWithStatus.length
  const venuesWord = pluralizeRu(totalVenues, [
    'заведение',
    'заведения',
    'заведений',
  ])
  const cityName = CITY_LABELS_GENITIVE[city]
  const venuesSectionTitle =
    totalVenues > 0 ? `${totalVenues} ${venuesWord} ${cityName}` : `Заведения ${cityName}`
  const popularOffers = pickPopularOffers(restaurantsWithStatus)

  const catalog = (
    <div id="venues" className="mx-auto max-w-6xl px-5 py-8 md:py-12">
      <VenuesSection
        restaurants={restaurantsWithStatus}
        cuisineOptions={cuisineOptions}
        city={city}
        title={venuesSectionTitle}
      />

      <HomeMobileControls
        cuisineOptions={cuisineOptions}
        applyCount={restaurantsWithStatus.length}
        city={city}
      />
    </div>
  )

  if (access.kind === 'member') {
    const savings = await getUserSavings(access.user.id)

    return (
      <>
        <HeroMember
          isFounder={access.isFounder}
          savingsAmountKzt={savings.amountKzt}
          hasRedemptions={savings.hasRedemptions}
        />
        {savingsCounter}
        <PopularOffers offers={popularOffers} />
        {catalog}
        <ForVenuesSection />
      </>
    )
  }

  return (
    <>
      <HeroGuest city={city} />
      {savingsCounter}
      <HowItWorks />
      <PopularOffers offers={popularOffers} />
      {catalog}
      <WhyFreeSection />
      <FormerSubscribersSection />
      <ForVenuesSection />
      <HomeFaq />
    </>
  )
}
