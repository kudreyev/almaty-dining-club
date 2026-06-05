import { describe, it, expect } from 'vitest'
import {
  formatOfferUsableDayLabel,
  formatOfferUsableHoursStatus,
  formatOfferUsableScheduleSummary,
  hasOfferUsableSchedule,
  isOfferUsableNow,
  type OfferUsableHour,
} from './offers'

function schedule(partial: Partial<OfferUsableHour> & Pick<OfferUsableHour, 'day_of_week'>): OfferUsableHour {
  return {
    is_unavailable: false,
    from_time: '12:00',
    to_time: '15:00',
    ...partial,
  }
}

describe('offer usable hours by day', () => {
  const weekdayHours: OfferUsableHour[] = [
    schedule({ day_of_week: 1 }),
    schedule({ day_of_week: 2 }),
    schedule({ day_of_week: 3 }),
    schedule({ day_of_week: 4 }),
    schedule({ day_of_week: 5 }),
    { day_of_week: 6, is_unavailable: true, from_time: null, to_time: null },
    { day_of_week: 7, is_unavailable: true, from_time: null, to_time: null },
  ]

  const weekendHours: OfferUsableHour[] = [
    { day_of_week: 1, is_unavailable: true, from_time: null, to_time: null },
    { day_of_week: 2, is_unavailable: true, from_time: null, to_time: null },
    { day_of_week: 3, is_unavailable: true, from_time: null, to_time: null },
    { day_of_week: 4, is_unavailable: true, from_time: null, to_time: null },
    { day_of_week: 5, is_unavailable: true, from_time: null, to_time: null },
    schedule({ day_of_week: 6, from_time: '18:00', to_time: '21:00' }),
    schedule({ day_of_week: 7, from_time: '18:00', to_time: '21:00' }),
  ]

  it('detects configured schedule', () => {
    expect(hasOfferUsableSchedule(weekdayHours)).toBe(true)
    expect(hasOfferUsableSchedule([])).toBe(false)
  })

  it('formats day label', () => {
    expect(formatOfferUsableDayLabel('12:00', '15:00')).toBe('Сегодня с 12:00 до 15:00')
  })

  it('allows usage inside weekday window', () => {
    const fridayInside = new Date('2026-06-05T07:30:00.000Z') // пт 12:30
    expect(isOfferUsableNow(weekdayHours, fridayInside, 'Asia/Almaty')).toBe(true)
  })

  it('blocks usage on weekend for weekday-only schedule', () => {
    const saturday = new Date('2026-06-06T08:00:00.000Z') // сб 13:00
    expect(isOfferUsableNow(weekdayHours, saturday, 'Asia/Almaty')).toBe(false)
  })

  it('allows usage on weekend for weekend schedule', () => {
    const saturdayEvening = new Date('2026-06-06T14:30:00.000Z') // сб 19:30
    expect(isOfferUsableNow(weekendHours, saturdayEvening, 'Asia/Almaty')).toBe(true)
  })

  it('returns today label and next-day hint', () => {
    const fridayInside = new Date('2026-06-05T07:30:00.000Z')
    expect(formatOfferUsableHoursStatus(weekdayHours, fridayInside, 'Asia/Almaty')).toEqual({
      isUsable: true,
      label: 'Сегодня с 12:00 до 15:00',
    })

    const saturday = new Date('2026-06-06T08:00:00.000Z')
    expect(formatOfferUsableHoursStatus(weekdayHours, saturday, 'Asia/Almaty')).toEqual({
      isUsable: false,
      label: 'Доступно в пн с 12:00 до 15:00',
    })
  })

  it('formats admin summary', () => {
    expect(formatOfferUsableScheduleSummary(weekdayHours)).toBe(
      'пн 12:00–15:00, вт 12:00–15:00, ср 12:00–15:00, чт 12:00–15:00, пт 12:00–15:00',
    )
  })
})
