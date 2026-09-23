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

// ===== API types =====

// The fields that are saved: on the article itself, or on its pending edit
export interface ArticleCopy {
    title: string
    subtitle: string | null
    content: string | null
    coverImageUrl: string | null
    readingTime: number | null
    sourceUrl: string | null
    sourceName: string | null
    tags: Tag[]
}

// An article as the editor opens it. `working` is what is edited and saved. `live` is
// the site's version, present only while the caller holds a pending edit. `lockedBy`
// is set while someone else holds one: the article is then read-only for the caller.
// `version` goes back with the next save or publish.
export interface EditorialArticle {
    id: string
    type: ContentType
    status: ContentStatus
    slug: string | null
    version: string
    working: ArticleCopy
    live: ArticleCopy | null
    lockedBy: string | null
    aggregatorItemId: string | null
    publishedAt: string | null
    firstPublishedAt: string | null
    updatedAt: string
    createdAt: string
}

// A row in the caller's own lists: his drafts, and his pending edits of published articles
export interface WorkItem {
    id: string
    type: ContentType
    title: string
    // a draft that has been on the site once: its address is taken, it is not deleted
    wasPublished: boolean
    updatedAt: string
}

export interface CreateArticleRequest {
    type: ContentType
    title: string
    subtitle: string | null
    slug: string | null
    content: string
    coverImageUrl: string | null
    sourceUrl: string | null
    sourceName: string | null
    tagIds: string[]
    aggregatorItemId?: string | null
}

// The whole working copy: a field sent as null is cleared
export interface SaveArticleRequest {
    version: string
    type: ContentType
    title: string
    subtitle: string | null
    slug: string | null
    content: string
    coverImageUrl: string | null
    sourceUrl: string | null
    sourceName: string | null
    tagIds: string[]
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
    tags: Tag[]
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
    coverImage?: string // URL of the uploaded cover
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
