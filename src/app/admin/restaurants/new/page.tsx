import { requireAdmin } from '@/lib/admin'
import { PhoneInput } from '@/components/phone-input'
import { createRestaurant } from '../actions'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default async function AdminRestaurantNewPage() {
  await requireAdmin()

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">Добавить ресторан</h1>
        <Button href="/admin/restaurants" variant="ghost" size="sm">← Назад</Button>
      </div>

      <Card>
        <form action={createRestaurant} className="space-y-4">
          <Input name="restaurant_name" label="Название" placeholder="Название" required />
          <Input name="slug" label="Slug" placeholder="slug (латиницей)" required />
          <Input name="address" label="Адрес" placeholder="Адрес" required />
          <div className="grid gap-4 sm:grid-cols-3">
            <Input name="cuisine" label="Кухня" placeholder="Кухня" required />
            <Input name="cuisine_2" label="Кухня 2" placeholder="Опционально" />
            <Input name="cuisine_3" label="Кухня 3" placeholder="Опционально" />
          </div>
          <Input name="short_description" label="Описание" placeholder="До 120 символов" required />
          <Input name="instagram_url" label="Instagram" placeholder="https://instagram.com/..." />
          <Input name="two_gis_url" label="2GIS" placeholder="Ссылка 2GIS" />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Телефон</label>
            <PhoneInput name="phone" className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-colors focus:border-accent" />
          </div>
          <Input name="photo_1_url" label="Фото (URL)" placeholder="Ссылка на фото" />

          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" name="is_active" defaultChecked className="rounded" />
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
