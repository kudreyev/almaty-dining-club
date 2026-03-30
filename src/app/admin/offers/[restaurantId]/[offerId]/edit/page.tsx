import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin'
import { updateOffer } from '../../../actions'
import { OfferKeyField } from '@/components/offer-key-field'
import { FormSubmitGuard } from '@/components/form-submit-guard'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'

type PageProps = { params: Promise<{ restaurantId: string; offerId: string }> }

export default async function AdminOfferEditPage({ params }: PageProps) {
  const { restaurantId, offerId } = await params
  const { supabase } = await requireAdmin()

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, restaurant_name')
    .eq('id', restaurantId)
    .single()

  const { data: offer } = await supabase
    .from('offers')
    .select('*')
    .eq('id', offerId)
    .eq('restaurant_id', restaurantId)
    .single()

  if (!offer) notFound()

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Редактировать оффер</h1>
          <p className="text-sm text-gray-500">{restaurant?.restaurant_name}</p>
          {offer.offer_key ? (
            <p className="font-mono text-xs text-gray-400">{offer.offer_key}</p>
          ) : null}
        </div>
        <Button href={`/admin/offers/${restaurantId}`} variant="ghost" size="sm">← Назад</Button>
      </div>

      <Card>
        <form action={updateOffer} className="space-y-4">
          <input type="hidden" name="id" value={offer.id} />
          <input type="hidden" name="restaurant_id" value={restaurantId} />

          <Select name="offer_type" label="Тип оффера" defaultValue={offer.offer_type}>
            <option value="2for1">1+1 (два по цене одного)</option>
            <option value="compliment">Комплимент</option>
          </Select>

          <OfferKeyField
            defaultKey={offer.offer_key ?? ''}
            defaultTitle={offer.offer_title ?? ''}
          />
          <Input name="offer_terms_short" label="Краткие условия" defaultValue={offer.offer_terms_short} required />
          <Textarea name="offer_terms_full" label="Полные условия" defaultValue={offer.offer_terms_full} rows={5} required />

          <Input name="offer_days" label="Дни" defaultValue={offer.offer_days} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input name="offer_time_from" label="Время с" defaultValue={String(offer.offer_time_from).slice(0, 5)} />
            <Input name="offer_time_to" label="Время до" defaultValue={String(offer.offer_time_to).slice(0, 5)} />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" name="requires_main_course" defaultChecked={!!offer.requires_main_course} className="rounded" />
            Требует основное блюдо
          </label>

          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" name="is_stackable_with_other_promos" defaultChecked={!!offer.is_stackable_with_other_promos} className="rounded" />
            Суммируется с акциями
          </label>

          <label className="flex items-center gap-2 text-sm text-gray-600">
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
