// The feed's filters, remembered per person in this browser. A convenience only: storage may be
// off or full, and then the feed simply starts with everything

import type { FeedQuery } from '../types/aggregator'

export type Filter = Pick<FeedQuery, 'sources' | 'languages'>

export const NO_FILTER: Filter = { sources: [], languages: [] }

function keyOf(sub: string): string {
    return `sources-filter:${sub}`
}

function strings(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

export function readFilter(sub: string): Filter {
    try {
        const saved = localStorage.getItem(keyOf(sub))
        if (!saved) return NO_FILTER
        const parsed = JSON.parse(saved) as Partial<Filter>
        return { sources: strings(parsed.sources), languages: strings(parsed.languages) }
    } catch {
        return NO_FILTER
    }
}

export function writeFilter(sub: string, filter: Filter): void {
    try {
        if (filter.sources.length === 0 && filter.languages.length === 0) {
            localStorage.removeItem(keyOf(sub))
        } else {
            localStorage.setItem(keyOf(sub), JSON.stringify(filter))
        }
    } catch {
        // remembered next time, or not at all
    }
}
