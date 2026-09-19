// Which order this device reads comments in. Kept here rather than on the account: it is a reading
// habit, and the same person on a phone and on a laptop may well want different ones.

import type { Sort } from './types'

const KEY = 'tw-comment-sort'

export const SORTS: readonly Sort[] = ['newest', 'oldest', 'top', 'bottom']

export const DEFAULT_SORT: Sort = 'newest'

function storage(): Storage | null {
    try {
        return typeof localStorage === 'undefined' ? null : localStorage
    } catch {
        return null
    }
}

export function storedSort(store = storage()): Sort {
    const raw = store?.getItem(KEY)
    return SORTS.includes(raw as Sort) ? (raw as Sort) : DEFAULT_SORT
}

export function rememberSort(sort: Sort, store = storage()): void {
    try {
        store?.setItem(KEY, sort)
    } catch {
        // storage is unavailable in private modes: the choice lasts until the tab closes
    }
}
