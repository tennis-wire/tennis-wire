// Which comments this device has reported, so the menu item can say so and stay put.
// The server keeps no such thing the reader could ask for: who reported is not stored.

const KEY = 'tw-reported'
// ids kept; the oldest go first once past this
const KEEP = 500

function storage(): Storage | null {
    try {
        return typeof localStorage === 'undefined' ? null : localStorage
    } catch {
        return null
    }
}

function load(store: Storage | null): string[] {
    const raw = store?.getItem(KEY)
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

export function wasReported(id: string, store = storage()): boolean {
    return load(store).includes(id)
}

export function markReported(id: string, store = storage()): void {
    if (!store) return
    const ids = load(store).filter((known) => known !== id)
    ids.push(id)
    try {
        store.setItem(KEY, JSON.stringify(ids.slice(-KEEP)))
    } catch {
        // full or refused: the report went through, only the greying-out is lost
    }
}
