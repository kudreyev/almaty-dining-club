import { describe, expect, it } from 'vitest'
import {
  buildInternalUsersIndex,
  phoneLookupKeys,
  resolveActivationLinkDisplayKind,
  shouldShowActivationLinkInList,
} from '@/lib/activation-links-list'

describe('activation-links-list', () => {
  it('matches phone_target to profile phone across formats', () => {
    const keys = phoneLookupKeys('+77073955418')
    expect(keys).toContain('+77073955418')

    const index = buildInternalUsersIndex([
      {
        id: 'user-1',
        phone: '+77073955418',
        user_kind: 'staff',
      },
    ])

    const kind = resolveActivationLinkDisplayKind(
      { phone_target: '+77073955418', activated_user_id: null },
      index,
      [{ id: 'user-1', phone: '+77073955418', user_kind: 'staff' }],
    )
    expect(kind).toBe('staff')
    expect(
      shouldShowActivationLinkInList(
        { phone_target: '+77073955418', activated_user_id: null },
        index,
        [{ id: 'user-1', phone: '+77073955418', user_kind: 'staff' }],
        false,
      ),
    ).toBe(false)
  })

  it('hides by activated_user_id when phone is missing on profile', () => {
    const index = buildInternalUsersIndex([
      { id: 'user-2', phone: null, user_kind: 'staff' },
    ])
    const profiles = [{ id: 'user-2', phone: null, user_kind: 'staff' }]

    expect(
      shouldShowActivationLinkInList(
        { phone_target: '+77782903407', activated_user_id: 'user-2' },
        index,
        profiles,
        false,
      ),
    ).toBe(false)
  })
})
