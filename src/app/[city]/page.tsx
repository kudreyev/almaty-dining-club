import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { VenuesSection } from '@/components/home/venues-section'
import { HomeMobileControls } from '@/components/home/home-mobile-controls'
import { HeroGuest } from '@/components/home/hero-guest'
import { HeroSubscriber } from '@/components/home/hero-subscriber'
import { HowItWorks } from '@/components/home/how-it-works'
import { EconomicsSection } from '@/components/home/economics-section'
import { FinalCta } from '@/components/sections/final-cta'
import { getHomePageUserState, getUserSavings } from '@/lib/subscription'
import { loadHomeRestaurants } from '@/lib/home/load-home-restaurants'
import { pluralizeRu } from '@/lib/ru-plural'
import {
  CITY_LABELS_GENITIVE,
  CITY_LABELS_PREPOSITIONAL,
  isCity,
} from '@/lib/cities'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ city: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city } = await params
  if (!isCity(city)) return {}

  const prepositional = CITY_LABELS_PREPOSITIONAL[city]
  return {
    title: `Kudaclub — подписка на рестораны в ${prepositional}`,
    description: `Подписка с офферами 1+1 и в подарок в ресторанах в ${prepositional}.`,
  }
}

export default async function CityCatalogPage({ params }: PageProps) {
  const { city } = await params
  if (!isCity(city)) notFound()

  const [userState, restaurantsData] = await Promise.all([
    getHomePageUserState(),
    loadHomeRestaurants(city),
  ])

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

  const isSubscriber = userState.kind === 'paid' || userState.kind === 'trial'

  if (isSubscriber) {
    const savings = await getUserSavings(userState.user.id)

    return (
      <>
        <HeroSubscriber
          planType={userState.kind === 'trial' ? 'trial' : 'paid'}
          endDate={userState.endDate}
          daysLeft={userState.kind === 'trial' ? userState.daysLeft : undefined}
          savingsAmountKzt={savings.amountKzt}
          hasRedemptions={savings.hasRedemptions}
        />

        <div id="venues" className="mx-auto max-w-6xl px-5 pb-12 pt-2 md:pb-16">
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
      </>
    )
  }

  return (
    <>
      <HeroGuest venuesCount={totalVenues} city={city} />

      <HowItWorks venuesCount={totalVenues} city={city} />

      <div
        id="venues"
        className="mx-auto max-w-6xl px-5 py-8 md:py-12"
      >
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

      <EconomicsSection />

      <FinalCta />
    </>
  )
}
