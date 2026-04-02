import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin'
import { PhoneInput } from '@/components/phone-input'
import { updateRestaurant } from '../../actions'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type PageProps = { params: Promise<{ id: string }> }

export default async function AdminRestaurantEditPage({ params }: PageProps) {
  const { id } = await params
  const { supabase } = await requireAdmin()

  const { data: r } = await supabase
    .from('restaurants')
    .select('*')
    .eq('id', id)
    .single()

  if (!r) notFound()

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold sm:text-4xl">Редактировать</h1>
        <div className="flex gap-2">
          <Button href={`/admin/restaurants/${r.id}/locations`} variant="secondary" size="sm">
            Адреса
          </Button>
          <Button href="/admin/restaurants" variant="ghost" size="sm">← Назад</Button>
        </div>
      </div>

      <Card>
        <form action={updateRestaurant} className="space-y-4">
          <input type="hidden" name="id" value={r.id} />
          <Input name="restaurant_name" label="Название" defaultValue={r.restaurant_name} required />
          <Input name="slug" label="Slug" defaultValue={r.slug} required />
          <Input name="address" label="Адрес" defaultValue={r.address} required />
          <div className="grid gap-4 sm:grid-cols-3">
            <Input name="cuisine" label="Кухня" defaultValue={r.cuisine} required />
            <Input name="cuisine_2" label="Кухня 2" defaultValue={r.cuisine_2 ?? ''} placeholder="Опционально" />
            <Input name="cuisine_3" label="Кухня 3" defaultValue={r.cuisine_3 ?? ''} placeholder="Опционально" />
          </div>
          <Input name="short_description" label="Описание" defaultValue={r.short_description} required />
          <Input name="instagram_url" label="Instagram" defaultValue={r.instagram_url ?? ''} />
          <Input name="two_gis_url" label="2GIS" defaultValue={r.two_gis_url ?? ''} placeholder="Ссылка 2GIS" />
          <div>
            <label className="mb-1.5 block text-base font-medium text-gray-700">Телефон</label>
            <PhoneInput name="phone" defaultValue={r.phone ?? ''} className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base outline-none transition-colors focus:border-accent" />
          </div>
          <Input name="photo_1_url" label="Фото (URL)" defaultValue={r.photo_1_url ?? ''} />

          <label className="flex items-center gap-2 text-base text-gray-600">
            <input type="checkbox" name="is_active" defaultChecked={!!r.is_active} className="rounded" />
            Активен
          </label>

          <Button type="submit" className="w-full">
            Сохранить
          </Button>
        </form>
      </Card>
    </div>
  )
}
