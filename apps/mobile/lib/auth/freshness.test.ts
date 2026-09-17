import { describe, expect, it } from 'vitest'
import { isFresh } from './freshness'

describe('isFresh', () => {
    it('is fresh well before expiry', () => {
        const now = 1_000_000 * 1000
        expect(isFresh(1_000_000 + 3600, now)).toBe(true)
    })

    it('is not fresh once inside the 30s margin', () => {
        const now = 1_000_000 * 1000
        expect(isFresh(1_000_000 + 20, now)).toBe(false)
    })

    it('is not fresh once already expired', () => {
        const now = 1_000_000 * 1000
        expect(isFresh(1_000_000 - 1, now)).toBe(false)
    })

    it('treats the exact margin boundary as not fresh', () => {
        const now = 1_000_000 * 1000
        expect(isFresh(1_000_000 + 30, now)).toBe(false)
    })
})
