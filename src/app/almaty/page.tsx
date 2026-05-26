export const revalidate = 300
import { VenuesSection } from '@/components/home/venues-section'
import { loadHomeRestaurants } from '@/lib/home/load-home-restaurants'

export default async function AlmatyPage() {
  const { restaurantsWithStatus, cuisineOptions } = await loadHomeRestaurants()

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:py-12">
      <VenuesSection
        restaurants={restaurantsWithStatus}
        cuisineOptions={cuisineOptions}
      />
    </div>
  )
}
