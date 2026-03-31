import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FaqAccordion } from '@/components/faq-accordion'
import { RESTAURANT_REDEEM_COOLDOWN_DAYS } from '@/lib/redeem-policy'

export const runtime = 'edge'

const WHATSAPP_SUBSCRIBE_URL =
  'https://wa.me/77066059899?text=%D0%97%D0%B4%D1%80%D0%B0%D0%B2%D1%81%D1%82%D0%B2%D1%83%D0%B9%D1%82%D0%B5%21%20%D0%A5%D0%BE%D1%87%D1%83%20%D0%BF%D0%BE%D0%B4%D0%BF%D0%B8%D1%81%D0%BA%D1%83%20KudaPass%20%D0%BD%D0%B0%20%D0%BE%D0%B4%D0%B8%D0%BD%20%D0%BC%D0%B5%D1%81%D1%8F%D1%86'

const FAQ_ITEMS = [
  {
    q: 'Сколько раз можно использовать подписку?',
    a: `Вы можете пользоваться офферами в течение действия подписки, но по каждому ресторану действует ограничение: не чаще 1 раза в ${RESTAURANT_REDEEM_COOLDOWN_DAYS} дней. Каждый раз — новый одноразовый код.`,
  },
  {
    q: 'Как именно работает 1+1?',
    a: 'Закажите два одинаковых блюда — второе будет бесплатно. Конкретные условия зависят от ресторана и указаны в описании оффера.',
  },
  {
    q: 'А если я не воспользуюсь подпиской?',
    a: 'Подписка действует 30 дней с момента активации. Мы не возвращаем оплату за неиспользованный период, но всегда можно написать нам — найдём решение.',
  },
  {
    q: 'Нужно ли бронировать стол заранее?',
    a: 'Бронирование не обязательно, но рекомендуется для популярных заведений. Вы можете прийти без брони и активировать оффер на месте.',
  },
  {
    q: 'Можно ли перенести подписку на другой номер?',
    a: 'Да, напишите нам в WhatsApp — мы перенесём подписку на другой номер.',
  },
]

export default function PricingPage() {
  return (
    <>
      <div className="mx-auto max-w-3xl px-5 py-10 pb-28 sm:pb-16 md:py-16 md:pb-16">
        {/* HERO */}
        <section className="text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-gray-400">
            Подписка
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
            Все рестораны — одна подписка
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-gray-500">
            Получите доступ ко всем офферам 1+1 и комплиментам в ресторанах Алматы. Без ограничений, без купонов.
          </p>
        </section>

        {/* PRICE CARD */}
        <Card className="mt-10" padding="none">
          <div className="p-6 md:p-8">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold tracking-tight">4 990 ₸</span>
              <span className="text-sm text-gray-400">/ 30 дней</span>
            </div>

            <ul className="mt-6 space-y-3">
              {[
                'Все рестораны и кафе Алматы',
                'Офферы 1+1 и комплименты',
                'Неограниченное использование',
                'Одноразовый код на каждый визит',
                'Подписка через WhatsApp за 2 минуты',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-gray-700">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>

            <Button
              href={WHATSAPP_SUBSCRIBE_URL}
              size="lg"
              className="mt-8 w-full"
              target="_blank"
              rel="noreferrer"
            >
              Оформить в WhatsApp
            </Button>

            <p className="mt-3 text-center text-xs text-gray-400">
              Ответим за 5 минут, выставим счёт и активируем подписку.
            </p>
          </div>
        </Card>

        {/* HOW IT WORKS */}
        <section className="mt-14">
          <h2 className="text-center text-xl font-bold">Как это работает</h2>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              { step: '1', title: 'Оформи подписку', desc: 'Напиши нам в WhatsApp — активируем за 5 минут.' },
              { step: '2', title: 'Выбери ресторан', desc: 'Открой оффер и нажми «Активировать» — получишь код.' },
              { step: '3', title: 'Покажи код', desc: 'Персонал проверит код — предложение применят к заказу.' },
            ].map((s) => (
              <Card key={s.step} padding="md">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white">
                  {s.step}
                </div>
                <p className="mt-3 text-sm font-semibold">{s.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-gray-500">{s.desc}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-14">
          <h2 className="text-center text-xl font-bold">Частые вопросы</h2>
          <div className="mt-8">
            <FaqAccordion items={FAQ_ITEMS} />
          </div>
        </section>
      </div>

      {/* STICKY CTA — mobile only */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur-sm sm:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold leading-tight">4 990 ₸</p>
            <p className="text-xs text-gray-500">/ 30 дней</p>
          </div>
          <a
            href={WHATSAPP_SUBSCRIBE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center justify-center rounded-xl bg-[#DD4F41] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#C94337] active:scale-[0.98]"
          >
            Оформить в WhatsApp
          </a>
        </div>
      </div>
    </>
  )
}
