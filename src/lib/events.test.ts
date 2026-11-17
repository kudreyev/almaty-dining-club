import { describe, expect, it } from 'vitest'
import {
  formatCompactSchedule,
  getSetServingStatus,
  isEventActiveNow,
  isSetServingNow,
  resolveSetSchedule,
} from './events'

describe('festival schedule helpers', () => {
  const weekdaySchedule = [
    { weekday: 1, open_time: '08:00', close_time: '12:00' },
    { weekday: 2, open_time: '08:00', close_time: '12:00' },
    { weekday: 3, open_time: '08:00', close_time: '12:00' },
    { weekday: 4, open_time: '08:00', close_time: '12:00' },
    { weekday: 5, open_time: '08:00', close_time: '12:00' },
    { weekday: 6, open_time: '09:00', close_time: '14:00' },
    { weekday: 7, open_time: '09:00', close_time: '14:00' },
  ]

  it('compacts identical weekday windows', () => {
    expect(formatCompactSchedule(weekdaySchedule)).toBe(
      'Пн–Пт 08:00–12:00 · Сб–Вс 09:00–14:00',
    )
  })

  it('prefers offer-specific schedule rows', () => {
    const rows = [
      { weekday: 1, open_time: '08:00', close_time: '12:00', offer_id: null },
      { weekday: 1, open_time: '10:00', close_time: '11:00', offer_id: 'offer-1' },
    ]
    expect(resolveSetSchedule(rows, 'offer-1')).toEqual([
      { weekday: 1, open_time: '10:00', close_time: '11:00', offer_id: 'offer-1' },
    ])
  })

  it('detects active event by inclusive date range', () => {
    expect(
      isEventActiveNow(
        {
          starts_at: '2026-11-17',
          ends_at: '2026-11-17',
          is_published: true,
        },
        new Date('2026-11-17T05:00:00+05:00'),
      ),
    ).toBe(true)
    expect(
      isEventActiveNow(
        {
          starts_at: '2026-11-01',
          ends_at: '2026-11-16',
          is_published: true,
        },
        new Date('2026-11-17T05:00:00+05:00'),
      ),
    ).toBe(false)
  })

  it('reports outside window status labels', () => {
    // Monday 15:00 Almaty — after 12:00 close
    const mondayAfternoon = new Date('2026-11-16T15:00:00+05:00')
    expect(isSetServingNow(weekdaySchedule, mondayAfternoon)).toBe(false)
    const status = getSetServingStatus(weekdaySchedule, mondayAfternoon)
    expect(status.isServing).toBe(false)
    expect(status.badgeLabel).toBe('сегодня не подают')
  })
})
