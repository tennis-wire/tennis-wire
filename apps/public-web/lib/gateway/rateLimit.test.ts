import { beforeEach, describe, expect, it } from 'vitest'

import { clientAddress, resetBuckets, takeToken } from './rateLimit'

describe('clientAddress', () => {
    it('takes the rightmost entry, the one a client cannot write', () => {
        expect(clientAddress('1.1.1.1, 2.2.2.2, 3.3.3.3')).toBe('3.3.3.3')
    })

    it('handles a single entry and an absent header', () => {
        expect(clientAddress('1.1.1.1')).toBe('1.1.1.1')
        expect(clientAddress(null)).toBeNull()
        expect(clientAddress('  ')).toBeNull()
    })
})

describe('takeToken', () => {
    beforeEach(resetBuckets)

    it('allows a burst up to capacity, then refuses', () => {
        const now = 1_000_000
        for (let i = 0; i < 20; i++) expect(takeToken('a', now)).toBe(true)
        expect(takeToken('a', now)).toBe(false)
    })

    it('refills over time', () => {
        const now = 1_000_000
        for (let i = 0; i < 20; i++) takeToken('a', now)
        // five per second is one token every 200ms
        expect(takeToken('a', now + 199)).toBe(false)
        expect(takeToken('a', now + 200)).toBe(true)
    })

    it('keeps addresses apart', () => {
        const now = 1_000_000
        for (let i = 0; i < 20; i++) takeToken('a', now)
        expect(takeToken('b', now)).toBe(true)
    })
})
