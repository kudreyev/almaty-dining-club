import { requireAdmin } from '@/lib/admin'
import { createEvent } from '../actions'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { RestaurantCityField } from '@/components/admin/restaurant-city-field'

export default async function AdminEventNewPage() {
  await requireAdmin()

  return (
    <div className="mx-auto max-w-lg px-5 py-8">
      <div className="mb-4">
        <Button href="/admin/events" variant="ghost" size="sm">
          ← Назад
        </Button>
      </div>
      <Card padding="lg" className="space-y-4">
        <h1 className="text-xl font-bold">Новый фестиваль</h1>
        <p className="text-sm text-gray-500">
          Создайте фестиваль отдельно. Заведения и сеты добавите на следующем шаге.
        </p>
        <form action={createEvent} className="space-y-4">
          <Input name="name" label="Название" required placeholder="BreakFest" />
          <Input name="slug" label="Slug" placeholder="breakfest-2026" hint="URL: /{city}/{slug}" />
          <RestaurantCityField />
          <Input name="starts_at" type="date" label="Начало" required />
          <Input name="ends_at" type="date" label="Конец (включительно)" required />
          <Input
            name="set_price_kzt"
            type="number"
            label="Цена сета по умолчанию, ₸"
            defaultValue={3500}
            required
          />
          <Input name="accent_color" label="Accent color" defaultValue="#0F766E" />
          <Input
            name="max_sets_per_venue_per_day"
            type="number"
            label="Лимит сетов на гостя в заведении / день"
            defaultValue={1}
          />
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" name="is_published" className="rounded" />
            Опубликован
          </label>
          <Button type="submit" className="w-full">
            Создать фестиваль
          </Button>
        </form>
      </Card>
    </div>
  )
}
