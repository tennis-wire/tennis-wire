import { useEffect, useState } from 'react'
import { tagsApi } from '../api/contentApi'
import type { Tag } from '../types/content.ts'

const DEBOUNCE_MS = 250
const PAGE_SIZE = 20

interface TagSearchState {
    options: Tag[]
    loading: boolean
    error: string | null
}

/**
 * Tag suggestions for the metadata panel, refetched as the author types.
 *
 * Every request carries an AbortSignal, because a fast typist outruns the
 * network: without it the reply for "dj" can land after the reply for "djok"
 * and put the wider list back on screen.
 *
 * `enabled` is the dropdown's open state. Tags are only fetched while the list
 * is actually visible, so opening the editor costs no request at all for the
 * authors who never touch the field.
 */
export function useTagSearch(query: string, enabled: boolean): TagSearchState {
    const [options, setOptions] = useState<Tag[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!enabled) return

        const controller = new AbortController()
        const timer = setTimeout(() => {
            setLoading(true)
            setError(null)

            tagsApi
                .list({ search: query.trim() || undefined, size: PAGE_SIZE }, controller.signal)
                .then((page) => {
                    setOptions(page.content)
                    setLoading(false)
                })
                .catch((err: unknown) => {
                    // An abort is this hook replacing its own request, not a failure.
                    if (controller.signal.aborted) return
                    setOptions([])
                    setError(err instanceof Error ? err.message : 'Не удалось загрузить теги')
                    setLoading(false)
                })
        }, DEBOUNCE_MS)

        return () => {
            clearTimeout(timer)
            controller.abort()
        }
    }, [query, enabled])

    return { options, loading, error }
}
