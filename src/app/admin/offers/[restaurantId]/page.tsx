import Link from 'next/link'
import { requireAdmin } from '@/lib/admin'
import { listingVisibilityLabel, offerTypeLabel } from '@/lib/labels'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type PageProps = { params: Promise<{ restaurantId: string }> }

export default async function AdminOffersForRestaurantPage({ params }: PageProps) {
  const { restaurantId } = await params
  const { supabase } = await requireAdmin()

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, restaurant_name')
    .eq('id', restaurantId)
    .single()

  const { data: offers } = await supabase
    .from('offers')
    .select('id, offer_key, offer_type, offer_title, is_active')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: true })

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <Link href="/admin/offers" className="text-sm text-gray-400 transition-colors hover:text-black">
            ← Все рестораны
          </Link>
          <h1 className="mt-1 text-3xl font-bold sm:text-4xl">{restaurant?.restaurant_name}</h1>
          <p className="text-base text-gray-500">Офферы</p>
        </div>
        <Button href={`/admin/offers/${restaurantId}/new`} size="sm">
          + Добавить
        </Button>
      </div>

      <div className="space-y-3">
        {offers?.map((o) => (
          <Card key={o.id} padding="sm" hover>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-semibold">{o.offer_title}</p>
                  <Badge color={o.offer_type === '2for1' ? 'dark' : 'blue'}>
                    {offerTypeLabel(o.offer_type)}
                  </Badge>
                  <Badge color={o.is_active ? 'green' : 'default'}>
                    {listingVisibilityLabel(!!o.is_active)}
                  </Badge>
                </div>
                {o.offer_key ? (
                  <p className="mt-0.5 font-mono text-sm text-gray-400">{o.offer_key}</p>
                ) : null}
              </div>
              <Button href={`/admin/offers/${restaurantId}/${o.id}/edit`} variant="secondary" size="sm">
                Изменить
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
