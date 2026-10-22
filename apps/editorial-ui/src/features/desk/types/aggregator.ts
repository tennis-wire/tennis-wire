// What aggregator-service answers on /api/aggregator/** (architecture/aggregator.md 5.2)

export type Extraction = 'ok' | 'failed' | 'skipped'

// A card of the feed: no text, the panel asks for the item whole
export interface ItemCard {
    id: string
    source: string
    language: string
    title: string
    titleBefore: string | null
    lead: string | null
    publishedAt: string | null
    arrivedAt: string
    extraction: Extraction
    hasEmbeds: boolean
}

export interface ItemPage {
    items: ItemCard[]
    // null on the last page
    nextCursor: string | null
}

export interface Item {
    id: string
    url: string
    source: string
    language: string
    title: string
    titleBefore: string | null
    lead: string | null
    // Markdown from a foreign site
    text: string | null
    author: string | null
    imageUrl: string | null
    publishedAt: string | null
    arrivedAt: string
    categories: string[]
    embeds: string[]
    extraction: Extraction
}

export type ProblemKind = 'blocked' | 'failing' | 'extraction' | 'quiet'

// The collector's own judgement of a source (aggregator.md 4.11), kept as it came
export interface HealthSnapshot {
    problems: { kind: ProblemKind | string; detail: string | null }[]
    lastRunAt: string | null
    lastStatus: string | null
    lastOkAt: string | null
    lastNewAt: string | null
    failuresInRow: number
    blockedSince: string | null
    blockKind: string | null
}

export interface Source {
    key: string
    name: string
    language: string
    siteUrl: string
    // Gone from the collector's list; its items live out their term
    retired: boolean
    health: HealthSnapshot | null
    // When the collector last sent a snapshot
    healthAt: string | null
}

export interface FeedQuery {
    sources: string[]
    languages: string[]
    search: string
}
