import { Card } from '@/components/ui/card'

export const dynamic = 'force-static'

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <Card padding="lg">
        <h1 className="text-xl font-bold">Политика конфиденциальности</h1>

        <div className="mt-6 space-y-4 text-sm leading-relaxed text-gray-600">
          <p>
            Мы собираем минимальные данные для работы сервиса: номер WhatsApp (если используется для входа), а также
            технические данные о действиях в сервисе (например, история использования офферов).
          </p>
          <p>
            Мы не продаём персональные данные третьим лицам. Доступ к данным ограничен и используется только
            для работы сервиса и поддержки пользователей.
          </p>
          <p>
            Если вы хотите удалить аккаунт или данные — напишите в поддержку (страница «Поддержка»).
          </p>
        </div>
      </Card>
    </div>
  )
}
