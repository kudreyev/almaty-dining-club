import Link from 'next/link'
import { requireAdmin } from '@/lib/admin'
import { listingVisibilityLabel } from '@/lib/labels'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export default async function AdminRestaurantsPage() {
  const { supabase } = await requireAdmin()

  const { data: restaurants } = await supabase
    .from('restaurants')
    .select('id, restaurant_name, slug, district, is_active')
    .order('restaurant_name', { ascending: true })

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Заведения</h1>
          <p className="mt-1 text-sm text-gray-500">Управление ресторанами</p>
        </div>
        <Button href="/admin/restaurants/new" size="sm">
          + Добавить
        </Button>
      </div>

      <div className="space-y-3">
        {restaurants?.map((r) => (
          <Card key={r.id} padding="sm" hover>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold">{r.restaurant_name}</p>
                  <Badge color={r.is_active ? 'green' : 'default'}>
                    {listingVisibilityLabel(!!r.is_active)}
                  </Badge>
                </div>
                <p className="mt-0.5 truncate text-xs text-gray-400">{r.district} · /{r.slug}</p>
              </div>
              <Button href={`/admin/restaurants/${r.id}/edit`} variant="secondary" size="sm">
                Изменить
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
