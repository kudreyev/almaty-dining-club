import { normalizePhoneToE164 } from '@/lib/auth/whatsapp-login'
import { normalizeToE164Like } from '@/lib/kz-phone'
import type { UserKind } from '@/lib/user-kind'

/** Классификация для админ-списка (не влияет на активацию). */
export type ActivationLinkDisplayKind = 'customer' | 'staff' | 'test'

type ProfileRow = {
  id: string
  phone: string | null
  user_kind: string | null
}

export type InternalUsersIndex = {
  userKindById: Map<string, UserKind>
  phoneKeys: Set<string>
}

export type ActivationLinkForDisplay = {
  phone_target: string
  activated_user_id?: string | null
}

/** Все варианты ключа для сопоставления phone_target ↔ profiles.phone. */
export function phoneLookupKeys(raw: string): string[] {
  const keys = new Set<string>()
  const e164Like = normalizeToE164Like(raw)
  const e164Auth = normalizePhoneToE164(raw)
  if (e164Like) keys.add(e164Like)
  if (e164Auth) keys.add(e164Auth)

  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('8')) {
    keys.add(`+7${digits.slice(1)}`)
    keys.add(digits)
  }
  if (digits.length === 11 && digits.startsWith('7')) {
    keys.add(`+${digits}`)
    keys.add(digits)
  }
  if (digits.length === 10) {
    keys.add(`+7${digits}`)
  }

  return [...keys]
}

export function buildInternalUsersIndex(profiles: ProfileRow[]): InternalUsersIndex {
  const userKindById = new Map<string, UserKind>()
  const phoneKeys = new Set<string>()

  for (const row of profiles) {
    if (row.user_kind !== 'staff' && row.user_kind !== 'test') continue
    userKindById.set(row.id, row.user_kind)
    if (!row.phone) continue
    for (const key of phoneLookupKeys(row.phone)) {
      phoneKeys.add(key)
    }
  }

  return { userKindById, phoneKeys }
}

export function enrichInternalIndexWithPhones(
  index: InternalUsersIndex,
  entries: Array<{ userId: string; phone: string | null | undefined }>,
): void {
  for (const { userId, phone } of entries) {
    if (!index.userKindById.has(userId) || !phone) continue
    for (const key of phoneLookupKeys(phone)) {
      index.phoneKeys.add(key)
    }
  }
}

export function resolveActivationLinkDisplayKind(
  link: ActivationLinkForDisplay,
  index: InternalUsersIndex,
  internalProfiles: ProfileRow[],
): ActivationLinkDisplayKind {
  if (link.activated_user_id) {
    const byUser = index.userKindById.get(link.activated_user_id)
    if (byUser === 'staff' || byUser === 'test') return byUser
  }

  for (const key of phoneLookupKeys(link.phone_target)) {
    if (!index.phoneKeys.has(key)) continue
    for (const row of internalProfiles) {
      if (row.user_kind !== 'staff' && row.user_kind !== 'test') continue
      if (!row.phone) continue
      if (phoneLookupKeys(row.phone).includes(key)) {
        return row.user_kind as 'staff' | 'test'
      }
    }
  }

  return 'customer'
}

export function shouldShowActivationLinkInList(
  link: ActivationLinkForDisplay,
  index: InternalUsersIndex,
  internalProfiles: ProfileRow[],
  showInternal: boolean,
): boolean {
  if (showInternal) return true
  const kind = resolveActivationLinkDisplayKind(link, index, internalProfiles)
  return kind === 'customer'
}

export function activationLinkUserKindBadgeLabel(kind: ActivationLinkDisplayKind): string {
  switch (kind) {
    case 'staff':
      return 'STAFF'
    case 'test':
      return 'TEST'
    default:
      return 'CUSTOMER'
  }
}

export function activationLinkUserKindBadgeColor(
  kind: ActivationLinkDisplayKind,
): 'green' | 'dark' | 'yellow' | 'default' {
  switch (kind) {
    case 'staff':
      return 'dark'
    case 'test':
      return 'yellow'
    default:
      return 'green'
  }
}
