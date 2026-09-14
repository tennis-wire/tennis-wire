import { describe, expect, it } from 'vitest'

import { safeReturnTo, sameOriginPath } from './returnTo'

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

describe('sameOriginPath', () => {
    const origin = 'http://localhost:3000'

    it('takes the path from a referer on this origin', () => {
        expect(sameOriginPath('http://localhost:3000/news?page=2', origin)).toBe('/news?page=2')
    })

    it('ignores a referer from anywhere else', () => {
        expect(sameOriginPath('https://evil.example/news', origin)).toBeNull()
        expect(sameOriginPath('not a url', origin)).toBeNull()
        expect(sameOriginPath(null, origin)).toBeNull()
    })
})
