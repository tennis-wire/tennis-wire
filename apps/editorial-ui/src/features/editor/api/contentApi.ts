// Content Service API client
// All requests go through API Gateway

import { CONTENT_API } from './apiConfig'
import type {
    ArticleResponse,
    ArticleSummaryResponse,
    PublishResponse,
    CreateArticleRequest,
    UpdateArticleRequest,
    PagedResponse,
    Tag,
    ApiError,
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

export const articlesApi = {
    /**
     * Create a new draft article
     */
    async create(data: CreateArticleRequest): Promise<ArticleResponse> {
        const response = await fetch(`${CONTENT_API}/articles`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        })
        return handleResponse<ArticleResponse>(response)
    },

    /**
     * Get article by ID (full, with content)
     */
    async getById(id: string): Promise<ArticleResponse> {
        const response = await fetch(`${CONTENT_API}/articles/${id}`)
        return handleResponse<ArticleResponse>(response)
    },

    /**
     * List articles (drafts + published)
     */
    async list(params?: {
        type?: 'news' | 'article'
        status?: 'draft' | 'published'
        search?: string
        page?: number
        size?: number
    }): Promise<PagedResponse<ArticleSummaryResponse>> {
        const searchParams = new URLSearchParams()
        if (params?.type) searchParams.set('type', params.type)
        if (params?.status) searchParams.set('status', params.status)
        if (params?.search) searchParams.set('search', params.search)
        if (params?.page !== undefined) searchParams.set('page', String(params.page))
        if (params?.size !== undefined) searchParams.set('size', String(params.size))

        const url = `${CONTENT_API}/articles${searchParams.toString() ? `?${searchParams}` : ''}`
        const response = await fetch(url)
        return handleResponse<PagedResponse<ArticleSummaryResponse>>(response)
    },

    /**
     * Partial update article
     */
    async update(id: string, data: UpdateArticleRequest): Promise<ArticleResponse> {
        const response = await fetch(`${CONTENT_API}/articles/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        })
        return handleResponse<ArticleResponse>(response)
    },

    /**
     * Delete draft article
     */
    async delete(id: string): Promise<void> {
        const response = await fetch(`${CONTENT_API}/articles/${id}`, {
            method: 'DELETE',
        })
        return handleResponse<void>(response)
    },

    /**
     * Publish article
     */
    async publish(id: string): Promise<PublishResponse> {
        const response = await fetch(`${CONTENT_API}/articles/${id}/publish`, {
            method: 'POST',
        })
        return handleResponse<PublishResponse>(response)
    },

    /**
     * Unpublish article (back to draft)
     */
    async unpublish(id: string): Promise<ArticleResponse> {
        const response = await fetch(`${CONTENT_API}/articles/${id}/unpublish`, {
            method: 'POST',
        })
        return handleResponse<ArticleResponse>(response)
    },
}

// ===== Tags API =====

export const tagsApi = {
    /**
     * List tags
     */
    async list(params?: {
        type?: string
        search?: string
        page?: number
        size?: number
    }): Promise<PagedResponse<Tag>> {
        const searchParams = new URLSearchParams()
        if (params?.type) searchParams.set('type', params.type)
        if (params?.search) searchParams.set('search', params.search)
        if (params?.page !== undefined) searchParams.set('page', String(params.page))
        if (params?.size !== undefined) searchParams.set('size', String(params.size))

        const url = `${CONTENT_API}/tags${searchParams.toString() ? `?${searchParams}` : ''}`
        const response = await fetch(url)
        return handleResponse<PagedResponse<Tag>>(response)
    },

    /**
     * Create tag
     */
    async create(data: { name: string; slug?: string; type: string }): Promise<Tag> {
        const response = await fetch(`${CONTENT_API}/tags`, {
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
        const response = await fetch(`${CONTENT_API}/tags/${id}`, {
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
        const response = await fetch(`${CONTENT_API}/tags/${id}`, {
            method: 'DELETE',
        })
        return handleResponse<void>(response)
    },
}
