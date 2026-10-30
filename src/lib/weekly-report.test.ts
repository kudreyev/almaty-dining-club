import { describe, expect, it } from 'vitest'
import {
  formatInt,
  formatKzt,
  formatSigned,
  formatWeeklyReportTelegram,
  snapToMonday,
  weeklyReportToCsv,
  type WeeklyReport,
} from './weekly-report'

const sample: WeeklyReport = {
  week: { start: '2026-11-03', end: '2026-11-09', label: '3–9 ноября' },
  users: {
    registered_total: 412,
    registered_total_prev: 325,
    new: 87,
    new_prev: 61,
  },
  activity: {
    weekly_active: 38,
    weekly_active_prev: 26,
    redemptions: 54,
    redemptions_prev: 35,
    redemptions_30d: 131,
    redemptions_30d_prev: 100,
  },
  retention_m2_pct: 14,
  retention_m2_pct_prev: 12,
  savings: { week: 236000, week_prev: 180000, lifetime: 1_400_000 },
  venues: {
    active: 17,
    with_redemptions: 11,
    with_redemptions_prev: 9,
    zero_count: 6,
    zero_names: ['Кафе А', 'Кафе Б', 'Кафе В'],
  },
  top_venues: [
    { name: 'Антрекот', redemptions: 12, guests: 11, new_guests: 9, returning_guests: 2 },
    { name: 'BAO', redemptions: 8, guests: 8, new_guests: 0, returning_guests: 8 },
    { name: 'Unai', redemptions: 7, guests: 6, new_guests: 0, returning_guests: 6 },
    { name: 'Prosto Bar', redemptions: 5, guests: 5, new_guests: 0, returning_guests: 5 },
    { name: 'BIRCOS', redemptions: 4, guests: 4, new_guests: 0, returning_guests: 4 },
  ],
  top_offers: [],
  venues_week: [],
  by_weekday: [],
  by_hour: [],
  peak: { weekday: 'пт', hour_start: 19, hour_end: 21, label: 'пт 19–21 ч' },
  channels: {
    by_utm_source: [],
    by_ref_code: [],
    combined: [
      { channel: 'instagram', count: 31 },
      { channel: 'ref', count: 24 },
      { channel: 'qr', count: 18 },
      { channel: 'неизвестно', count: 14 },
    ],
  },
  goals: {
    target_date: '2026-11-30',
    items: [
      { metric: 'registered', current: 412, target: 500, pct: 82 },
      { metric: 'weekly_active', current: 38, target: 50, pct: 76 },
      { metric: 'redemptions_30d', current: 131, target: 100, pct: 131 },
      { metric: 'active_venues', current: 17, target: 20, pct: 85 },
    ],
  },
}

describe('weekly report format', () => {
  it('groups thousands with spaces and millions with comma', () => {
    expect(formatInt(236000)).toBe('236 000')
    expect(formatKzt(236000)).toBe('236 000 ₸')
    expect(formatKzt(1_400_000)).toBe('1,4 млн ₸')
    expect(formatSigned(87)).toBe('+87')
    expect(formatSigned(-12)).toBe('-12')
  })

  it('matches the phone message layout', () => {
    const text = formatWeeklyReportTelegram(sample)
    expect(text).toContain('<b>KudaClub: неделя 3–9 ноября</b>')
    expect(text).toContain('Пользователи: 412 (+87 за неделю, было +61)')
    expect(text).toContain('Активных за неделю: 38 (+12)')
    expect(text).toContain('Погашений: 54 (+19) · за 30 дней: 131')
    expect(text).toContain('Удержание во 2-м месяце: 14%')
    expect(text).toContain('Выгода гостей: 236 000 ₸ · всего 1,4 млн ₸')
    expect(text).toContain('Цели к 30.11: пользователи 82% · активные 76% · погашения 30 дн. 131% · заведения 85%')
    expect(text).toContain('Топ заведений: Антрекот 12 (9 новых) · BAO 8 · Unai 7 · Prosto Bar 5 · BIRCOS 4')
    expect(text).toContain('Без погашений: 6 заведений (Кафе А, Кафе Б, Кафе В)')
    expect(text).toContain('Каналы: instagram 31 · ref 24 · qr 18 · неизвестно 14')
    expect(text).toContain('Пик: пт 19–21 ч')
    expect(/[↑↓→←]/.test(text) || text.includes('✅') || text.includes('🔥')).toBe(false)
  })

  it('builds csv and snaps week to monday', () => {
    expect(snapToMonday('2026-09-24')).toBe('2026-09-21')
    expect(weeklyReportToCsv([
      {
        name: 'BAO, bar',
        city: 'almaty',
        is_active: true,
        redemptions: 8,
        guests: 7,
        new_guests: 3,
        returning_guests: 4,
        savings: 40000,
      },
    ])).toContain('"BAO, bar",almaty,да,8,7,3,4,40000')
  })
})
