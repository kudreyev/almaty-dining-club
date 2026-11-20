import { describe, expect, it } from 'vitest'
import { formatOfferTitle, formatSetOfferTitle } from '@/lib/offers'

describe('formatSetOfferTitle', () => {
  it('shows event name without number by default', () => {
    expect(formatSetOfferTitle('KudaFest')).toBe('KudaFest сет')
    expect(formatSetOfferTitle(null)).toBe('KudaFest сет')
  })

  it('adds № only when showNumber is true', () => {
    expect(
      formatSetOfferTitle('KudaFest', {
        showNumber: true,
        offerTitle: 'Сет №1',
      }),
    ).toBe('KudaFest сет №1')
    expect(
      formatSetOfferTitle('BreakFest', {
        showNumber: true,
        index: 1,
      }),
    ).toBe('BreakFest сет №2')
  })

  it('never appends «в подарок» for sets via formatOfferTitle', () => {
    expect(formatOfferTitle('set', 'Сет №1', 'KudaFest')).toBe('KudaFest сет')
    expect(
      formatOfferTitle('set', 'Сет №1', 'KudaFest', { showSetNumber: true }),
    ).toBe('KudaFest сет №1')
    expect(formatOfferTitle('compliment', 'Кофе', null)).toBe('Кофе в подарок')
  })
})
