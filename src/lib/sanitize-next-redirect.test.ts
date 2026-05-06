import { describe, it, expect } from 'vitest'
import {
  checkNextRedirect,
  sanitizeNextRedirect,
  tryOptionalNext,
} from '@/lib/sanitize-next-redirect'

describe('sanitizeNextRedirect', () => {
  it("maps '/' → '/'", () => {
    expect(sanitizeNextRedirect('/')).toBe('/')
  })

  it("maps '/app/me' → '/app/me'", () => {
    expect(sanitizeNextRedirect('/app/me')).toBe('/app/me')
  })

  it("maps '//evil.com' → '/'", () => {
    expect(sanitizeNextRedirect('//evil.com')).toBe('/')
    expect(sanitizeNextRedirect('//evil.com/path')).toBe('/')
  })

  it("maps 'https://evil.com' → '/'", () => {
    expect(sanitizeNextRedirect('https://evil.com')).toBe('/')
  })

  it("maps '/\\\\evil.com' → '/'", () => {
    expect(sanitizeNextRedirect('/\\evil.com')).toBe('/')
  })

  it("preserves '/app%2Fme'", () => {
    expect(sanitizeNextRedirect('/app%2Fme')).toBe('/app%2Fme')
  })

  it("rejects '/admin' when not in list — we allow /admin in whitelist", () => {
    expect(sanitizeNextRedirect('/admin')).toBe('/admin')
    expect(sanitizeNextRedirect('/admin/payments')).toBe('/admin/payments')
  })

  it('null → /', () => {
    expect(sanitizeNextRedirect(null)).toBe('/')
  })

  it('undefined → /', () => {
    expect(sanitizeNextRedirect(undefined)).toBe('/')
  })

  it('empty string uses ifAbsent', () => {
    expect(sanitizeNextRedirect('', '/app/me')).toBe('/app/me')
  })

  it('ifAbsent for OAuth callback', () => {
    expect(sanitizeNextRedirect(null, '/app/me')).toBe('/app/me')
    expect(sanitizeNextRedirect(undefined, '/app/me')).toBe('/app/me')
  })

  it('rejects paths outside whitelist', () => {
    expect(sanitizeNextRedirect('/evil')).toBe('/')
    expect(sanitizeNextRedirect('//evil.com/x')).toBe('/')
    expect(sanitizeNextRedirect('https://evil.com')).toBe('/')
  })
})

describe('tryOptionalNext', () => {
  it('undefined → undefined', () => {
    expect(tryOptionalNext(undefined)).toBeUndefined()
  })

  it('invalid → undefined', () => {
    expect(tryOptionalNext('//evil.com')).toBeUndefined()
  })

  it('valid → value', () => {
    expect(tryOptionalNext('/app/me')).toBe('/app/me')
  })
})

describe('checkNextRedirect', () => {
  it('rejects /application (not under /app/)', () => {
    expect(checkNextRedirect('/application').ok).toBe(false)
  })
})
