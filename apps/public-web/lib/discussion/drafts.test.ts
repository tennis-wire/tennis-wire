import { beforeEach, describe, expect, it } from 'vitest'

import {
    DRAFT_TTL_MS,
    clearDraft,
    clearDraftsOf,
    draftKey,
    readDraft,
    saveDraft,
    sweepDrafts,
} from './drafts'

// the part of Storage the module uses
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

let store: FakeStorage
const key = draftKey('user-1', 'article-1', null)
const reply = draftKey('user-1', 'article-1', 'comment-9')
const T0 = 1_000_000

beforeEach(() => {
    store = new FakeStorage()
})

describe('drafts', () => {
    it('keeps a draft per reader, article and form', () => {
        saveDraft(key, 'top', T0, store)
        saveDraft(reply, 'under nine', T0, store)

        expect(readDraft(key, T0, store)).toBe('top')
        expect(readDraft(reply, T0, store)).toBe('under nine')
        expect(readDraft(draftKey('user-2', 'article-1', null), T0, store)).toBeNull()
    })

    it('forgets a draft after seven days and an emptied one at once', () => {
        saveDraft(key, 'old', T0, store)
        expect(readDraft(key, T0 + DRAFT_TTL_MS, store)).toBe('old')
        expect(readDraft(key, T0 + DRAFT_TTL_MS + 1, store)).toBeNull()
        expect(store.length).toBe(0)

        saveDraft(key, 'text', T0, store)
        saveDraft(key, '   ', T0, store)
        expect(store.length).toBe(0)
    })

    it('clears one form, or everything of one reader, and nobody else', () => {
        saveDraft(key, 'a', T0, store)
        saveDraft(reply, 'b', T0, store)
        const other = draftKey('user-2', 'article-1', null)
        saveDraft(other, 'c', T0, store)

        clearDraft(reply, store)
        expect(readDraft(reply, T0, store)).toBeNull()
        expect(readDraft(key, T0, store)).toBe('a')

        clearDraftsOf('user-1', store)
        expect(readDraft(key, T0, store)).toBeNull()
        expect(readDraft(other, T0, store)).toBe('c')
    })

    it('sweeps what expired and skips what did not', () => {
        saveDraft(key, 'stale', T0, store)
        saveDraft(reply, 'fresh', T0 + DRAFT_TTL_MS, store)
        store.setItem('unrelated', 'x')

        sweepDrafts(T0 + DRAFT_TTL_MS + 1, store)

        expect(store.length).toBe(2)
        expect(readDraft(reply, T0 + DRAFT_TTL_MS + 1, store)).toBe('fresh')
    })

    it('drops what it cannot read', () => {
        store.setItem(key, '{not json')
        expect(readDraft(key, T0, store)).toBeNull()
        expect(store.length).toBe(0)
    })
})
