import { describe, expect, it } from 'vitest'
import {
  hasAnyUtm,
  parseUtmFromJsonData,
  parseUtmFromSearchParams,
} from '@/lib/utm'
import { parseAmount } from '@/lib/ttp-webhook-utils'

describe('utm attribution', () => {
  it('parses search params', () => {
    const a = parseUtmFromSearchParams(
      new URLSearchParams(
        'utm_source=fb&utm_medium=paid&utm_campaign=spring&promo_code=KUD10',
      ),
    )
    expect(a).toEqual({
      utm_source: 'fb',
      utm_medium: 'paid',
      utm_campaign: 'spring',
      promo_code: 'KUD10',
    })
    expect(hasAnyUtm(a)).toBe(true)
  })

  it('parses JsonData flat and nested', () => {
    expect(
      parseUtmFromJsonData(
        JSON.stringify({
          source: 'home-hero',
          utm_source: 'ig',
          utm_medium: 'paid',
        }),
      ),
    ).toMatchObject({ utm_source: 'ig', utm_medium: 'paid' })

    expect(
      parseUtmFromJsonData({
        metadata: { utm_source: 'google', promo_code: 'X' },
      }),
    ).toMatchObject({ utm_source: 'google', promo_code: 'X' })
  })
})

describe('ttp webhook utils', () => {
  it('parses amount with comma', () => {
    expect(parseAmount('1990')).toBe(1990)
    expect(parseAmount('1 990')).toBe(1990)
    expect(parseAmount('1990,50')).toBe(1990.5)
  })
})
