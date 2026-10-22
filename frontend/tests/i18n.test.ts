import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadI18n, t } from '../src/i18n'
import { mockFetch } from './helpers'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('t()', () => {
  it('returns english fallback and the key itself when unknown', async () => {
    mockFetch(() => ({}))
    await loadI18n()
    expect(t('login')).toBe('Login')
    expect(t('no_such_key_xyz')).toBe('no_such_key_xyz')
  })
})

describe('loadI18n', () => {
  it('merges the backend language over english', async () => {
    mockFetch((api) => {
      expect(api).toBe('getI18N')
      return { login: 'Anmelden', extra_key: 'X' }
    })
    await loadI18n()
    expect(t('login')).toBe('Anmelden')
    // english keys survive the merge
    expect(t('logout')).toBe('Log Off')
    expect(t('extra_key')).toBe('X')
  })
})
