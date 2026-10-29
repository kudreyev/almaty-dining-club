import { describe, expect, it } from 'vitest'
import {
  cityDescription,
  cityMapTitle,
  cityTitle,
  pageMetadata,
  restaurantDescription,
  restaurantTitle,
} from './seo'

describe('city meta', () => {
  it('uses the prepositional case in titles', () => {
    expect(cityTitle('almaty')).toBe('KudaClub: 1+1 в кафе и ресторанах в Алматы бесплатно')
    expect(cityTitle('astana')).toBe('KudaClub: 1+1 в кафе и ресторанах в Астане бесплатно')
    expect(cityMapTitle('astana')).toBe('Карта заведений KudaClub в Астане: 1+1 бесплатно')
  })

  it('puts the real venue count into the description', () => {
    expect(cityDescription('almaty', 68)).toBe(
      'Бесплатные предложения 1+1, напитки и десерты в 68 заведениях Алматы. Без подписки и приложения.',
    )
    expect(cityDescription('astana', 21)).toContain('в 21 заведении Астаны')
    expect(cityDescription('astana', null)).toContain('в лучших заведениях Астаны')
  })
})

describe('restaurant meta', () => {
  it('builds title and description from the main offer', () => {
    const offer = { offer_type: '2for1' as const, offer_title: 'Паста' }
    expect(restaurantTitle('Anytime cafe', offer)).toBe('Anytime cafe: Паста 1+1 бесплатно | KudaClub')
    expect(restaurantDescription('Anytime cafe', 'ул. Абая, 10', offer)).toBe(
      'Паста 1+1 в Anytime cafe, ул. Абая, 10. Получите код на KudaClub и покажите официанту.',
    )
  })

  it('strips zero-width characters and stray spaces from admin data', () => {
    const offer = { offer_type: '2for1' as const, offer_title: 'Том Ям' }
    expect(restaurantTitle('BAO в \u200BТРЦ Mega Center ', offer)).toBe(
      'BAO в ТРЦ Mega Center: Том Ям 1+1 бесплатно | KudaClub',
    )
    expect(restaurantDescription('BAO', '\u200BMega Alma-Ata\u200BУлица Розыбакиева, 247а', offer)).toBe(
      'Том Ям 1+1 в BAO, Mega Alma-Ata Улица Розыбакиева, 247а. Получите код на KudaClub и покажите официанту.',
    )
  })

  it('does not call Kudafest sets free and survives missing data', () => {
    expect(restaurantTitle('Leon', { offer_type: 'kudafest_set', offer_title: 'Сет №1' })).toBe(
      'Leon: сеты Kudafest | KudaClub',
    )
    expect(restaurantTitle('Leon', null)).toBe('Leon | KudaClub')
    expect(restaurantDescription('Leon', '', null)).toBe(
      'Leon. Получите код на KudaClub и покажите официанту.',
    )
  })
})

describe('pageMetadata', () => {
  it('repeats title and description in Open Graph and Twitter', () => {
    const meta = pageMetadata({ title: 'T', description: 'D', path: '/almaty' })
    expect(meta.openGraph).toMatchObject({ title: 'T', description: 'D', url: '/almaty' })
    expect(meta.twitter).toMatchObject({ title: 'T', description: 'D' })
    expect(meta.alternates).toEqual({ canonical: '/almaty' })
  })
})
