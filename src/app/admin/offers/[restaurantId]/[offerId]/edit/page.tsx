import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin'
import { updateOffer } from '../../../actions'
import { OfferKeyField } from '@/components/offer-key-field'
import { FormSubmitGuard } from '@/components/form-submit-guard'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { DEFAULT_OFFER_COOLDOWN_DAYS } from '@/lib/offers'

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
          <h1 className="text-3xl font-bold sm:text-4xl">Редактировать оффер</h1>
          <p className="text-base text-gray-500">{restaurant?.restaurant_name}</p>
          {offer.offer_key ? (
            <p className="font-mono text-sm text-gray-400">{offer.offer_key}</p>
          ) : null}
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
          </Select>

          <OfferKeyField
            defaultKey={offer.offer_key ?? ''}
            defaultTitle={offer.offer_title ?? ''}
          />
          <Input name="offer_terms_short" label="Краткие условия" defaultValue={offer.offer_terms_short} required />

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
