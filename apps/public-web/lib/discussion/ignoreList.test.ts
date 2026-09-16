import { describe, expect, it } from 'vitest'

import { initial, reduce, type State } from './ignoreList'
import type { Block } from './types'

function block(id: string, mode: Block['mode'] = 'soft'): Block {
    return {
        blockedId: id,
        user: { id, displayName: id, avatarUrl: null },
        mode,
        createdAt: '2026-09-16T10:00:00Z',
    }
}

function listed(...blocks: Block[]): State {
    return reduce(initial, { type: 'loaded', page: { items: blocks, nextCursor: 'next' } })
}

function rows(state: State) {
    if (state.phase !== 'ready') throw new Error(`not ready: ${state.phase}`)
    return state.rows
}

describe('the ignore list', () => {
    it('shows the first page and remembers where the next one starts', () => {
        const state = listed(block('a'), block('b'))

        expect(state).toMatchObject({ phase: 'ready', cursor: 'next', more: 'idle' })
        expect(rows(state).map((row) => row.block.blockedId)).toEqual(['a', 'b'])
    })

    it('puts the next page under the rows already on show', () => {
        let state = reduce(listed(block('a')), { type: 'more-loading' })
        state = reduce(state, {
            type: 'more-loaded',
            page: { items: [block('b')], nextCursor: null },
        })

        expect(rows(state).map((row) => row.block.blockedId)).toEqual(['a', 'b'])
        expect(state).toMatchObject({ cursor: null, more: 'idle' })
    })

    it('takes the mode from the answer and frees the row', () => {
        let state = reduce(listed(block('a'), block('b')), { type: 'busy', blockedId: 'a' })
        expect(rows(state)[0]).toMatchObject({ busy: true })

        state = reduce(state, { type: 'saved', block: block('a', 'subtree_removal') })

        expect(rows(state)[0]).toMatchObject({
            block: { mode: 'subtree_removal' },
            busy: false,
            failure: null,
        })
        expect(rows(state)[1].block.mode).toBe('soft')
    })

    it('keeps a lifted row in its place until it is put back', () => {
        let state = reduce(listed(block('a'), block('b')), { type: 'busy', blockedId: 'a' })
        state = reduce(state, { type: 'lifted', blockedId: 'a' })

        expect(rows(state).map((row) => row.block.blockedId)).toEqual(['a', 'b'])
        expect(rows(state)[0]).toMatchObject({ lifted: true, busy: false })

        state = reduce(state, { type: 'saved', block: block('a') })
        expect(rows(state)[0]).toMatchObject({ lifted: false })
    })

    it('says on the row why its change did not go through, until the next try', () => {
        let state = reduce(listed(block('a')), { type: 'busy', blockedId: 'a' })
        state = reduce(state, {
            type: 'failed',
            blockedId: 'a',
            failure: { of: 'lift', reason: 'rate' },
        })

        expect(rows(state)[0]).toMatchObject({
            busy: false,
            failure: { of: 'lift', reason: 'rate' },
        })
        expect(rows(reduce(state, { type: 'busy', blockedId: 'a' }))[0].failure).toBeNull()
    })

    it('drops the row of someone user-service no longer knows', () => {
        const state = reduce(listed(block('a'), block('b')), { type: 'gone', blockedId: 'a' })

        expect(rows(state).map((row) => row.block.blockedId)).toEqual(['b'])
    })

    it('leaves a list that is not on show alone', () => {
        expect(reduce(initial, { type: 'busy', blockedId: 'a' })).toBe(initial)
        expect(reduce({ phase: 'failed' }, { type: 'more-loading' })).toEqual({ phase: 'failed' })
    })
})
