export type MaterialStatus = 'new' | 'read' | 'in_progress' | 'published' | 'rejected' | 'postponed'

export type SourceType = 'atp_wta' | 'sports_media' | 'social_media' | 'telegram'

export type LanguageCode = 'en' | 'ru' | 'es' | 'fr' | 'de' | 'it'

export interface AggregatedMaterial {
    id: string
    title: string
    content: string
    sourceUrl: string
    sourceName: string
    sourceType: SourceType
    language: LanguageCode

    parsedAt: string
    publishedAt?: string

    status: MaterialStatus

    imageUrl?: string
    tags?: string[]
    author?: string

    readAt?: string
    markedInProgressAt?: string
}

export interface MaterialFilters {
    search?: string
    sourceType?: SourceType
    language?: LanguageCode
    status?: MaterialStatus
    dateFrom?: string
    dateTo?: string
}

export interface MaterialsResponse {
    items: AggregatedMaterial[]
    total: number
    page: number
    pageSize: number
    hasMore: boolean
}

export interface UpdateMaterialStatusRequest {
    id: string
    status: MaterialStatus
}
