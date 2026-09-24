import { describe, expect, it } from 'vitest'

import { formatShort } from './format'

// Local time on both sides: the words follow the reader's calendar, not UTC
function at(year: number, month: number, date: number, hour: number, minute: number): string {
    return new Date(year, month - 1, date, hour, minute).toISOString()
}

describe('formatShort', () => {
    const now = new Date(2026, 2, 21, 10, 0)

    it('says today and yesterday in words, with the time', () => {
        expect(formatShort(at(2026, 3, 21, 9, 5), now)).toBe('сегодня в 09:05')
        expect(formatShort(at(2026, 3, 20, 21, 14), now)).toBe('вчера в 21:14')
    })

    it('gives the day and the month within this year, and the year without the hour before it', () => {
        expect(formatShort(at(2026, 3, 18, 12, 40), now)).toBe('18 марта в 12:40')
        expect(formatShort(at(2025, 12, 31, 23, 59), now)).toBe('31 декабря 2025 г.')
    })

    it('counts calendar days, not hours: just before midnight is yesterday a minute later', () => {
        const justAfter = new Date(2026, 2, 21, 0, 1)
        expect(formatShort(at(2026, 3, 20, 23, 59), justAfter)).toBe('вчера в 23:59')
    })
})
