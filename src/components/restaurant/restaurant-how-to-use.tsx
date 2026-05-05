import { CheckCircle2 } from 'lucide-react'

const RULES = [
  'Закажи блюдо, нажми «Получить» в момент заказа',
  'Покажи код официанту — оффер активируется на чек',
  'Код действует 15 минут — получай прямо за столом',
]

export function RestaurantHowToUse() {
  return (
    <section style={{ padding: '24px 20px' }}>
      <h2
        className="font-medium text-neutral-900"
        style={{ fontSize: '18px', marginBottom: '16px' }}
      >
        Как использовать
      </h2>

      <ul
        className="flex list-none flex-col bg-neutral-50"
        style={{
          borderRadius: '6px',
          padding: '14px 16px',
          gap: '6px',
        }}
      >
        {RULES.map((rule) => (
          <li
            key={rule}
            className="flex items-start text-neutral-600"
            style={{ fontSize: '12px', lineHeight: 1.5, gap: '8px' }}
          >
            <CheckCircle2
              size={11}
              style={{ color: '#0F6E56', marginTop: '4px', flexShrink: 0 }}
              aria-hidden="true"
            />
            <span>{rule}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
