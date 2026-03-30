import { Card } from '@/components/ui/card'

export const dynamic = 'force-static'

export default function SupportPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <Card padding="lg">
        <h1 className="text-xl font-bold">Поддержка</h1>

        <div className="mt-6 space-y-4 text-sm leading-relaxed text-gray-600">
          <p>Если что-то не работает или есть вопросы — напишите нам.</p>

          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Контакты</p>
            <p className="mt-2 text-sm text-gray-700">WhatsApp: +7 706 605 9899</p>
            <p className="text-sm text-gray-700">Telegram: @kudafest_support</p>
          </div>
        </div>
      </Card>
    </div>
  )
}
