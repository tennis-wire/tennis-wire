import { describe, expect, it } from 'vitest'

import { markReported, wasReported } from './reported'

class FakeStorage implements Storage {
    private map = new Map<string, string>()
    get length() {
        return this.map.size
    }
    key(index: number) {
        return [...this.map.keys()][index] ?? null
    }
    getItem(key: string) {
        return this.map.get(key) ?? null
    }
    setItem(key: string, value: string) {
        this.map.set(key, value)
    }
    removeItem(key: string) {
        this.map.delete(key)
    }
    clear() {
        this.map.clear()
    }
}

describe('reported', () => {
    it('remembers what this device reported', () => {
        const store = new FakeStorage()
        expect(wasReported('a', store)).toBe(false)

        markReported('a', store)

        expect(wasReported('a', store)).toBe(true)
        expect(wasReported('b', store)).toBe(false)
    })

    it('keeps the last five hundred', () => {
        const store = new FakeStorage()
        for (let index = 0; index < 501; index += 1) markReported(`c${index}`, store)

        expect(wasReported('c0', store)).toBe(false)
        expect(wasReported('c1', store)).toBe(true)
        expect(wasReported('c500', store)).toBe(true)
    })

    it('starts over from anything it cannot read', () => {
        const store = new FakeStorage()
        store.setItem('tw-reported', '{oops')
        expect(wasReported('a', store)).toBe(false)

        markReported('a', store)
        expect(wasReported('a', store)).toBe(true)
    })
})
