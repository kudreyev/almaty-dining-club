import { normalizePhoneToE164 } from '@/lib/auth/whatsapp-login'
import type { UserKind } from '@/lib/user-kind'

/** Классификация номера ссылки для отображения в админке (не влияет на активацию). */
export type ActivationLinkDisplayKind = 'customer' | 'staff' | 'test' | 'unknown'

type ProfilePhoneRow = {
  phone: string | null
  user_kind: string | null
}

export function buildUserKindByPhoneE164(
  profiles: ProfilePhoneRow[],
): Map<string, UserKind> {
  const map = new Map<string, UserKind>()
  for (const row of profiles) {
    if (!row.phone) continue
    const e164 = normalizePhoneToE164(row.phone)
    if (!e164) continue
    const kind = (row.user_kind ?? 'customer') as UserKind
    map.set(e164, kind)
  }
  return map
}

export function resolveActivationLinkDisplayKind(
  phoneTarget: string,
  kindByPhone: Map<string, UserKind>,
): ActivationLinkDisplayKind {
  const e164 = normalizePhoneToE164(phoneTarget)
  if (!e164) return 'unknown'

  const kind = kindByPhone.get(e164)
  if (!kind) return 'unknown'
  if (kind === 'staff' || kind === 'test') return kind
  return 'customer'
}

export function shouldShowActivationLinkInList(
  displayKind: ActivationLinkDisplayKind,
  showInternal: boolean,
): boolean {
  if (showInternal) return true
  return displayKind === 'customer' || displayKind === 'unknown'
}

export function activationLinkUserKindBadgeLabel(
  displayKind: ActivationLinkDisplayKind,
): string {
  switch (displayKind) {
    case 'staff':
      return 'STAFF'
    case 'test':
      return 'TEST'
    case 'customer':
      return 'CUSTOMER'
    default:
      return 'CUSTOMER'
  }
}

export function activationLinkUserKindBadgeColor(
  displayKind: ActivationLinkDisplayKind,
): 'green' | 'dark' | 'yellow' | 'default' {
  switch (displayKind) {
    case 'staff':
      return 'dark'
    case 'test':
      return 'yellow'
    default:
      return 'green'
  }
}
