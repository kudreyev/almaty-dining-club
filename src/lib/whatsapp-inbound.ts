import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import type { InboundWhatsAppMessage } from '@/lib/whatsapp-cloud'
import { generateCopilotDraft } from '@/lib/whatsapp-copilot'
import { resolveUserFromWaId } from '@/lib/user-by-phone'
import { logServerError } from '@/lib/safe-errors'

export async function processInboundWhatsAppMessage(
  msg: InboundWhatsAppMessage,
): Promise<{ ok: true; conversationId: string } | { ok: false; reason: string }> {
  const admin = createSupabaseAdminClient()

  const { data: existingMsg } = await admin
    .from('whatsapp_messages')
    .select('id')
    .eq('wamid', msg.wamid)
    .maybeSingle()

  if (existingMsg) {
    return { ok: false, reason: 'duplicate' }
  }

  const { phoneE164, user } = await resolveUserFromWaId(msg.waId)
  if (!phoneE164) {
    return { ok: false, reason: 'invalid_phone' }
  }

  const now = new Date().toISOString()

  const { data: conversation, error: convError } = await admin
    .from('whatsapp_conversations')
    .upsert(
      {
        wa_id: msg.waId,
        phone_e164: phoneE164,
        profile_id: user?.profileId ?? null,
        status: 'pending_approval',
        last_inbound_text: msg.text,
        last_message_at: now,
        updated_at: now,
      },
      { onConflict: 'wa_id' },
    )
    .select('id')
    .single()

  if (convError || !conversation) {
    logServerError('whatsapp:upsertConversation', convError)
    return { ok: false, reason: 'db_error' }
  }

  const { error: msgError } = await admin.from('whatsapp_messages').insert({
    conversation_id: conversation.id,
    wamid: msg.wamid,
    direction: 'inbound',
    body: msg.text,
    raw_payload: msg.raw as Record<string, unknown>,
  })

  if (msgError) {
    logServerError('whatsapp:insertMessage', msgError)
    return { ok: false, reason: 'db_error' }
  }

  try {
    const draft = await generateCopilotDraft({
      inboundText: msg.text,
      phoneE164,
    })

    await admin
      .from('whatsapp_conversations')
      .update({
        intent: draft.intent,
        copilot_draft: draft.draft_text,
        copilot_context: draft.context,
        profile_id: user?.profileId ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversation.id)
  } catch (error) {
    logServerError('whatsapp:generateDraft', error)
  }

  return { ok: true, conversationId: conversation.id }
}
