// Mirrors public-web/lib/discussion/drafts.ts. localStorage is sync; AsyncStorage is not, so
// every function here returns a Promise where the web version returns a value directly. The
// store is injected the same way web injects Storage, just with an async shape, so a fake
// in-memory store can stand in under vitest without touching the real native module.

import AsyncStorage from '@react-native-async-storage/async-storage'

const PREFIX = 'tw-draft:'
export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000

type Stored = { text: string; savedAt: number }

export type AsyncStore = {
    getItem(key: string): Promise<string | null>
    setItem(key: string, value: string): Promise<void>
    removeItem(key: string): Promise<void>
    getAllKeys(): Promise<readonly string[]>
    multiRemove(keys: string[]): Promise<void>
}

export function draftKey(userId: string, subjectId: string, parentId: string | null): string {
    return `${PREFIX}${userId}:${subjectId}:${parentId ?? 'top'}`
}

export async function readDraft(
    key: string,
    now = Date.now(),
    store: AsyncStore = AsyncStorage
): Promise<string | null> {
    let raw: string | null
    try {
        raw = await store.getItem(key)
    } catch {
        return null
    }
    if (!raw) return null
    try {
        const stored = JSON.parse(raw) as Stored
        if (now - stored.savedAt > DRAFT_TTL_MS) {
            await store.removeItem(key).catch(() => {})
            return null
        }
        return stored.text
    } catch {
        await store.removeItem(key).catch(() => {})
        return null
    }
}

// An emptied field is a cleared draft
export async function saveDraft(
    key: string,
    text: string,
    now = Date.now(),
    store: AsyncStore = AsyncStorage
): Promise<void> {
    try {
        if (text.trim() === '') await store.removeItem(key)
        else await store.setItem(key, JSON.stringify({ text, savedAt: now } satisfies Stored))
    } catch {
        // full or refused: the draft is a convenience, the comment is what was typed
    }
}

export async function clearDraft(key: string, store: AsyncStore = AsyncStorage): Promise<void> {
    try {
        await store.removeItem(key)
    } catch {
        // nothing to clean up
    }
}

// On the way out: nothing of this reader stays behind
export async function clearDraftsOf(
    userId: string,
    store: AsyncStore = AsyncStorage
): Promise<void> {
    try {
        const mine = `${PREFIX}${userId}:`
        const keys = (await store.getAllKeys()).filter((key) => key.startsWith(mine))
        if (keys.length) await store.multiRemove(keys as string[])
    } catch {
        // best-effort cleanup
    }
}

// Expired drafts are dropped when met; this sweeps the ones nobody comes back to
export async function sweepDrafts(
    now = Date.now(),
    store: AsyncStore = AsyncStorage
): Promise<void> {
    try {
        const keys = (await store.getAllKeys()).filter((key) => key.startsWith(PREFIX))
        await Promise.all(keys.map((key) => readDraft(key, now, store)))
    } catch {
        // best effort
    }
}
