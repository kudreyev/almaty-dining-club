import { describe, expect, it } from 'vitest'
import { computePromoAmounts, normalizePromoCode } from '@/lib/promo-codes'

describe('normalizePromoCode', () => {
  it('uppercases and strips junk', () => {
    expect(normalizePromoCode('  half50  ')).toBe('HALF50')
    expect(normalizePromoCode('save-500%')).toBe('SAVE-500')
  })
})

describe('computePromoAmounts', () => {
  it('applies percent discount to first month only', () => {
    expect(
      computePromoAmounts(1990, {
        discount_percent: 50,
        fixed_amount: null,
        applies_to: 'first_month',
      }),
    ).toEqual({ first_amount: 995, recurrent_amount: 1990 })
  })

  it('applies percent discount forever', () => {
    expect(
      computePromoAmounts(1990, {
        discount_percent: 50,
        fixed_amount: null,
        applies_to: 'forever',
      }),
    ).toEqual({ first_amount: 995, recurrent_amount: 995 })
  })

  it('applies fixed_amount as tenge off', () => {
    expect(
      computePromoAmounts(1990, {
        discount_percent: null,
        fixed_amount: 500,
        applies_to: 'first_month',
      }),
    ).toEqual({ first_amount: 1490, recurrent_amount: 1990 })
  })

  it('never returns zero or negative', () => {
    expect(
      computePromoAmounts(100, {
        discount_percent: null,
        fixed_amount: 999,
        applies_to: 'forever',
      }),
    ).toEqual({ first_amount: 1, recurrent_amount: 1 })
  })
})
