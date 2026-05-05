import { requireAdmin } from '@/lib/admin'
import { PhoneInput } from '@/components/phone-input'
import { createRestaurant } from '../actions'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RestaurantHoursFields } from '@/components/admin/restaurant-hours-fields'

export default async function AdminRestaurantNewPage() {
  await requireAdmin()

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Добавить ресторан</h1>
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
          <Input name="tags" label="Теги (через запятую)" placeholder="Ужины, Свидания, Винная карта" />
          <Input name="instagram_url" label="Instagram" placeholder="https://instagram.com/..." />

          <fieldset className="rounded-xl border border-gray-200 p-4">
            <legend className="px-2 text-sm font-medium text-gray-700">Информация из 2GIS</legend>
            <div className="space-y-4">
              <Input name="two_gis_url" label="Ссылка 2GIS" placeholder="https://2gis.kz/almaty/firm/..." />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  name="external_rating"
                  type="number"
                  step={0.1}
                  min={1}
                  max={5}
                  label="Рейтинг 2GIS"
                  placeholder="4.7"
                />
                <Input
                  name="external_reviews_count"
                  type="number"
                  step={1}
                  min={0}
                  label="Количество отзывов 2GIS"
                  placeholder="312"
                />
              </div>
              <p className="text-sm text-gray-500">
                Все три поля опциональные. Рейтинг будет показан на странице заведения только если все три поля заполнены.
              </p>
            </div>
          </fieldset>

          <div>
            <label className="mb-1.5 block text-base font-medium text-gray-700">Телефон</label>
            <PhoneInput name="phone" className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base outline-none transition-colors focus:border-accent" />
          </div>
          <Input name="whatsapp_phone" label="WhatsApp" placeholder="+77001234567" />
          <RestaurantHoursFields />

          <label className="flex items-center gap-2 text-base text-gray-600">
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
