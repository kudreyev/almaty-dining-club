import type { Metadata } from 'next'
import {
  ArrowLeftRight,
  CheckCircle,
  Clock,
  ShieldCheck,
} from 'lucide-react'
import { PricingFaq } from './pricing-faq'
import { WhatsappGoalLink } from '@/components/analytics/whatsapp-goal-link'

export const runtime = 'edge'

export const metadata: Metadata = {
  title: 'Kudaclub — подписка 1 990 ₸/мес',
  description:
    'Подписка Kudaclub: 2-за-1 на главные блюда и подарки к заказу. Без купонов, без распечаток, без скидочных карт.',
}

const FAQ_ITEMS = [
  {
    q: 'Как отменить подписку?',
    a: 'Никак — она отменяется сама. Через 30 дней доступ просто закончится. Чтобы продолжить, напишешь нам в WhatsApp. Мы НЕ списываем деньги автоматически.',
  },
  {
    q: 'Что если мне не подойдёт?',
    a: 'Если в первые 7 дней после активации вы решите, что Kudaclub вам не подходит — напишите нам в WhatsApp, и мы вернём полную стоимость подписки. Без объяснений и условий. Деньги вернём на ваш Kaspi.',
  },
  {
    q: 'Как работает 2 за 1?',
    a: 'Закажи два одинаковых блюда — второе будет бесплатно. Конкретные условия зависят от ресторана и указаны в описании оффера.',
  },
  {
    q: 'А если рестораны мне не подойдут?',
    a: 'Список заведений можно посмотреть прямо сейчас на странице «Заведения» — посмотри перед оплатой. Если что-то пошло не так после оплаты, напиши нам в WhatsApp — найдём решение.',
  },
  {
    q: 'Можно ли перенести подписку на другой номер?',
    a: 'Да, напиши нам в WhatsApp — перенесём подписку на другой номер.',
  },
  {
    q: 'Можно подарить подписку?',
    a: 'Да. Напиши нам — оформим как подарок с твоим персональным сообщением. Подходит для дней рождения и просто как приятный жест.',
  },
]

const GUARANTEES = [
  {
    Icon: ArrowLeftRight,
    title: 'Нет автосписаний',
    description:
      'Через 30 дней подписка просто закончится. Хочешь продолжить — пишешь нам.',
  },
  {
    Icon: Clock,
    title: 'Ручная поддержка',
    description:
      'В WhatsApp отвечает живой человек, не бот. Решим любой вопрос — от оплаты до переноса подписки.',
  },
  {
    Icon: ShieldCheck,
    title: 'Прозрачные условия',
    description:
      'Одна цена, никаких скрытых платежей или комиссий за активацию.',
  },
]

export default function PricingPage() {
  return (
    <>
      {/* SECTION 1 — HERO */}
      <section className="px-5 pt-10 pb-12 md:pt-16 md:pb-16">
        <div className="mx-auto max-w-[480px] text-center">
          <span className="mb-4 inline-block rounded-full bg-primary-light px-2.5 py-1 text-[11px] tracking-wider text-primary-dark">
            Подписка · 1 990 ₸/мес
          </span>

          <h1 className="mb-3 text-[28px] font-medium leading-[1.2] tracking-[-0.4px] text-neutral-900 md:text-[32px]">
            Один ужин — и подписка уже{' '}
            <span className="text-primary">в плюсе</span>
          </h1>

          <p className="mx-auto mb-7 text-sm leading-[1.55] text-neutral-600">
            2-за-1 на главные блюда и подарки к заказу. Без купонов, без
            распечаток, без скидочных карт.
          </p>

          {/* PRICE CARD */}
          <div className="rounded-xl border-[0.5px] border-neutral-200 bg-white px-6 py-7 text-left">
            {/* Price + Savings */}
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <div className="text-4xl font-medium leading-none text-neutral-900">
                  1 990 ₸
                </div>
                <div className="mt-1.5 text-[11px] text-neutral-500">
                  за 30 дней доступа
                </div>
              </div>
              <span className="shrink-0 rounded-md bg-success-light px-2 py-[3px] text-[11px] font-medium text-success-dark">
                Экономия от ~2 500 ₸/визит
              </span>
            </div>

            {/* Math block */}
            <p className="mt-5 mb-[18px] rounded-md bg-neutral-100 px-3 py-2.5 text-[13px] leading-[1.55] text-neutral-600">
              Подписка = 65 ₸ в день. Один поход в ресторан с 2-за-1 экономит
              ~2 500 ₸. Дальше — каждый последующий поход в плюс.
            </p>

            {/* Features */}
            <ul className="mb-[18px]">
              <li className="flex items-start gap-2.5 py-1.5 text-[13px] leading-[1.5] text-neutral-900">
                <CheckCircle
                  size={14}
                  className="mt-[3px] shrink-0 text-success"
                  aria-hidden="true"
                />
                2-за-1 на блюда и подарки к заказу
              </li>
              <li className="flex items-start gap-2.5 py-1.5 text-[13px] leading-[1.5] text-neutral-900">
                <CheckCircle
                  size={14}
                  className="mt-[3px] shrink-0 text-success"
                  aria-hidden="true"
                />
                Быстрая активация через WhatsApp
              </li>
              <li className="flex items-start gap-2.5 py-1.5 text-[13px] leading-[1.5] text-neutral-600">
                <CheckCircle
                  size={14}
                  className="mt-[3px] shrink-0 text-success"
                  aria-hidden="true"
                />
                Новые заведения добавляются каждый месяц
              </li>
            </ul>

            {/* CTA */}
            <WhatsappGoalLink
              source="pricing-page"
              messageKind="pricing-page"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full rounded-md bg-primary px-5 py-[13px] text-center text-[15px] font-medium text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
            >
              Попробовать за 1 990 ₸
            </WhatsappGoalLink>

            <p className="mt-2.5 text-center text-[11px] text-neutral-500">
              Ответим в WhatsApp за 5 минут · Активация в то же время
            </p>
          </div>

          {/* Money-back guarantee */}
          <div className="mt-4 flex items-start gap-3 rounded-xl bg-primary-light px-4 py-3.5 text-left">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white">
              <ShieldCheck
                size={16}
                className="text-primary-dark"
                aria-hidden="true"
              />
            </div>
            <div>
              <h3 className="text-[13px] font-medium text-neutral-900">
                Гарантия возврата
              </h3>
              <p className="mt-0.5 text-[12px] leading-[1.55] text-neutral-700">
                Если Kudaclub не подойдёт — напишите нам в первые 7 дней, и мы
                вернём полную стоимость подписки. Без вопросов и условий.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2 — GUARANTEES */}
      <section className="bg-neutral-50 px-6 py-7">
        <h2 className="mb-[18px] text-center text-[19px] font-medium text-neutral-900">
          Никаких сюрпризов в выписке банка
        </h2>
        <div className="mx-auto grid max-w-[720px] grid-cols-1 gap-3 md:grid-cols-3">
          {GUARANTEES.map(({ Icon, title, description }) => (
            <div key={title} className="rounded-md bg-white p-4">
              <div className="mb-2.5 flex h-7 w-7 items-center justify-center rounded-lg bg-primary-light">
                <Icon
                  size={14}
                  className="text-[#993C1D]"
                  aria-hidden="true"
                />
              </div>
              <h3 className="mb-1 text-[13px] font-medium text-neutral-900">
                {title}
              </h3>
              <p className="text-xs leading-[1.5] text-neutral-600">
                {description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 3 — FAQ */}
      <section className="px-5 py-8">
        <h2 className="mb-4 text-center text-[19px] font-medium text-neutral-900">
          Частые вопросы
        </h2>
        <div className="mx-auto max-w-[640px]">
          <PricingFaq items={FAQ_ITEMS} />
        </div>
      </section>
    </>
  )
}
