// What the reader typed and did not send, kept on the device: one entry per article
// and per reply form, keyed by the reader too, so that the next person at the same computer does
// not see it, and the same reader gets it back after signing in again.

const PREFIX = 'tw-draft:'
export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000

type Stored = { text: string; savedAt: number }

// localStorage is unavailable in private modes and in the SSR pass; then there is no draft
function storage(): Storage | null {
    try {
        return typeof localStorage === 'undefined' ? null : localStorage
    } catch {
        return null
    }
}

export function draftKey(userId: string, subjectId: string, parentId: string | null): string {
    return `${PREFIX}${userId}:${subjectId}:${parentId ?? 'top'}`
}

export function readDraft(key: string, now = Date.now(), store = storage()): string | null {
    const raw = store?.getItem(key)
    if (!raw) return null
    try {
        const stored = JSON.parse(raw) as Stored
        if (now - stored.savedAt > DRAFT_TTL_MS) {
            store?.removeItem(key)
            return null
        }
        return stored.text
    } catch {
        store?.removeItem(key)
        return null
    }
}

// An emptied field is a cleared draft
export function saveDraft(key: string, text: string, now = Date.now(), store = storage()): void {
    try {
        if (text.trim() === '') store?.removeItem(key)
        else store?.setItem(key, JSON.stringify({ text, savedAt: now } satisfies Stored))
    } catch {
        // full or refused: the draft is a convenience, the comment is what was typed
    }
}

export function clearDraft(key: string, store = storage()): void {
    store?.removeItem(key)
}

// On the way out: nothing of this reader stays behind
export function clearDraftsOf(userId: string, store = storage()): void {
    if (!store) return
    const mine = `${PREFIX}${userId}:`
    const keys: string[] = []
    for (let index = 0; index < store.length; index += 1) {
        const key = store.key(index)
        if (key?.startsWith(mine)) keys.push(key)
    }
    for (const key of keys) store.removeItem(key)
}

// Expired drafts are dropped when met; this sweeps the ones nobody comes back to
export function sweepDrafts(now = Date.now(), store = storage()): void {
    if (!store) return
    const keys: string[] = []
    for (let index = 0; index < store.length; index += 1) {
        const key = store.key(index)
        if (key?.startsWith(PREFIX)) keys.push(key)
    }
    for (const key of keys) readDraft(key, now, store)
}
