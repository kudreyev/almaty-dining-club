export const revalidate = 300
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { formatOfferHeadline } from '@/lib/offers'

type Offer = {
  id: string
  offer_type: '2for1' | 'compliment'
  offer_title: string
  offer_terms_short: string
  estimated_value?: number | null
  cooldown_days?: number | null
  is_active: boolean
}

type Restaurant = {
  id: string
  restaurant_name: string
  slug: string
  address: string
  cuisine: string
  cuisine_2: string | null
  cuisine_3: string | null
  short_description: string
  working_hours: string
  photo_1_url: string | null
  offers: Offer[]
}

type PageProps = {
  searchParams: Promise<{
    q?: string
    offer?: string
  }>
}

export default async function AlmatyPage({ searchParams }: PageProps) {
  const { q = '', offer = 'all' } = await searchParams
  const supabase = await createSupabaseServerClient()

  const { data: restaurants, error } = await supabase
    .from('restaurants')
    .select(`
      id, restaurant_name, slug, address,
      cuisine, cuisine_2, cuisine_3,
      short_description, working_hours, photo_1_url,
      offers ( id, offer_type, offer_title, offer_terms_short, estimated_value, cooldown_days, is_active )
    `)
    .eq('city', 'almaty')
    .eq('is_active', true)
    .order('restaurant_name', { ascending: true })

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-5 py-10">
        <h1 className="text-xl font-bold">Рестораны Алматы</h1>
        <p className="mt-4 text-sm text-red-600">Ошибка: {error.message}</p>
      </div>
    )
  }

  const normalizedQuery = q.trim().toLowerCase()

  const filteredRestaurants = (restaurants as Restaurant[]).filter((restaurant) => {
    const matchesQuery =
      !normalizedQuery ||
      restaurant.restaurant_name.toLowerCase().includes(normalizedQuery) ||
      [restaurant.cuisine, restaurant.cuisine_2, restaurant.cuisine_3]
        .filter(Boolean)
        .some((c) => c!.toLowerCase().includes(normalizedQuery))

    const activeOffers = (restaurant.offers || []).filter((item) => item.is_active)
    const matchesOffer = offer === 'all' || activeOffers.some((item) => item.offer_type === offer)

    return matchesQuery && matchesOffer
  })

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Рестораны Алматы</h1>
        <p className="mt-1 text-sm text-gray-500">Партнёры с офферами 2за1 и в подарок.</p>
      </div>

      <Card padding="sm" className="mb-8">
        <form className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="q" className="mb-1.5 block text-xs font-medium text-gray-500">Поиск</label>
            <input
              id="q"
              name="q"
              defaultValue={q}
              placeholder="Название или кухня"
              className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-gray-400 focus:border-accent"
            />
          </div>
          <div className="w-full sm:w-48">
            <label htmlFor="offer" className="mb-1.5 block text-xs font-medium text-gray-500">Тип</label>
            <select
              id="offer"
              name="offer"
              defaultValue={offer}
              className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-accent"
            >
              <option value="all">Все</option>
              <option value="2for1">2за1</option>
              <option value="compliment">в подарок</option>
            </select>
          </div>
          <Button type="submit" size="lg" className="sm:w-auto">Найти</Button>
        </form>
      </Card>

      <div className="mb-6 flex items-baseline justify-between">
        <p className="text-sm text-gray-400">{filteredRestaurants.length} шт.</p>
      </div>

      {filteredRestaurants.length === 0 ? (
        <EmptyState title="Ничего не найдено" description="Попробуйте другой запрос" />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredRestaurants.map((restaurant) => {
            const activeOffers = (restaurant.offers || []).filter((item) => item.is_active)

            return (
              <Link
                key={restaurant.id}
                href={`/r/${restaurant.slug}`}
                className="group block overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
              >
                <div className="aspect-[4/3] overflow-hidden bg-gray-100">
                  {restaurant.photo_1_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={restaurant.photo_1_url}
                      alt={restaurant.restaurant_name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-gray-300">
                      Нет фото
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <h2 className="text-base font-semibold leading-snug">{restaurant.restaurant_name}</h2>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {[restaurant.cuisine, restaurant.cuisine_2, restaurant.cuisine_3]
                      .filter(Boolean)
                      .slice(0, 3)
                      .map((c) => (
                        <Badge key={c as string}>{c as string}</Badge>
                      ))}
                  </div>

                  {activeOffers.length > 0 ? (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      {activeOffers.slice(0, 3).map((o, i) => (
                        <span
                          key={`${restaurant.id}-offer-${i}`}
                          className={`inline-flex max-w-full shrink-0 items-center rounded-full px-3 py-1 text-xs font-medium text-white ${
                            o.offer_type === '2for1' ? 'bg-[#DA5F3D]' : 'bg-black'
                          }`}
                        >
                          <span className="truncate">{formatOfferHeadline(o.offer_type, o.offer_title)}</span>
                        </span>
                      ))}
                      {activeOffers.length > 3 ? (
                        <span className="text-xs text-gray-400">и ещё {activeOffers.length - 3}</span>
                      ) : null}
                    </div>
                  ) : null}

                  <p className="mt-3 text-sm leading-relaxed text-gray-500 line-clamp-2">
                    {restaurant.short_description}
                  </p>

                  <p className="mt-2 truncate text-xs text-gray-400">{restaurant.address}</p>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
