import { describe, expect, it } from 'vitest'
import { PUSH_TEMPLATES, fillPushTemplate, hasUnfilledPlaceholders } from '@/lib/push-templates'

describe('push templates', () => {
  it('fills placeholders and keeps unknown ones visible', () => {
    const template = PUSH_TEMPLATES.find((t) => t.id === 'new_venue')!
    const vars = { name: 'Антрекот', offer: '2 стейка по цене 1', slug: 'entrecote' }
    expect(fillPushTemplate(template.title, vars)).toBe('Новое в KudaClub: Антрекот, 2 стейка по цене 1')
    expect(fillPushTemplate(template.url, vars)).toBe('/r/entrecote')
    expect(fillPushTemplate('/{city}', {})).toBe('/{city}')
    expect(hasUnfilledPlaceholders('/{city}')).toBe(true)
  })

  it('fits the 50-character title limit of the admin form', () => {
    for (const template of PUSH_TEMPLATES) {
      expect(template.title.length).toBeLessThanOrEqual(50)
      expect(template.body.length).toBeLessThanOrEqual(120)
    }
  })
})
