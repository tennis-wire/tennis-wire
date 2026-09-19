import { beforeEach, describe, expect, it } from 'vitest'

import { DEFAULT_SORT, rememberSort, storedSort } from './sort'

function store(): Storage {
    const held = new Map<string, string>()
    return {
        getItem: (key) => held.get(key) ?? null,
        setItem: (key, value) => void held.set(key, value),
        removeItem: (key) => void held.delete(key),
        clear: () => held.clear(),
        key: () => null,
        get length() {
            return held.size
        },
    } as Storage
}

describe('storedSort', () => {
    let held: Storage

    beforeEach(() => {
        held = store()
    })

    it('is the default until something is chosen', () => {
        expect(storedSort(held)).toBe(DEFAULT_SORT)
    })

    it('gives back what was chosen', () => {
        rememberSort('top', held)

        expect(storedSort(held)).toBe('top')
    })

    it('falls back to the default on a value it does not know', () => {
        held.setItem('tw-comment-sort', 'loudest')

        expect(storedSort(held)).toBe(DEFAULT_SORT)
    })

    it('reads and writes nothing when there is no storage', () => {
        expect(storedSort(null)).toBe(DEFAULT_SORT)
        expect(() => rememberSort('top', null)).not.toThrow()
    })
})
