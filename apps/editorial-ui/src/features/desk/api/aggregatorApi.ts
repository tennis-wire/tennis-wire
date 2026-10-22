// The newsroom's side of aggregator-service. Everything goes through the gateway, as the rest does.

import { apiFetch } from '../../../api/apiFetch'
import type { FeedQuery, Item, ItemPage, Source } from '../types/aggregator'

const BASE = '/api/aggregator'

export class AggregatorApiError extends Error {
    status: number
    errorCode: string

    constructor(status: number, errorCode: string, message: string) {
        super(message)
        this.name = 'AggregatorApiError'
        this.status = status
        this.errorCode = errorCode
    }
}

async function read<T>(response: Response): Promise<T> {
    if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
            error?: string
            message?: string
        } | null
        throw new AggregatorApiError(
            response.status,
            body?.error ?? 'UNKNOWN_ERROR',
            body?.message ?? `HTTP ${response.status}`
        )
    }
    if (response.status === 204) return undefined as T
    return (await response.json()) as T
}

export const aggregatorApi = {
    // Newest arrival first; the cursor is the previous page's nextCursor
    async feed(
        query: FeedQuery,
        cursor: string | null,
        limit: number,
        signal?: AbortSignal
    ): Promise<ItemPage> {
        const params = new URLSearchParams()
        query.sources.forEach((source) => params.append('source', source))
        query.languages.forEach((language) => params.append('language', language))
        if (query.search.trim()) params.set('search', query.search.trim())
        if (cursor !== null) params.set('cursor', cursor)
        params.set('limit', String(limit))
        return read<ItemPage>(await apiFetch(`${BASE}/items?${params}`, { signal }))
    },

    async item(id: string, signal?: AbortSignal): Promise<Item> {
        return read<Item>(await apiFetch(`${BASE}/items/${encodeURIComponent(id)}`, { signal }))
    },

    // Gone for everyone; an item already gone is no error
    async remove(id: string): Promise<void> {
        const response = await apiFetch(`${BASE}/items/${encodeURIComponent(id)}`, {
            method: 'DELETE',
        })
        return read<void>(response)
    },

    async sources(signal?: AbortSignal): Promise<Source[]> {
        return read<Source[]>(await apiFetch(`${BASE}/sources`, { signal }))
    },
}

export function messageOf(error: unknown): string {
    if (error instanceof AggregatorApiError) {
        if (error.status === 403) return 'Ленту источников видят только авторы.'
        if (error.status === 404) return 'Новости уже нет: её удалили или истёк срок.'
        if (error.status === 400) return 'Лента не поняла запрос. Обновите страницу.'
        return 'Агрегатор не ответил. Попробуйте обновить.'
    }
    return 'Не удалось связаться с сервером.'
}
