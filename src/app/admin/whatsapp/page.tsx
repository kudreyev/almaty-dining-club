import { requireAdmin } from '@/lib/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { formatContextSummary, type CopilotContext } from '@/lib/whatsapp-copilot'
import { isWhatsAppCloudConfigured } from '@/lib/whatsapp-cloud'
import { isKZNumber, normalizeToE164Like } from '@/lib/kz-phone'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import {
  dismissWhatsAppConversation,
  regenerateWhatsAppDraft,
  sendWhatsAppReply,
} from './actions'
import { logServerError } from '@/lib/safe-errors'

type ConversationRow = {
  id: string
  wa_id: string
  phone_e164: string
  status: 'pending_approval' | 'resolved'
  intent: string | null
  last_inbound_text: string | null
  last_message_at: string
  copilot_draft: string | null
  copilot_context: CopilotContext | null
}

function maskPhone(e164: string): string {
  const norm = normalizeToE164Like(e164)
  if (norm && isKZNumber(norm)) {
    const digits = norm.slice(1)
    return `+7 ${digits.slice(1, 4)} *** ** ${digits.slice(9, 11)}`
  }
  return e164.slice(0, 6) + '***'
}

function intentLabel(intent: string | null): string {
  switch (intent) {
    case 'subscribe':
      return 'подписка'
    case 'renew':
      return 'продление'
    case 'support':
      return 'саппорт'
    default:
      return 'неизвестно'
  }
}

function intentColor(intent: string | null): 'green' | 'accent' | 'yellow' | 'default' {
  switch (intent) {
    case 'subscribe':
      return 'green'
    case 'renew':
      return 'accent'
    case 'support':
      return 'yellow'
    default:
      return 'default'
  }
}

function statusColor(status: string): 'yellow' | 'default' {
  return status === 'pending_approval' ? 'yellow' : 'default'
}

export default async function AdminWhatsAppPage() {
  await requireAdmin()
  const supabase = await createSupabaseServerClient()

  const { data: conversations, error } = await supabase
    .from('whatsapp_conversations')
    .select(
      'id, wa_id, phone_e164, status, intent, last_inbound_text, last_message_at, copilot_draft, copilot_context',
    )
    .order('last_message_at', { ascending: false })
    .limit(50)
    .returns<ConversationRow[]>()

  if (error) {
    logServerError('admin/whatsapp', error)
    return (
      <div className="mx-auto max-w-4xl px-5 py-8">
        <h1 className="text-2xl font-semibold">WhatsApp-копилот</h1>
        <p className="mt-4 text-red-600">Не удалось загрузить диалоги.</p>
      </div>
    )
  }

  const pending = (conversations ?? []).filter((c) => c.status === 'pending_approval')
  const resolved = (conversations ?? []).filter((c) => c.status === 'resolved')
  const cloudOk = isWhatsAppCloudConfigured()

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">WhatsApp-копилот</h1>
        <p className="mt-1 text-base leading-6 text-gray-500">
          Входящие сообщения → черновик ответа → подтверждение оператором (Слой 5).
        </p>
        {!cloudOk ? (
          <p className="mt-2 text-sm text-amber-700">
            WhatsApp Cloud API не настроен — отправка ответов недоступна. Задайте WHATSAPP_CLOUD_ACCESS_TOKEN
            и WHATSAPP_PHONE_NUMBER_ID.
          </p>
        ) : null}
      </div>

      {pending.length === 0 ? (
        <EmptyState
          title="Нет ожидающих ответов"
          description="Новые входящие появятся после webhook от Meta"
        />
      ) : (
        <div className="mb-10 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">
            Ожидают ответа ({pending.length})
          </h2>
          {pending.map((item) => (
            <ConversationCard key={item.id} item={item} cloudOk={cloudOk} />
          ))}
        </div>
      )}

      {resolved.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Закрытые</h2>
          {resolved.slice(0, 10).map((item) => (
            <ConversationCard key={item.id} item={item} cloudOk={cloudOk} readonly />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function ConversationCard({
  item,
  cloudOk,
  readonly = false,
}: {
  item: ConversationRow
  cloudOk: boolean
  readonly?: boolean
}) {
  const ctx = item.copilot_context
  const summary = ctx ? formatContextSummary(ctx) : '—'

  return (
    <Card>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold tabular-nums">{maskPhone(item.phone_e164)}</span>
          <Badge color={statusColor(item.status)}>
            {item.status === 'pending_approval' ? 'ожидает' : 'закрыт'}
          </Badge>
          <Badge color={intentColor(item.intent)}>{intentLabel(item.intent)}</Badge>
          <span className="text-sm text-gray-400">
            {new Date(item.last_message_at).toLocaleString('ru-RU')}
          </span>
        </div>

        <p className="text-sm text-gray-500">{summary}</p>

        {item.last_inbound_text ? (
          <div className="rounded-lg bg-gray-50 p-3 text-base leading-6 text-gray-800">
            <p className="mb-1 text-xs font-medium text-gray-400">Клиент</p>
            {item.last_inbound_text}
          </div>
        ) : null}

        {!readonly ? (
          <>
            <form action={sendWhatsAppReply} className="space-y-3">
              <input type="hidden" name="conversationId" value={item.id} />
              <label className="block text-xs font-medium text-gray-500">Черновик ответа</label>
              <textarea
                name="text"
                defaultValue={item.copilot_draft ?? ''}
                rows={6}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-base leading-6 focus:border-gray-400 focus:outline-none"
              />
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={!cloudOk}>
                  Отправить в WhatsApp
                </Button>
                <Button type="submit" formAction={regenerateWhatsAppDraft} variant="secondary">
                  Перегенерировать
                </Button>
                <Button type="submit" formAction={dismissWhatsAppConversation} variant="ghost">
                  Закрыть без ответа
                </Button>
              </div>
            </form>
          </>
        ) : item.copilot_draft ? (
          <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900 whitespace-pre-wrap">
            {item.copilot_draft}
          </div>
        ) : null}
      </div>
    </Card>
  )
}
