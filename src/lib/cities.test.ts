import { describe, expect, it } from 'vitest'
import { cityFromGeo, cityFromPathname, isBotUserAgent } from './cities'

describe('cityFromGeo', () => {
  it('maps Vercel city names', () => {
    expect(cityFromGeo({ city: 'Almaty', country: 'KZ' })).toBe('almaty')
    expect(cityFromGeo({ city: 'Astana', country: 'KZ' })).toBe('astana')
    expect(cityFromGeo({ city: 'Nur-Sultan', country: 'KZ' })).toBe('astana')
    expect(cityFromGeo({ city: 'Nur%20Sultan', country: 'KZ' })).toBe('astana')
    expect(cityFromGeo({ city: '%D0%90%D0%BB%D0%BC%D0%B0%D1%82%D1%8B' })).toBe('almaty')
  })

  it('falls back to the KZ region code', () => {
    expect(cityFromGeo({ city: 'Kaskelen', region: '19', country: 'KZ' })).toBe('almaty')
    expect(cityFromGeo({ region: '71', country: 'KZ' })).toBe('astana')
    expect(cityFromGeo({ region: 'KZ-75', country: 'KZ' })).toBe('almaty')
  })

  it('returns null for unsupported places', () => {
    expect(cityFromGeo({ city: 'Shymkent', region: '79', country: 'KZ' })).toBeNull()
    expect(cityFromGeo({ city: 'Moscow', region: '75', country: 'RU' })).toBeNull()
    expect(cityFromGeo({})).toBeNull()
  })
})

describe('cityFromPathname', () => {
  it('reads the first segment', () => {
    expect(cityFromPathname('/astana/map')).toBe('astana')
    expect(cityFromPathname('/almaty')).toBe('almaty')
    expect(cityFromPathname('/r/leon')).toBeNull()
    expect(cityFromPathname('/')).toBeNull()
  })
})

describe('isBotUserAgent', () => {
  it('detects search engines and link previews', () => {
    expect(
      isBotUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'),
    ).toBe(true)
    expect(isBotUserAgent('Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)')).toBe(true)
    expect(isBotUserAgent('TelegramBot (like TwitterBot)')).toBe(true)
  })

  it('lets real browsers through', () => {
    expect(
      isBotUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe(false)
    expect(isBotUserAgent(null)).toBe(false)
  })
})
