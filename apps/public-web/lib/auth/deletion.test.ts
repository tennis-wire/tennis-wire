import { describe, expect, it } from 'vitest'

import {
    carriesDeletionMark,
    confirmDeletionHref,
    deletionOutcome,
    withoutDeletionMark,
} from './deletion'

describe('confirmDeletionHref', () => {
    it('sends the reader through a fresh login and back to the last step', () => {
        const url = new URL(confirmDeletionHref(), 'http://localhost:3000')

        expect(url.pathname).toBe('/api/auth/login')
        expect(url.searchParams.get('prompt')).toBe('login')
        expect(url.searchParams.get('returnTo')).toBe('/me/settings/actions?delete=confirmed')
    })
})

describe('carriesDeletionMark', () => {
    it('reads the mark off the query and nothing else', () => {
        expect(carriesDeletionMark('?delete=confirmed')).toBe(true)
        expect(carriesDeletionMark('?delete=yes')).toBe(false)
        expect(carriesDeletionMark('')).toBe(false)
    })
})

describe('withoutDeletionMark', () => {
    it('drops the mark and keeps the rest of the address', () => {
        expect(withoutDeletionMark('/me/settings/actions?delete=confirmed')).toBe(
            '/me/settings/actions'
        )
        expect(withoutDeletionMark('/me/settings/actions?tab=1&delete=confirmed#top')).toBe(
            '/me/settings/actions?tab=1#top'
        )
    })

    it('leaves an address without the mark exactly as it was', () => {
        expect(withoutDeletionMark('/news/sinner#c=42')).toBe('/news/sinner#c=42')
    })
})

describe('deletionOutcome', () => {
    it('tells a deleted account, a login to confirm again and a failure apart', () => {
        expect(deletionOutcome({ ok: true, status: 202 })).toBe('deleted')
        expect(deletionOutcome({ ok: false, status: 401 })).toBe('confirm-again')
        expect(deletionOutcome({ ok: false, status: 503 })).toBe('failed')
    })
})
