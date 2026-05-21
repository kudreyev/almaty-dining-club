import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import type { ActivationLinkRow } from './activation-links'

vi.mock('@/lib/profile-sync', () => ({
  ensureProfilePhone: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/meta-capi', () => ({
  sendPurchaseEvent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: vi.fn(),
}))

import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { completeActivation } from './activation-links'
import { ensureProfilePhone } from '@/lib/profile-sync'

const USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const TOKEN = 'abcd0123ef456789abcd0123ef456789'

function futureIso(addDays = 2) {
  return new Date(Date.now() + addDays * 86400000).toISOString()
}

function pastIso(subDays = 2) {
  return new Date(Date.now() - subDays * 86400000).toISOString()
}

function issuedRow(overrides: Partial<ActivationLinkRow> = {}): ActivationLinkRow {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    token: TOKEN,
    phone_target: '+77001234567',
    status: 'issued',
    amount: 1990,
    currency: 'KZT',
    activated_user_id: null,
    activated_at: null,
    created_at: new Date().toISOString(),
    expires_at: futureIso(),
    ...overrides,
  }
}

type RpcReturn = { data: unknown; error: unknown }

function mockAuthUser(phone = '+77001234567') {
  return {
    data: {
      user: {
        id: USER_ID,
        phone,
        user_metadata: { phone_e164: phone },
      },
    },
    error: null,
  }
}

function createAdminStub(opts: {
  rowForToken: (token: string) => ActivationLinkRow | null
  rpc?: Mock<(name: string, params: Record<string, string>) => Promise<RpcReturn>>
}) {
  const rpcMock =
    opts.rpc ??
    vi.fn().mockResolvedValue({ data: { ok: true }, error: null } as RpcReturn)

  const adminStub = {
    from: vi.fn((table: string) => {
      if (table === 'activation_links') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((_col: string, token: string) => ({
              maybeSingle: vi.fn(async () => ({
                data: opts.rowForToken(token),
                error: null,
              })),
            })),
          })),
        }
      }
      if (table === 'profiles') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: { phone: '+77001234567' },
                error: null,
              })),
            })),
          })),
          insert: vi.fn().mockResolvedValue({ error: null }),
          update: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          })),
        }
      }
      throw new Error(`unexpected table: ${table}`)
    }),
    rpc: rpcMock,
    auth: {
      admin: {
        getUserById: vi.fn().mockResolvedValue(mockAuthUser()),
      },
    },
  }

  return { adminStub, rpcMock }
}

describe('completeActivation', () => {
  beforeEach(() => {
    vi.mocked(createSupabaseAdminClient).mockReset()
    vi.mocked(ensureProfilePhone).mockClear()
  })

  it('happy path: issued token → ok=true, RPC called, profile synced', async () => {
    const row = issuedRow()
    const { adminStub, rpcMock } = createAdminStub({
      rowForToken: (t) => (t === TOKEN ? row : null),
    })
    vi.mocked(createSupabaseAdminClient).mockReturnValue(adminStub as never)

    const result = await completeActivation({ userId: USER_ID, token: TOKEN })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.purchaseEventId).toMatch(/^purchase_/)
    }
    expect(rpcMock).toHaveBeenCalledWith('activate_subscription_atomic', {
      p_token: TOKEN,
      p_user_id: USER_ID,
    })
    expect(ensureProfilePhone).toHaveBeenCalledOnce()
  })

  it('parallel calls with same token: exactly one ok, second already_used', async () => {
    const row = issuedRow()
    let n = 0
    const rpcMock = vi.fn(async (): Promise<RpcReturn> => {
      const i = ++n
      return Promise.resolve(
        i === 1
          ? { data: { ok: true }, error: null }
          : { data: { ok: false, reason: 'already_used' }, error: null }
      )
    })

    const { adminStub } = createAdminStub({
      rowForToken: (t) => (t === TOKEN ? row : null),
      rpc: rpcMock,
    })
    vi.mocked(createSupabaseAdminClient).mockReturnValue(adminStub as never)

    const [a, b] = await Promise.all([
      completeActivation({ userId: USER_ID, token: TOKEN }),
      completeActivation({ userId: USER_ID, token: TOKEN }),
    ])

    const successes = [a, b].filter((r) => r.ok).length
    const blocked = [a, b].filter((r) => !r.ok && r.reason === 'already_used').length

    expect(successes).toBe(1)
    expect(blocked).toBe(1)
    expect(rpcMock).toHaveBeenCalledTimes(2)
  })

  it('unknown token → invalid (no RPC)', async () => {
    const { adminStub, rpcMock } = createAdminStub({
      rowForToken: () => null,
    })
    vi.mocked(createSupabaseAdminClient).mockReturnValue(adminStub as never)

    const result = await completeActivation({ userId: USER_ID, token: 'nonexistent' })

    expect(result).toEqual({ ok: false, reason: 'invalid' })
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('link already activated → already_used (precheck, no RPC)', async () => {
    const row = issuedRow({ status: 'activated', activated_user_id: USER_ID })
    const { adminStub, rpcMock } = createAdminStub({
      rowForToken: (t) => (t === TOKEN ? row : null),
    })
    vi.mocked(createSupabaseAdminClient).mockReturnValue(adminStub as never)

    const result = await completeActivation({ userId: USER_ID, token: TOKEN })

    expect(result).toEqual({ ok: false, reason: 'already_used' })
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('subscription_error then retry succeeds (RPC rollback / link still issuable)', async () => {
    const row = issuedRow()
    let rpcCalls = 0
    const rpcMock = vi.fn(async (): Promise<RpcReturn> => {
      rpcCalls++
      if (rpcCalls === 1) {
        return { data: { ok: false, reason: 'subscription_error' }, error: null }
      }
      return { data: { ok: true }, error: null }
    })

    const { adminStub } = createAdminStub({
      rowForToken: (t) => (t === TOKEN ? row : null),
      rpc: rpcMock,
    })
    vi.mocked(createSupabaseAdminClient).mockReturnValue(adminStub as never)

    const fail = await completeActivation({ userId: USER_ID, token: TOKEN })
    expect(fail).toEqual({ ok: false, reason: 'subscription_error' })
    expect(ensureProfilePhone).not.toHaveBeenCalled()

    const ok = await completeActivation({ userId: USER_ID, token: TOKEN })
    expect(ok.ok).toBe(true)
    expect(ensureProfilePhone).toHaveBeenCalledOnce()
    expect(rpcMock).toHaveBeenCalledTimes(2)
  })

  it('expired link (expires_at in the past) → expired, no RPC', async () => {
    const row = issuedRow({ expires_at: pastIso() })
    const { adminStub, rpcMock } = createAdminStub({
      rowForToken: (t) => (t === TOKEN ? row : null),
    })
    vi.mocked(createSupabaseAdminClient).mockReturnValue(adminStub as never)

    const result = await completeActivation({ userId: USER_ID, token: TOKEN })

    expect(result).toEqual({ ok: false, reason: 'expired' })
    expect(rpcMock).not.toHaveBeenCalled()
  })
})
