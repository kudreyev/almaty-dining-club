export const dynamic = 'force-static'
export default function PrivacyPage() {
    return (
      <main className="mx-auto max-w-4xl px-6 py-16">
        <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-semibold">Политика конфиденциальности</h1>
  
          <div className="mt-6 space-y-4 text-sm leading-6 text-gray-700">
            <p>
              Мы собираем минимальные данные для работы сервиса: email (для входа), а также
              технические данные о действиях в сервисе (например, заявки на оплату и история использования офферов).
            </p>
            <p>
              Мы не продаём персональные данные третьим лицам. Доступ к данным ограничен и используется только
              для работы сервиса и поддержки пользователей.
            </p>
            <p>
              Если вы хотите удалить аккаунт или данные — напишите в поддержку (страница Support).
            </p>
          </div>
        </div>
      </main>
    )
  }