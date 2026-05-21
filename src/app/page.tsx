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

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const [userState, restaurantsData] = await Promise.all([
    getHomePageUserState(),
    loadHomeRestaurants(),
  ])

  const { restaurantsWithStatus, cuisineOptions } = restaurantsData
  const totalVenues = restaurantsWithStatus.length
  const venuesWord = pluralizeRu(totalVenues, [
    'заведение',
    'заведения',
    'заведений',
  ])
  const venuesSectionTitle =
    totalVenues > 0 ? `${totalVenues} ${venuesWord} Алматы` : 'Заведения Алматы'

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
            title={venuesSectionTitle}
          />

          <HomeMobileControls
            cuisineOptions={cuisineOptions}
            applyCount={restaurantsWithStatus.length}
          />
        </div>
      </>
    )
  }

  return (
    <>
      <HeroGuest venuesCount={totalVenues} />

      <HowItWorks venuesCount={totalVenues} />

      <div
        id="venues"
        className="mx-auto max-w-6xl px-5 py-8 md:py-12"
      >
        <VenuesSection
          restaurants={restaurantsWithStatus}
          cuisineOptions={cuisineOptions}
          title={venuesSectionTitle}
        />

        <HomeMobileControls
          cuisineOptions={cuisineOptions}
          applyCount={restaurantsWithStatus.length}
        />
      </div>

      <EconomicsSection />

      <FinalCta />
    </>
  )
}
