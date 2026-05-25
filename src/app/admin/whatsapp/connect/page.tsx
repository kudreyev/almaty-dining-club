import Link from 'next/link'
import { requireAdmin } from '@/lib/admin'
import { Button } from '@/components/ui/button'
import {
  getEmbeddedSignupConfigId,
  getMetaAppId,
  isEmbeddedSignupConfigured,
} from '@/lib/whatsapp-embedded-signup'
import { EmbeddedSignupLauncher } from './embedded-signup-launcher'

export const dynamic = 'force-dynamic'

export default async function AdminWhatsAppConnectPage() {
  await requireAdmin('/admin/whatsapp/connect')

  const appId = getMetaAppId()
  const configId = getEmbeddedSignupConfigId()
  const ready = isEmbeddedSignupConfigured()

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Подключение WhatsApp (coexistence)
          </h1>
          <p className="mt-1 text-base leading-6 text-gray-500">
            Embedded Signup для номера 77066059899 через Meta Cloud API.
          </p>
        </div>
        <Button href="/admin/whatsapp" variant="secondary" size="sm">
          ← К диалогам
        </Button>
      </div>

      {!ready ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">Env не настроен на Vercel</p>
          <p className="mt-1 text-xs">
            После добавления переменных нажмите Redeploy — без redeploy страница останется пустой.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <code className="text-xs">NEXT_PUBLIC_META_APP_ID</code> — App ID из Meta Developers
            </li>
            <li>
              <code className="text-xs">WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID</code> — Configuration ID
            </li>
            <li>
              <code className="text-xs">WHATSAPP_APP_SECRET</code> — уже нужен для webhook
            </li>
          </ul>
          <p className="mt-2">
            Также проверьте OAuth: <code className="text-xs">kudaclub.kz</code> в Allowed domains Meta.
          </p>
        </div>
      ) : (
        <EmbeddedSignupLauncher appId={appId!} configId={configId!} />
      )}

      <p className="mt-6 text-sm text-gray-500">
        После успешного подключения обновите env на Vercel и напишите на{' '}
        <Link href="https://wa.me/77066059899" className="text-accent underline">
          77066059899
        </Link>{' '}
        — сообщение должно появиться в{' '}
        <Link href="/admin/whatsapp" className="text-accent underline">
          /admin/whatsapp
        </Link>
        .
      </p>
    </div>
  )
}
