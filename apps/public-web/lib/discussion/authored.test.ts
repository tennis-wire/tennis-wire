import { describe, expect, it } from 'vitest'

import type { ArticleRef } from '@/lib/content/refs'

import { initial, reduce, type State } from './authored'
import type { Comment } from './types'

const comment = (id: string) => ({ id }) as Comment
const ref = (id: string): ArticleRef => ({ id, type: 'news', slug: id, title: id })

function ready(): State {
    return reduce(initial, {
        type: 'loaded',
        page: { items: [comment('1')], cursor: 'c1', refs: new Map([['a', ref('a')]]) },
    })
}

describe('reduce', () => {
    it('opens on the first page', () => {
        const state = ready()
        expect(state.phase).toBe('ready')
        if (state.phase !== 'ready') return
        expect(state.items.map((item) => item.id)).toEqual(['1'])
        expect(state.cursor).toBe('c1')
        expect(state.more).toBe('idle')
    })

    it('adds the next page under the first and takes its cursor and refs', () => {
        const refs = new Map([
            ['a', ref('a')],
            ['b', null],
        ])
        const state = reduce(reduce(ready(), { type: 'more-loading' }), {
            type: 'more-loaded',
            page: { items: [comment('2')], cursor: null, refs },
        })
        if (state.phase !== 'ready') throw new Error(state.phase)
        expect(state.items.map((item) => item.id)).toEqual(['1', '2'])
        expect(state.cursor).toBeNull()
        expect(state.refs.get('b')).toBeNull()
        expect(state.more).toBe('idle')
    })

    it('keeps what it has when the next page fails', () => {
        const state = reduce(reduce(ready(), { type: 'more-loading' }), { type: 'more-failed' })
        if (state.phase !== 'ready') throw new Error(state.phase)
        expect(state.items).toHaveLength(1)
        expect(state.cursor).toBe('c1')
        expect(state.more).toBe('failed')
    })

    it('ignores a late page once the list is loading again', () => {
        const state = reduce(initial, {
            type: 'more-loaded',
            page: { items: [comment('2')], cursor: null, refs: new Map() },
        })
        expect(state).toEqual(initial)
    })
})
