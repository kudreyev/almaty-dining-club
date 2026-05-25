'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { generateCopilotDraft } from '@/lib/whatsapp-copilot'
import { sendWhatsAppText, isWhatsAppOutboundEnabled } from '@/lib/whatsapp-cloud'
import { logServerError } from '@/lib/safe-errors'

export async function sendWhatsAppReply(formData: FormData): Promise<void> {
  await requireAdmin()

  const conversationId = String(formData.get('conversationId') ?? '').trim()
  const text = String(formData.get('text') ?? '').trim()

  if (!conversationId) throw new Error('Не указан диалог')
  if (!text) throw new Error('Пустой текст ответа')
  if (text.length > 4000) throw new Error('Слишком длинный текст')

  const admin = createSupabaseAdminClient()
  const { data: conv, error } = await admin
    .from('whatsapp_conversations')
    .select('id, wa_id')
    .eq('id', conversationId)
    .maybeSingle()

  if (error || !conv) throw new Error('Диалог не найден')

  if (!isWhatsAppOutboundEnabled()) {
    throw new Error(
      'Отправка через API отключена. Скопируйте черновик и ответьте с телефона, либо задайте WHATSAPP_OUTBOUND_ENABLED=true.',
    )
  }

  const sent = await sendWhatsAppText({ toWaId: conv.wa_id, text })
  if (!sent.ok) throw new Error('Не удалось отправить в WhatsApp')

  const wamid = sent.messageId ?? `outbound-${Date.now()}`
  await admin.from('whatsapp_messages').insert({
    conversation_id: conv.id,
    wamid,
    direction: 'outbound',
    body: text,
  })

  await admin
    .from('whatsapp_conversations')
    .update({
      status: 'resolved',
      copilot_draft: text,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conv.id)

  revalidatePath('/admin/whatsapp')
}

export async function dismissWhatsAppConversation(formData: FormData): Promise<void> {
  await requireAdmin()

  const conversationId = String(formData.get('conversationId') ?? '').trim()
  if (!conversationId) throw new Error('Не указан диалог')

  const admin = createSupabaseAdminClient()
  const { error } = await admin
    .from('whatsapp_conversations')
    .update({
      status: 'resolved',
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId)

  if (error) {
    logServerError('admin/whatsapp:dismiss', error)
    throw new Error('Ошибка сохранения')
  }

  revalidatePath('/admin/whatsapp')
}

export async function regenerateWhatsAppDraft(formData: FormData): Promise<void> {
  await requireAdmin()

  const conversationId = String(formData.get('conversationId') ?? '').trim()
  if (!conversationId) throw new Error('Не указан диалог')

  const admin = createSupabaseAdminClient()
  const { data: conv, error } = await admin
    .from('whatsapp_conversations')
    .select('id, phone_e164, last_inbound_text')
    .eq('id', conversationId)
    .maybeSingle()

  if (error || !conv || !conv.last_inbound_text) {
    throw new Error('Диалог не найден')
  }

  try {
    const draft = await generateCopilotDraft({
      inboundText: conv.last_inbound_text,
      phoneE164: conv.phone_e164,
    })

    await admin
      .from('whatsapp_conversations')
      .update({
        intent: draft.intent,
        copilot_draft: draft.draft_text,
        copilot_context: draft.context,
        status: 'pending_approval',
        updated_at: new Date().toISOString(),
      })
      .eq('id', conv.id)
  } catch (err) {
    logServerError('admin/whatsapp:regenerate', err)
    throw new Error('Не удалось сгенерировать черновик')
  }

  revalidatePath('/admin/whatsapp')
}
