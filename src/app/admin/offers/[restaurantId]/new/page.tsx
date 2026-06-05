import { requireAdmin } from '@/lib/admin'
import { createOffer } from '../../actions'
import { FormSubmitGuard } from '@/components/form-submit-guard'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { DEFAULT_OFFER_COOLDOWN_DAYS } from '@/lib/offers'

type PageProps = { params: Promise<{ restaurantId: string }> }

export default async function AdminOfferNewPage({ params }: PageProps) {
  const { restaurantId } = await params
  const { supabase } = await requireAdmin()

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, restaurant_name')
    .eq('id', restaurantId)
    .single()

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Добавить оффер</h1>
          <p className="text-base text-gray-500">{restaurant?.restaurant_name}</p>
        </div>
        <Button href={`/admin/offers/${restaurantId}`} variant="ghost" size="sm">← Назад</Button>
      </div>

      <Card>
        <form action={createOffer} className="space-y-4">
          <input type="hidden" name="restaurant_id" value={restaurantId} />

          <Select name="offer_type" label="Тип оффера" defaultValue="2for1">
            <option value="2for1">2за1</option>
            <option value="compliment">в подарок</option>
            <option value="kudafest_set">Сеты Kudafest</option>
          </Select>

          <Input name="offer_title" label="Название предложения" placeholder="Например: Паста" required />
          <Textarea
            name="offer_terms_short"
            label="Краткие условия"
            rows={5}
            placeholder={'• Пункт 1\n• Пункт 2\n• Пункт 3'}
            hint="Можно несколько строк — каждая строка отобразится отдельно в карточке оффера."
            required
          />
          <Input
            name="end_date"
            type="date"
            label="Дата окончания"
            hint="Обязательно для Kudafest. Для обычных офферов — необязательно."
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              name="usable_from_time"
              type="time"
              label="Окно использования — с"
              hint="Только для Kudafest. Если не указано — доступен весь день."
            />
            <Input
              name="usable_to_time"
              type="time"
              label="Окно использования — до"
              hint="Например: 12:00–15:00 для ланч-сета."
            />
          </div>
          <Input
            name="dish_photo_url"
            label="Фото блюда (URL)"
            placeholder="https://..."
            hint="Опционально. Используется как превью в карточке оффера."
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input name="estimated_value" type="number" min={0} label="Примерная выгода (₸)" placeholder="3500" />
            <Input
              name="cooldown_days"
              type="number"
              min={1}
              max={365}
              label="Cooldown (дней)"
              placeholder="7"
              defaultValue={String(DEFAULT_OFFER_COOLDOWN_DAYS)}
            />
          </div>

          <label className="flex items-center gap-2 text-base text-gray-600">
            <input type="checkbox" name="is_active" defaultChecked className="rounded" />
            Активен
          </label>

          <FormSubmitGuard />

          <Button type="submit" className="w-full">
            Сохранить
          </Button>
        </form>
      </Card>
    </div>
  )
}
