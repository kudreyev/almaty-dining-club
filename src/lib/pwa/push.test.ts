import { describe, expect, it } from 'vitest'
import { urlBase64ToUint8Array } from '@/lib/pwa/push'

describe('urlBase64ToUint8Array', () => {
  it('decodes URL-safe base64 without padding (VAPID public key format)', () => {
    expect(Array.from(urlBase64ToUint8Array('AQID_-8'))).toEqual([1, 2, 3, 255, 239])
  })
})
