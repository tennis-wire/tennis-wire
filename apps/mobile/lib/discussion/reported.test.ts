import { describe, expect, it } from 'vitest'

import { markReported, wasReported } from './reported'
import type { AsyncStore } from './drafts'

class FakeStore implements AsyncStore {
    private map = new Map<string, string>()
    async getItem(key: string) {
        return this.map.get(key) ?? null
    }
    async setItem(key: string, value: string) {
        this.map.set(key, value)
    }
    async removeItem(key: string) {
        this.map.delete(key)
    }
    async getAllKeys() {
        return [...this.map.keys()]
    }
    async multiRemove(keys: string[]) {
        for (const key of keys) this.map.delete(key)
    }
}

describe('reported', () => {
    it('remembers what this device reported', async () => {
        const store = new FakeStore()
        expect(await wasReported('a', store)).toBe(false)

        await markReported('a', store)

        expect(await wasReported('a', store)).toBe(true)
        expect(await wasReported('b', store)).toBe(false)
    })

    it('keeps the last five hundred', async () => {
        const store = new FakeStore()
        for (let index = 0; index < 501; index += 1) await markReported(`c${index}`, store)

        expect(await wasReported('c0', store)).toBe(false)
        expect(await wasReported('c1', store)).toBe(true)
        expect(await wasReported('c500', store)).toBe(true)
    })

    it('starts over from anything it cannot read', async () => {
        const store = new FakeStore()
        await store.setItem('tw-reported', '{oops')
        expect(await wasReported('a', store)).toBe(false)

        await markReported('a', store)
        expect(await wasReported('a', store)).toBe(true)
    })
})
