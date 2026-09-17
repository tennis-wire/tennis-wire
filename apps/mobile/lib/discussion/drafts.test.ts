import { beforeEach, describe, expect, it } from 'vitest'

import {
    DRAFT_TTL_MS,
    clearDraft,
    clearDraftsOf,
    draftKey,
    readDraft,
    saveDraft,
    sweepDrafts,
    type AsyncStore,
} from './drafts'

// the part of AsyncStorage the module uses
class FakeStore implements AsyncStore {
    private map = new Map<string, string>()
    get size() {
        return this.map.size
    }
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

let store: FakeStore
const key = draftKey('user-1', 'article-1', null)
const reply = draftKey('user-1', 'article-1', 'comment-9')
const T0 = 1_000_000

beforeEach(() => {
    store = new FakeStore()
})

describe('drafts', () => {
    it('keeps a draft per reader, article and form', async () => {
        await saveDraft(key, 'top', T0, store)
        await saveDraft(reply, 'under nine', T0, store)

        expect(await readDraft(key, T0, store)).toBe('top')
        expect(await readDraft(reply, T0, store)).toBe('under nine')
        expect(await readDraft(draftKey('user-2', 'article-1', null), T0, store)).toBeNull()
    })

    it('forgets a draft after seven days and an emptied one at once', async () => {
        await saveDraft(key, 'old', T0, store)
        expect(await readDraft(key, T0 + DRAFT_TTL_MS, store)).toBe('old')
        expect(await readDraft(key, T0 + DRAFT_TTL_MS + 1, store)).toBeNull()
        expect(store.size).toBe(0)

        await saveDraft(key, 'text', T0, store)
        await saveDraft(key, '   ', T0, store)
        expect(store.size).toBe(0)
    })

    it('clears one form, or everything of one reader, and nobody else', async () => {
        await saveDraft(key, 'a', T0, store)
        await saveDraft(reply, 'b', T0, store)
        const other = draftKey('user-2', 'article-1', null)
        await saveDraft(other, 'c', T0, store)

        await clearDraft(reply, store)
        expect(await readDraft(reply, T0, store)).toBeNull()
        expect(await readDraft(key, T0, store)).toBe('a')

        await clearDraftsOf('user-1', store)
        expect(await readDraft(key, T0, store)).toBeNull()
        expect(await readDraft(other, T0, store)).toBe('c')
    })

    it('sweeps what expired and skips what did not', async () => {
        await saveDraft(key, 'stale', T0, store)
        await saveDraft(reply, 'fresh', T0 + DRAFT_TTL_MS, store)
        await store.setItem('unrelated', 'x')

        await sweepDrafts(T0 + DRAFT_TTL_MS + 1, store)

        expect(store.size).toBe(2)
        expect(await readDraft(reply, T0 + DRAFT_TTL_MS + 1, store)).toBe('fresh')
    })

    it('drops what it cannot read', async () => {
        await store.setItem(key, '{not json')
        expect(await readDraft(key, T0, store)).toBeNull()
        expect(store.size).toBe(0)
    })
})
