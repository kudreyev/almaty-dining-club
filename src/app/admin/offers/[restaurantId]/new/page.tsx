import Link from 'next/link'
import { requireAdmin } from '@/lib/admin'
import { createOffer } from '../../actions'
import { OfferKeyField } from '@/components/offer-key-field'
import { FormSubmitGuard } from '@/components/form-submit-guard'

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
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold">Добавить оффер</h1>
          <Link href={`/admin/offers/${restaurantId}`} className="text-sm text-gray-600 underline">
            Назад
          </Link>
        </div>

        <p className="mt-3 text-sm text-gray-600">
          {restaurant?.restaurant_name}
        </p>

        <form action={createOffer} className="mt-8 space-y-4">
          <input type="hidden" name="restaurant_id" value={restaurantId} />

          <select name="offer_type" defaultValue="2for1" className="w-full rounded-2xl border px-4 py-3 text-sm">
            <option value="2for1">2for1 (1+1)</option>
            <option value="compliment">compliment (Комплимент)</option>
          </select>

          <OfferKeyField />
          <input name="offer_terms_short" placeholder="Краткие условия (1 строка)" required className="w-full rounded-2xl border px-4 py-3 text-sm" />
          <textarea name="offer_terms_full" placeholder="Полные условия" rows={5} required className="w-full rounded-2xl border px-4 py-3 text-sm" />

          <input name="offer_days" defaultValue="Mon,Tue,Wed,Thu,Fri,Sat,Sun" className="w-full rounded-2xl border px-4 py-3 text-sm" />
          <div className="grid gap-4 sm:grid-cols-2">
            <input name="offer_time_from" defaultValue="12:00" className="w-full rounded-2xl border px-4 py-3 text-sm" />
            <input name="offer_time_to" defaultValue="22:00" className="w-full rounded-2xl border px-4 py-3 text-sm" />
          </div>

          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" name="requires_main_course" />
            Требует основное блюдо (обычно для комплимента)
          </label>

          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" name="is_stackable_with_other_promos" />
            Суммируется с другими акциями (обычно выключено)
          </label>

          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" name="is_active" defaultChecked />
            Активен
          </label>

          <FormSubmitGuard />

          <button className="w-full rounded-2xl bg-black px-4 py-3 text-sm font-medium text-white">
            Сохранить оффер
          </button>
        </form>
      </div>
    </main>
  )
}