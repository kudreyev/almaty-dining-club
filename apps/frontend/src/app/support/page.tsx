import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

const SUPPORT_WHATSAPP_URL = 'https://wa.me/77066059899'

export const dynamic = 'force-static'

export default function SupportPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <Card padding="lg">
        <h1 className="text-xl font-bold">Поддержка</h1>

        <div className="mt-6 space-y-4 text-sm leading-relaxed text-gray-600">
          <p>Если что-то не работает или есть вопросы — напишите нам в WhatsApp.</p>

          <Button
            href={SUPPORT_WHATSAPP_URL}
            size="lg"
            className="w-full sm:w-auto"
            target="_blank"
            rel="noopener noreferrer"
          >
            Написать в WhatsApp
          </Button>

          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Контакты</p>
            <p className="mt-2 text-sm text-gray-700">
              WhatsApp:{' '}
              <a href={SUPPORT_WHATSAPP_URL} className="text-black underline underline-offset-2 hover:no-underline" target="_blank" rel="noopener noreferrer">
                +7 706 605 9899
              </a>
            </p>
            <p className="text-sm text-gray-700">Telegram: @kudafest_support</p>
          </div>
        </div>
      </Card>
    </div>
  )
}
