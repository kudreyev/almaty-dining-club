export const dynamic = 'force-static'
export default function SupportPage() {
    return (
      <main className="mx-auto max-w-4xl px-6 py-16">
        <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-semibold">Поддержка</h1>
  
          <div className="mt-6 space-y-4 text-sm leading-6 text-gray-700">
            <p>Если что-то не работает или есть вопросы по подписке — напишите нам.</p>
  
            <div className="rounded-2xl bg-gray-50 p-5">
              <p className="font-medium text-gray-900">Контакты</p>
              <p className="mt-2">WhatsApp: +7 706 605 9899</p>
              <p>Telegram: @kudafest_support/p>
            </div>
          </div>
        </div>
      </main>
    )
  }