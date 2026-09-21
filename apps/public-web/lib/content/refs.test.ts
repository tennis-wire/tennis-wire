import { describe, expect, it } from 'vitest'

import type { Comment } from '@/lib/discussion/types'

import { articleHref, resolved, unresolved, type ArticleRef } from './refs'

function comment(subjectId: string, subjectType = 'publication'): Comment {
    return { subjectId, subjectType } as Comment
}

const ref = (id: string): ArticleRef => ({ id, type: 'news', slug: `s-${id}`, title: `t-${id}` })

describe('unresolved', () => {
    it('asks about each article once and skips the ones already known', () => {
        const known = new Map([['a', ref('a')]])
        expect(unresolved([comment('a'), comment('b'), comment('b'), comment('c')], known)).toEqual(
            ['b', 'c']
        )
    })

    it('does not ask about a known absence again', () => {
        expect(unresolved([comment('gone')], new Map([['gone', null]]))).toEqual([])
    })

    it('leaves out subjects that are not articles', () => {
        expect(unresolved([comment('x', 'tournament')], new Map())).toEqual([])
    })
})

describe('resolved', () => {
    it('marks what was asked and not found as absent', () => {
        const next = resolved(new Map(), ['a', 'gone'], [ref('a')])
        expect(next.get('a')).toEqual(ref('a'))
        expect(next.get('gone')).toBeNull()
        expect(next.has('gone')).toBe(true)
    })

    it('keeps what was known before', () => {
        const next = resolved(new Map([['old', ref('old')]]), ['a'], [ref('a')])
        expect(next.get('old')).toEqual(ref('old'))
    })
})

describe('articleHref', () => {
    it('sends news and materials to their own sections', () => {
        expect(articleHref(ref('a'))).toBe('/news/s-a')
        expect(articleHref({ ...ref('b'), type: 'article' })).toBe('/materials/s-b')
    })
})
