import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: vi.fn(),
}))

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  approvePaymentRequest,
  rejectPaymentRequest,
} from '@/app/admin/payments/actions'

const ADMIN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const PAYMENT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const USER_FROM_DB = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const WRONG_USER_FROM_FORM = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'

function mockServerClient() {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: ADMIN_ID } },
        error: null,
      }),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { role: 'admin' },
            error: null,
          }),
        })),
      })),
    })),
  }
}

function buildAdminMock(opts: {
  paymentRow: {
    id: string
    user_id: string
    amount: number
    status: 'pending' | 'approved' | 'rejected'
  }
  existingSubscriptionId?: string | null
}) {
  const subscriptionInsert = vi.fn().mockResolvedValue({ error: null })
  const subscriptionUpdate = vi.fn(() => ({
    eq: vi.fn().mockResolvedValue({ error: null }),
  }))
  const auditInsert = vi.fn().mockResolvedValue({ error: null })

  const adminFrom = vi.fn((table: string) => {
    if (table === 'payment_requests') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: opts.paymentRow,
              error: null,
            }),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                maybeSingle: vi.fn().mockImplementation(async () => {
                  if (opts.paymentRow.status !== 'pending') {
                    return { data: null, error: null }
                  }
                  return {
                    data: { id: opts.paymentRow.id },
                    error: null,
                  }
                }),
              })),
            })),
          })),
        })),
      }
    }
    if (table === 'subscriptions') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: opts.existingSubscriptionId
                    ? { id: opts.existingSubscriptionId }
                    : null,
                  error: null,
                }),
              })),
            })),
          })),
        })),
        insert: subscriptionInsert,
        update: subscriptionUpdate,
      }
    }
    if (table === 'payment_admin_audit') {
      return {
        insert: auditInsert,
      }
    }
    throw new Error(`unexpected table ${table}`)
  })

  return { adminFrom, subscriptionInsert, subscriptionUpdate, auditInsert }
}

describe('approvePaymentRequest', () => {
  beforeEach(() => {
    vi.mocked(createSupabaseServerClient).mockReset()
    vi.mocked(createSupabaseAdminClient).mockReset()
  })

  it('подтверждает заявку и создаёт подписку для user_id из БД', async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      mockServerClient() as never
    )

    const { adminFrom, subscriptionInsert, auditInsert } = buildAdminMock({
      paymentRow: {
        id: PAYMENT_ID,
        user_id: USER_FROM_DB,
        amount: 1990,
        status: 'pending',
      },
      existingSubscriptionId: null,
    })
    vi.mocked(createSupabaseAdminClient).mockReturnValue({ from: adminFrom } as never)

    const fd = new FormData()
    fd.set('paymentRequestId', PAYMENT_ID)

    await approvePaymentRequest(fd)

    expect(subscriptionInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: USER_FROM_DB,
        payment_request_id: PAYMENT_ID,
      })
    )
    expect(auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'approve',
        payment_request_id: PAYMENT_ID,
        actor_user_id: ADMIN_ID,
        details: { amount: 1990 },
      })
    )
  })

  it('игнорирует подменённый userId и amount в FormData', async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      mockServerClient() as never
    )

    const { adminFrom, subscriptionInsert, auditInsert } = buildAdminMock({
      paymentRow: {
        id: PAYMENT_ID,
        user_id: USER_FROM_DB,
        amount: 2500,
        status: 'pending',
      },
      existingSubscriptionId: null,
    })
    vi.mocked(createSupabaseAdminClient).mockReturnValue({ from: adminFrom } as never)

    const fd = new FormData()
    fd.set('paymentRequestId', PAYMENT_ID)
    fd.set('userId', WRONG_USER_FROM_FORM)
    fd.set('amount', '1')

    await approvePaymentRequest(fd)

    expect(subscriptionInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: USER_FROM_DB,
      })
    )
    const insertPayload = subscriptionInsert.mock.calls[0]?.[0] as { user_id: string }
    expect(insertPayload.user_id).not.toBe(WRONG_USER_FROM_FORM)

    expect(auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        details: { amount: 2500 },
      })
    )
  })

  it('при существующей подписке делает update, user_id из БД', async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      mockServerClient() as never
    )

    const subId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
    const { adminFrom, subscriptionInsert, subscriptionUpdate } = buildAdminMock({
      paymentRow: {
        id: PAYMENT_ID,
        user_id: USER_FROM_DB,
        amount: 1990,
        status: 'pending',
      },
      existingSubscriptionId: subId,
    })
    vi.mocked(createSupabaseAdminClient).mockReturnValue({ from: adminFrom } as never)

    const fd = new FormData()
    fd.set('paymentRequestId', PAYMENT_ID)

    await approvePaymentRequest(fd)

    expect(subscriptionInsert).not.toHaveBeenCalled()
    expect(subscriptionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_request_id: PAYMENT_ID,
      })
    )
  })

  it('отказывает при повторном approve уже одобренной заявки', async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      mockServerClient() as never
    )

    const { adminFrom } = buildAdminMock({
      paymentRow: {
        id: PAYMENT_ID,
        user_id: USER_FROM_DB,
        amount: 1990,
        status: 'approved',
      },
    })
    vi.mocked(createSupabaseAdminClient).mockReturnValue({ from: adminFrom } as never)

    const fd = new FormData()
    fd.set('paymentRequestId', PAYMENT_ID)

    await expect(approvePaymentRequest(fd)).rejects.toThrow('Заявка уже обработана.')
  })
})

describe('rejectPaymentRequest', () => {
  beforeEach(() => {
    vi.mocked(createSupabaseServerClient).mockReset()
    vi.mocked(createSupabaseAdminClient).mockReset()
  })

  it('отклоняет только pending заявку', async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      mockServerClient() as never
    )

    const auditInsert = vi.fn().mockResolvedValue({ error: null })
    const adminFrom = vi.fn((table: string) => {
      if (table === 'payment_requests') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: PAYMENT_ID,
                  user_id: USER_FROM_DB,
                  amount: 1990,
                  status: 'approved',
                },
                error: null,
              }),
            })),
          })),
        }
      }
      if (table === 'payment_admin_audit') {
        return { insert: auditInsert }
      }
      throw new Error(`unexpected ${table}`)
    })

    vi.mocked(createSupabaseAdminClient).mockReturnValue({ from: adminFrom } as never)

    const fd = new FormData()
    fd.set('paymentRequestId', PAYMENT_ID)

    await expect(rejectPaymentRequest(fd)).rejects.toThrow('Заявка уже обработана.')
    expect(auditInsert).not.toHaveBeenCalled()
  })
})
