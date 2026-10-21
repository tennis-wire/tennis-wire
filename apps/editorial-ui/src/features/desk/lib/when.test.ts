import { describe, expect, it } from 'vitest'

import { agoOf } from './when'

const NOW = new Date('2026-10-21T12:00:00Z')

describe('agoOf', () => {
    it('counts minutes, then hours, then gives the date', () => {
        expect(agoOf('2026-10-21T11:59:40Z', NOW)).toBe('только что')
        expect(agoOf('2026-10-21T11:56:00Z', NOW)).toBe('4 мин назад')
        expect(agoOf('2026-10-21T09:00:00Z', NOW)).toBe('3 ч назад')
        expect(agoOf('2026-10-20T10:05:00Z', NOW)).toMatch(/^20 окт, \d{2}:05$/)
    })
})
