import { describe, expect, it } from 'vitest'

import { parseQuery } from './TagFeed'

describe('parseQuery', () => {
    it('reads the filter and the page, and shrugs at anything else', () => {
        expect(parseQuery({})).toEqual({ type: null, page: 0 })
        expect(parseQuery({ type: 'news', page: '3' })).toEqual({ type: 'news', page: 3 })
        expect(parseQuery({ type: 'video', page: '-2' })).toEqual({ type: null, page: 0 })
        expect(parseQuery({ page: 'x' })).toEqual({ type: null, page: 0 })
    })
})
