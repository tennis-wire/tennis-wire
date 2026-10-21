import { useCallback, useEffect, useState } from 'react'

import { aggregatorApi, messageOf } from '../api/aggregatorApi'
import type { FeedQuery, ItemCard } from '../types/aggregator'

export const PAGE_SIZE = 50

interface Shown {
    key: string
    items: ItemCard[]
    next: string | null
}

// The feed from the top for this query, then page by page down the cursor. Pages already shown
// stay as they are: what arrives meanwhile lands above the first and waits for a refresh
export function useFeed(query: FeedQuery, reloads: number) {
    const key = JSON.stringify([query, reloads])
    const [shown, setShown] = useState<Shown | null>(null)
    const [failed, setFailed] = useState<{ key: string; message: string } | null>(null)
    const [moreBusy, setMoreBusy] = useState(false)

    useEffect(() => {
        const controller = new AbortController()
        aggregatorApi.feed(query, null, PAGE_SIZE, controller.signal).then(
            (page) => setShown({ key, items: page.items, next: page.nextCursor }),
            (failure: unknown) => {
                if (!controller.signal.aborted) setFailed({ key, message: messageOf(failure) })
            }
        )
        return () => controller.abort()
    }, [query, key])

    const current = shown?.key === key
    const loadMore = useCallback(() => {
        if (!current || shown.next === null || moreBusy) return
        setMoreBusy(true)
        aggregatorApi
            .feed(query, shown.next, PAGE_SIZE)
            .then((page) =>
                setShown((before) => {
                    if (before?.key !== key) return before
                    const known = new Set(before.items.map((item) => item.id))
                    const fresh = page.items.filter((item) => !known.has(item.id))
                    return { key, items: [...before.items, ...fresh], next: page.nextCursor }
                })
            )
            .catch((failure: unknown) => setFailed({ key, message: messageOf(failure) }))
            .finally(() => setMoreBusy(false))
    }, [current, shown, moreBusy, query, key])

    return {
        // the previous answer stays on screen while the next one is on its way
        items: shown?.items ?? [],
        loading: !current && failed?.key !== key,
        loaded: current,
        hasMore: current && shown.next !== null,
        moreBusy,
        error: failed?.key === key ? failed.message : null,
        loadMore,
    }
}
