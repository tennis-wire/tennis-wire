import { describe, expect, it } from 'vitest'

import { safeReturnTo } from './returnTo'

describe('safeReturnTo', () => {
    it('keeps a path inside the app, query and fragment included', () => {
        expect(safeReturnTo('/news/djokovic?page=2#comments')).toBe(
            '/news/djokovic?page=2#comments'
        )
    })

    it('falls back to the home page when there is nothing to return to', () => {
        expect(safeReturnTo(null)).toBe('/')
        expect(safeReturnTo('')).toBe('/')
    })

    it('refuses to leave the app', () => {
        expect(safeReturnTo('https://evil.example/news')).toBe('/')
        expect(safeReturnTo('//evil.example/news')).toBe('/')
        expect(safeReturnTo('/\\evil.example/news')).toBe('/')
        expect(safeReturnTo('javascript:alert(1)')).toBe('/')
    })

    it('refuses control characters', () => {
        expect(safeReturnTo('/news\nLocation: https://evil.example')).toBe('/')
    })
})
