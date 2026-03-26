// material type
export type ContentType = 'news' | 'article'

// content status
export type ContentStatus = 'draft' | 'published'

// ===== Tag types =====

export type TagType = 'player' | 'tournament' | 'section' | 'topic'

export interface Tag {
    id: string
    name: string
    slug: string
    type: TagType
}

// Compact tag (for lists, without id)
export interface TagCompact {
    name: string
    slug: string
    type: TagType
}

// ===== API Response types =====

// Full article response (with content)
export interface ArticleResponse {
    id: string
    type: ContentType
    status: ContentStatus
    title: string
    subtitle: string | null
    slug: string
    content: string
    coverImageUrl: string | null
    readingTime: number | null
    sourceUrl: string | null
    sourceName: string | null
    author: string | null
    tags: Tag[]
    relatedArticles: ArticleSummaryResponse[]
    aggregatorItemId: string | null
    sourceLanguage: string | null
    parsedAt: string | null
    publishedAt: string | null
    updatedAt: string
    createdAt: string
}

// Compact article response (for lists, no content)
export interface ArticleSummaryResponse {
    id: string
    type: ContentType
    status: ContentStatus
    title: string
    slug: string
    coverImageUrl: string | null
    sourceUrl: string | null
    sourceName: string | null
    author: string | null
    tags: Tag[]
    publishedAt: string | null
    updatedAt: string
    createdAt: string
}

// Publish response
export interface PublishResponse {
    id: string
    status: ContentStatus
    slug: string
    publishedAt: string
}

// ===== API Request types =====

export interface CreateArticleRequest {
    type: ContentType
    title: string
    subtitle?: string | null
    slug?: string | null
    content: string
    coverImageUrl?: string | null
    sourceUrl?: string | null
    sourceName?: string | null
    tagIds: string[]
    aggregatorItemId?: string | null
}

export interface UpdateArticleRequest {
    title?: string
    subtitle?: string | null
    slug?: string | null
    content?: string
    coverImageUrl?: string | null
    sourceUrl?: string | null
    sourceName?: string | null
    tagIds?: string[]
}

// ===== Paginated response =====

export interface PageInfo {
    number: number
    size: number
    totalElements: number
    totalPages: number
}

export interface PagedResponse<T> {
    content: T[]
    page: PageInfo
}

// ===== API Error =====

export interface ApiError {
    error: string
    message: string
    timestamp?: string
    violations?: { field: string; message: string }[]
}

// ===== Local metadata types (for UI state) =====

// base metadata (common to all types)
interface BaseMetadata {
    title: string
    slug: string
    tags: string[] // tag IDs for editing
    type: ContentType
    // optional fields
    sourceUrl?: string
    sourceName?: string
    author?: string
}

// metadata for news
export interface NewsMetadata extends BaseMetadata {
    type: 'news'
}

// metadata for articles
export interface ArticleMetadata extends BaseMetadata {
    type: 'article'
    subtitle: string
    coverImage?: string // URL or base64 of cover
}

export type ContentMetadata = NewsMetadata | ArticleMetadata

// helper for type check
export function isArticle(metadata: ContentMetadata): metadata is ArticleMetadata {
    return metadata.type === 'article'
}

export function isNews(metadata: ContentMetadata): metadata is NewsMetadata {
    return metadata.type === 'news'
}

// default data
export const defaultNewsMetadata: NewsMetadata = {
    title: '',
    slug: '',
    tags: [],
    type: 'news',
}

export const defaultArticleMetadata: ArticleMetadata = {
    title: '',
    slug: '',
    tags: [],
    type: 'article',
    subtitle: '',
    coverImage: undefined,
}

// for snackbar
export interface SnackbarState {
    open: boolean
    message: string
    severity: 'success' | 'error' | 'warning' | 'info'
}

// full content document (for local state)
export interface ContentDocument {
    id?: string
    metadata: ContentMetadata
    content: string
    status: ContentStatus
    createdAt?: string
    updatedAt?: string
    publishedAt?: string
    // for parsed content
    aggregatorItemId?: string
    originalContent?: string
}
