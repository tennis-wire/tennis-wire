// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'

import { NO_FILTER, readFilter, writeFilter } from './feedFilter'

beforeEach(() => localStorage.clear())

describe('feed filter', () => {
    it('is remembered per person', () => {
        writeFilter('anna', { sources: ['sports-ru'], languages: ['ru'] })

        expect(readFilter('anna')).toEqual({ sources: ['sports-ru'], languages: ['ru'] })
        expect(readFilter('boris')).toEqual(NO_FILTER)
    })

    it('forgets itself once cleared, and survives junk', () => {
        writeFilter('anna', { sources: ['sports-ru'], languages: [] })
        writeFilter('anna', NO_FILTER)
        expect(localStorage.length).toBe(0)

        localStorage.setItem('sources-filter:anna', '{"sources": [1, "x"], "languages": "ru"}')
        expect(readFilter('anna')).toEqual({ sources: ['x'], languages: [] })
        localStorage.setItem('sources-filter:anna', 'not json')
        expect(readFilter('anna')).toEqual(NO_FILTER)
    })
})
