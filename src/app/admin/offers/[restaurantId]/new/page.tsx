import { requireAdmin } from '@/lib/admin'
import { createOffer } from '../../actions'
import { OfferKeyField } from '@/components/offer-key-field'
import { FormSubmitGuard } from '@/components/form-submit-guard'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'

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
          <h1 className="text-xl font-bold">Добавить оффер</h1>
          <p className="text-sm text-gray-500">{restaurant?.restaurant_name}</p>
        </div>
        <Button href={`/admin/offers/${restaurantId}`} variant="ghost" size="sm">← Назад</Button>
      </div>

      <Card>
        <form action={createOffer} className="space-y-4">
          <input type="hidden" name="restaurant_id" value={restaurantId} />

          <Select name="offer_type" label="Тип оффера" defaultValue="2for1">
            <option value="2for1">1+1 (два по цене одного)</option>
            <option value="compliment">Комплимент</option>
          </Select>

          <OfferKeyField />
          <Input name="offer_terms_short" label="Краткие условия" placeholder="1 строка" required />
          <Textarea name="offer_terms_full" label="Полные условия" rows={5} required />

          <Input name="offer_days" label="Дни" defaultValue="Mon,Tue,Wed,Thu,Fri,Sat,Sun" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input name="offer_time_from" label="Время с" defaultValue="12:00" />
            <Input name="offer_time_to" label="Время до" defaultValue="22:00" />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" name="requires_main_course" className="rounded" />
            Требует основное блюдо
          </label>

          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" name="is_stackable_with_other_promos" className="rounded" />
            Суммируется с акциями
          </label>

          <label className="flex items-center gap-2 text-sm text-gray-600">
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
