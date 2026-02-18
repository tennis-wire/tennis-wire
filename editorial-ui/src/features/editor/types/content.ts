// material type
export type ContentType = 'news' | 'article'

// base metadata (common to all types)
interface BaseMetadata {
    title: string
    slug: string
    tags: string[]
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

// TODO: needs to check
export type ContentStatus = 'draft' | 'published'

// TODO: needs to check
// full content model (to save the publication)
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
