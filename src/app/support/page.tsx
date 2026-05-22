import { Card } from '@/components/ui/card'
import { WhatsappSupportLink } from '@/components/analytics/whatsapp-support-link'

const SUPPORT_WHATSAPP_URL = 'https://wa.me/77066059899'

const SUPPORT_BUTTON_CLASSES =
  'inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-6 py-3.5 text-base font-medium text-white transition-all duration-150 hover:bg-accent-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:ring-offset-2 active:scale-[0.98] sm:w-auto'

export const dynamic = 'force-static'

export default function SupportPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <Card padding="lg">
        <h1 className="text-xl font-bold">Поддержка</h1>

        <div className="mt-6 space-y-4 text-sm leading-relaxed text-gray-600">
          <p>Если что-то не работает или есть вопросы — напишите нам в WhatsApp.</p>

          <WhatsappSupportLink
            source="support-page"
            href={SUPPORT_WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={SUPPORT_BUTTON_CLASSES}
          >
            Написать в WhatsApp
          </WhatsappSupportLink>

          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Контакты</p>
            <p className="mt-2 text-sm text-gray-700">
              WhatsApp:{' '}
              <WhatsappSupportLink
                source="support-phone"
                href={SUPPORT_WHATSAPP_URL}
                className="text-black underline underline-offset-2 hover:no-underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                +7 706 605 9899
              </WhatsappSupportLink>
            </p>
            <p className="text-sm text-gray-700">Telegram: @kudafest_support</p>
          </div>
        </div>
      </Card>
    </div>
  )
}
