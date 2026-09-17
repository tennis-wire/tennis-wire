// Mirrors public-web/lib/discussion/reported.ts, async over AsyncStorage for the same reason
// drafts.ts is: localStorage is sync, AsyncStorage is not.

import AsyncStorage from '@react-native-async-storage/async-storage'

import type { AsyncStore } from './drafts'

const KEY = 'tw-reported'
// ids kept; the oldest go first once past this
const KEEP = 500

async function load(store: AsyncStore): Promise<string[]> {
    let raw: string | null
    try {
        raw = await store.getItem(KEY)
    } catch {
        return []
    }
    if (!raw) return []
    try {
        const parsed: unknown = JSON.parse(raw)
        return Array.isArray(parsed)
            ? parsed.filter((id): id is string => typeof id === 'string')
            : []
    } catch {
        return []
    }
}

export async function wasReported(id: string, store: AsyncStore = AsyncStorage): Promise<boolean> {
    return (await load(store)).includes(id)
}

export async function markReported(id: string, store: AsyncStore = AsyncStorage): Promise<void> {
    const ids = (await load(store)).filter((known) => known !== id)
    ids.push(id)
    try {
        await store.setItem(KEY, JSON.stringify(ids.slice(-KEEP)))
    } catch {
        // full or refused: the report went through, only the greying-out is lost
    }
}
