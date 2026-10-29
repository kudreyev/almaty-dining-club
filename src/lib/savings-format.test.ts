import { describe, expect, it } from 'vitest'
import { formatSavingsDetails, formatSavingsKzt, formatThousands } from './savings-format'

const NBSP = '\u00A0'

describe('formatSavingsKzt', () => {
  it('groups thousands with a non-breaking space', () => {
    expect(formatSavingsKzt(359370)).toBe(`359${NBSP}370${NBSP}₸`)
    expect(formatSavingsKzt(0)).toBe(`0${NBSP}₸`)
    expect(formatThousands(1234567)).toBe(`1${NBSP}234${NBSP}567`)
  })

  it('switches to millions from 1 000 000 without rounding up', () => {
    expect(formatSavingsKzt(1_000_000)).toBe(`1${NBSP}млн${NBSP}₸`)
    expect(formatSavingsKzt(1_249_999)).toBe(`1,2${NBSP}млн${NBSP}₸`)
    expect(formatSavingsKzt(12_990_000)).toBe(`12,9${NBSP}млн${NBSP}₸`)
    expect(formatSavingsKzt(450_000, 1_200_000)).toBe(`0,4${NBSP}млн${NBSP}₸`)
  })
})

describe('formatSavingsDetails', () => {
  it('pluralizes guests and meals', () => {
    expect(formatSavingsDetails(57, 93)).toBe(`57 гостей и 93 ужина и кофе по${NBSP}1+1`)
    expect(formatSavingsDetails(51, 101)).toBe(`51 гость и 101 ужин и кофе по${NBSP}1+1`)
    expect(formatSavingsDetails(1002, 1105)).toBe(`1${NBSP}002 гостя и 1${NBSP}105 ужинов и кофе по${NBSP}1+1`)
  })
})
