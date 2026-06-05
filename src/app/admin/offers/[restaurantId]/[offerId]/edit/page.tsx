import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin'
import { updateOffer } from '../../../actions'
import { FormSubmitGuard } from '@/components/form-submit-guard'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { OfferUsableHoursFields } from '@/components/admin/offer-usable-hours-fields'
import { DEFAULT_OFFER_COOLDOWN_DAYS, type OfferUsableHour } from '@/lib/offers'

type PageProps = { params: Promise<{ restaurantId: string; offerId: string }> }

export default async function AdminOfferEditPage({ params }: PageProps) {
  const { restaurantId, offerId } = await params
  const { supabase } = await requireAdmin()

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, restaurant_name')
    .eq('id', restaurantId)
    .single()

  const [{ data: offer }, { data: usableHours }] = await Promise.all([
    supabase
      .from('offers')
      .select('*')
      .eq('id', offerId)
      .eq('restaurant_id', restaurantId)
      .single(),
    supabase
      .from('offer_usable_hours')
      .select('day_of_week, is_unavailable, from_time, to_time')
      .eq('offer_id', offerId)
      .order('day_of_week', { ascending: true })
      .returns<OfferUsableHour[]>(),
  ])

  if (!offer) notFound()

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Редактировать оффер</h1>
          <p className="text-base text-gray-500">{restaurant?.restaurant_name}</p>
        </div>
        <Button href={`/admin/offers/${restaurantId}`} variant="ghost" size="sm">← Назад</Button>
      </div>

      <Card>
        <form action={updateOffer} className="space-y-4">
          <input type="hidden" name="id" value={offer.id} />
          <input type="hidden" name="restaurant_id" value={restaurantId} />

          <Select name="offer_type" label="Тип оффера" defaultValue={offer.offer_type}>
            <option value="2for1">2за1</option>
            <option value="compliment">в подарок</option>
            <option value="kudafest_set">Сеты Kudafest</option>
          </Select>

          <Input name="offer_title" label="Название предложения" defaultValue={offer.offer_title ?? ''} required />
          <Textarea
            name="offer_terms_short"
            label="Краткие условия"
            rows={5}
            defaultValue={offer.offer_terms_short}
            hint="Можно несколько строк — каждая строка отобразится отдельно в карточке оффера."
            required
          />
          <Input
            name="end_date"
            type="date"
            label="Дата окончания"
            defaultValue={offer.end_date ?? ''}
            hint="Обязательно для Kudafest. Для обычных офферов — необязательно."
          />

          <OfferUsableHoursFields initialHours={usableHours ?? []} />
          <Input
            name="dish_photo_url"
            label="Фото блюда (URL)"
            placeholder="https://..."
            defaultValue={offer.dish_photo_url ?? ''}
            hint="Опционально. Используется как превью в карточке оффера."
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              name="estimated_value"
              type="number"
              min={0}
              label="Примерная выгода (₸)"
              placeholder="3500"
              defaultValue={offer.estimated_value == null ? '' : String(offer.estimated_value)}
            />
            <Input
              name="cooldown_days"
              type="number"
              min={1}
              max={365}
              label="Cooldown (дней)"
              placeholder="7"
              defaultValue={String(offer.cooldown_days ?? DEFAULT_OFFER_COOLDOWN_DAYS)}
            />
          </div>

          <label className="flex items-center gap-2 text-base text-gray-600">
            <input type="checkbox" name="is_active" defaultChecked={!!offer.is_active} className="rounded" />
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
