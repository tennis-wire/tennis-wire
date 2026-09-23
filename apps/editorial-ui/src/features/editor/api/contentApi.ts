// Content Service API client
// All requests go through API Gateway

import { apiFetch } from '../../../api/apiFetch'
import type {
    CreateArticleRequest,
    EditorialArticle,
    PagedResponse,
    SaveArticleRequest,
    Tag,
    ApiError,
    WorkItem,
} from '../types/content'

// ===== Error handling =====

export class ContentApiError extends Error {
    status: number
    errorCode: string
    violations?: { field: string; message: string }[]

    constructor(
        status: number,
        errorCode: string,
        message: string,
        violations?: { field: string; message: string }[]
    ) {
        super(message)
        this.name = 'ContentApiError'
        this.status = status
        this.errorCode = errorCode
        this.violations = violations
    }
}

async function handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        const error: ApiError = await response.json().catch(() => ({
            error: 'UNKNOWN_ERROR',
            message: `HTTP ${response.status}`,
        }))
        throw new ContentApiError(response.status, error.error, error.message, error.violations)
    }
    // Handle 204 No Content
    if (response.status === 204) {
        return undefined as T
    }
    return response.json()
}

// ===== Articles API =====

const ARTICLES = '/api/editorial/articles'

function sendJson(method: string, body: unknown): RequestInit {
    return {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    }
}

export const articlesApi = {
    async create(data: CreateArticleRequest): Promise<EditorialArticle> {
        const response = await apiFetch(ARTICLES, sendJson('POST', data))
        return handleResponse<EditorialArticle>(response)
    },

    // The caller's own drafts, most recently saved first
    async drafts(
        params: { search?: string; page?: number; size?: number },
        signal?: AbortSignal
    ): Promise<PagedResponse<WorkItem>> {
        const query = new URLSearchParams()
        if (params.search) query.set('search', params.search)
        if (params.page !== undefined) query.set('page', String(params.page))
        if (params.size !== undefined) query.set('size', String(params.size))
        const response = await apiFetch(`${ARTICLES}?${query}`, { signal })
        return handleResponse<PagedResponse<WorkItem>>(response)
    },

    // The caller's pending edits of published articles
    async edits(
        params: { page?: number; size?: number },
        signal?: AbortSignal
    ): Promise<PagedResponse<WorkItem>> {
        const query = new URLSearchParams()
        if (params.page !== undefined) query.set('page', String(params.page))
        if (params.size !== undefined) query.set('size', String(params.size))
        const response = await apiFetch(`${ARTICLES}/edits?${query}`, { signal })
        return handleResponse<PagedResponse<WorkItem>>(response)
    },

    // "Open by link": the address a published article has on the site
    async getBySlug(slug: string): Promise<EditorialArticle> {
        const response = await apiFetch(`${ARTICLES}/by-slug/${encodeURIComponent(slug)}`)
        return handleResponse<EditorialArticle>(response)
    },

    async get(id: string): Promise<EditorialArticle> {
        const response = await apiFetch(`${ARTICLES}/${encodeURIComponent(id)}`)
        return handleResponse<EditorialArticle>(response)
    },

    // A draft is saved in place; a published article gets its pending edit created or updated
    async save(id: string, data: SaveArticleRequest): Promise<EditorialArticle> {
        const response = await apiFetch(`${ARTICLES}/${id}`, sendJson('PUT', data))
        return handleResponse<EditorialArticle>(response)
    },

    // A draft goes on the site; for a published article, the caller's pending edit does
    async publish(id: string, version: string): Promise<EditorialArticle> {
        const response = await apiFetch(`${ARTICLES}/${id}/publish`, sendJson('POST', { version }))
        return handleResponse<EditorialArticle>(response)
    },

    // The holder drops his own edit; a chief editor resets anyone's
    async discardEdit(id: string): Promise<void> {
        const response = await apiFetch(`${ARTICLES}/${id}/edit`, { method: 'DELETE' })
        return handleResponse<void>(response)
    },

    async delete(id: string): Promise<void> {
        const response = await apiFetch(`${ARTICLES}/${id}`, { method: 'DELETE' })
        return handleResponse<void>(response)
    },
}

// ===== Tags API =====

export const tagsApi = {
    /**
     * List tags
     */
    async list(
        params?: {
            type?: string
            search?: string
            page?: number
            size?: number
        },
        signal?: AbortSignal
    ): Promise<PagedResponse<Tag>> {
        const searchParams = new URLSearchParams()
        if (params?.type) searchParams.set('type', params.type)
        if (params?.search) searchParams.set('search', params.search)
        if (params?.page !== undefined) searchParams.set('page', String(params.page))
        if (params?.size !== undefined) searchParams.set('size', String(params.size))

        const url = `/api/editorial/tags${searchParams.toString() ? `?${searchParams}` : ''}`
        const response = await apiFetch(url, { signal })
        return handleResponse<PagedResponse<Tag>>(response)
    },

    /**
     * Create tag
     */
    async create(data: { name: string; slug?: string; type: string }): Promise<Tag> {
        const response = await apiFetch('/api/editorial/tags', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        })
        return handleResponse<Tag>(response)
    },

    /**
     * Update tag
     */
    async update(id: string, data: { name?: string; slug?: string }): Promise<Tag> {
        const response = await apiFetch(`/api/editorial/tags/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        })
        return handleResponse<Tag>(response)
    },

    /**
     * Delete tag
     */
    async delete(id: string): Promise<void> {
        const response = await apiFetch(`/api/editorial/tags/${id}`, {
            method: 'DELETE',
        })
        return handleResponse<void>(response)
    },
}
