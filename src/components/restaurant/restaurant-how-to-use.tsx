import { Check } from 'lucide-react'

const RULES = [
  'Закажи блюдо, нажми «Получить» в момент заказа',
  'Покажи код официанту — оффер активируется на чек',
  'Код действует 15 минут — получай прямо за столом',
]

export function RestaurantHowToUse() {
  return (
    <section
      style={{
        padding: '24px 20px',
        borderTopWidth: '0.5px',
        borderTopStyle: 'solid',
        borderTopColor: '#f0f0f0',
      }}
    >
      <h2
        className="font-medium text-neutral-900"
        style={{ fontSize: '18px', marginBottom: '16px' }}
      >
        Как использовать
      </h2>

      <ul
        className="flex list-none flex-col"
        style={{
          background: '#f5f5f5',
          borderRadius: '8px',
          padding: '16px 18px',
          gap: '10px',
        }}
      >
        {RULES.map((rule) => (
          <li
            key={rule}
            className="flex items-start text-neutral-600"
            style={{ fontSize: '12px', lineHeight: 1.5, gap: '10px' }}
          >
            <Check
              size={14}
              strokeWidth={2}
              style={{ color: '#a3a3a3', marginTop: '2px', flexShrink: 0 }}
              aria-hidden="true"
            />
            <span>{rule}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
