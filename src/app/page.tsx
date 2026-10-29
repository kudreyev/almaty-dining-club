import type { Metadata } from 'next'
import { CityLanding } from '@/components/city-landing'
import { SavingsCounter } from '@/components/home/savings-counter'
import { getDisplayedSavingsStats } from '@/lib/savings-stats'
import { SITE_DESCRIPTION, SITE_TITLE, pageMetadata } from '@/lib/seo'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = pageMetadata({
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  path: '/',
})

/**
 * Выбор города со ссылками на все города. Людей middleware сразу уводит в их город
 * (cookie kc_city или IP), а поисковые роботы остаются здесь и индексируют страницу.
 */
export default async function RootPage() {
  const savingsStats = await getDisplayedSavingsStats(null)
  return (
    <>
      <CityLanding />
      {savingsStats ? (
        <div className="pb-12">
          <SavingsCounter {...savingsStats} />
        </div>
      ) : null}
    </>
  )
}
