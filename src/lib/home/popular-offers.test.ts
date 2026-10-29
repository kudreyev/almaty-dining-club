import { describe, expect, it } from 'vitest'
import { pickPopularOffers } from './popular-offers'
import type { Offer } from '@/lib/types'

function restaurant(slug: string, offers: Offer[], cover: string | null = null) {
  return { slug, restaurant_name: slug.toUpperCase(), cover_photo_url: cover, offers }
}

function offer(partial: Partial<Offer> & Pick<Offer, 'offer_type' | 'offer_title'>): Offer {
  return { is_active: true, estimated_value: null, ...partial }
}

describe('pickPopularOffers', () => {
  it('puts 1+1 dinners before gifts and coffee, strongest value first', () => {
    const result = pickPopularOffers([
      restaurant('coffee', [offer({ offer_type: '2for1', offer_title: 'Капучино', estimated_value: 1200 })]),
      restaurant('dessert', [offer({ offer_type: 'compliment', offer_title: 'Десерт', estimated_value: 3000 })]),
      restaurant('entrecote', [offer({ offer_type: '2for1', offer_title: '2 стейка по цене 1', estimated_value: 9000 })]),
      restaurant('unai', [offer({ offer_type: '2for1', offer_title: '2 пиццы по цене 1', estimated_value: 5000 })]),
    ])

    expect(result.map((o) => o.restaurantSlug)).toEqual(['entrecote', 'unai', 'coffee', 'dessert'])
  })

  it('takes one best offer per restaurant and respects the limit', () => {
    const result = pickPopularOffers(
      [
        restaurant('bao', [
          offer({ offer_type: 'compliment', offer_title: 'Чай', estimated_value: 800 }),
          offer({ offer_type: '2for1', offer_title: 'Бао', estimated_value: 4000 }),
        ]),
        restaurant('a', [offer({ offer_type: '2for1', offer_title: 'A', estimated_value: 100 })]),
        restaurant('b', [offer({ offer_type: '2for1', offer_title: 'B', estimated_value: 200 })]),
      ],
      2,
    )

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ restaurantSlug: 'bao', offerTitle: 'Бао', offerType: '2for1' })
    expect(result[1].restaurantSlug).toBe('b')
  })

  it('skips inactive offers and restaurants without active offers', () => {
    const result = pickPopularOffers([
      restaurant('off', [offer({ offer_type: '2for1', offer_title: 'X', is_active: false })]),
      restaurant('on', [offer({ offer_type: 'compliment', offer_title: 'Y' })], 'cover.jpg'),
    ])

    expect(result).toEqual([
      {
        restaurantSlug: 'on',
        restaurantName: 'ON',
        offerType: 'compliment',
        offerTitle: 'Y',
        estimatedValue: null,
        photoUrl: 'cover.jpg',
      },
    ])
  })
})
