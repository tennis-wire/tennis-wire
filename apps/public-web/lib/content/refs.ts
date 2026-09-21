// Naming the article a comment stands under, from the ids comments carry. Read through the BFF
// from the browser, unlike the article itself, which is read on the server.

import { read } from '@/lib/discussion/api'
import { readQueue } from '@/lib/discussion/queue'
import type { Comment } from '@/lib/discussion/types'

import type { ArticleType } from './articles'

export type ArticleRef = { id: string; type: ArticleType; slug: string; title: string }

// null: asked about and not there, unpublished or never published
export type Refs = ReadonlyMap<string, ArticleRef | null>

const SUBJECT = 'publication'
const BY_IDS = '/api/public/articles/by-ids'

export function articleHref(ref: ArticleRef): string {
    return `${ref.type === 'news' ? '/news' : '/materials'}/${ref.slug}`
}

export function unresolved(comments: Comment[], known: Refs): string[] {
    const ids = new Set<string>()
    for (const comment of comments) {
        if (comment.subjectType === SUBJECT && !known.has(comment.subjectId)) {
            ids.add(comment.subjectId)
        }
    }
    return [...ids]
}

export function resolved(known: Refs, asked: string[], found: ArticleRef[]): Refs {
    const next = new Map(known)
    for (const id of asked) next.set(id, null)
    for (const ref of found) next.set(ref.id, ref)
    return next
}

// Commas left as they are: every id costs the request line 37 bytes and not 39
export async function resolveRefs(comments: Comment[], known: Refs): Promise<Refs> {
    const asked = unresolved(comments, known)
    if (asked.length === 0) return known
    const found = await readQueue(() => read<ArticleRef[]>(`${BY_IDS}?ids=${asked.join(',')}`))
    return resolved(known, asked, found)
}
