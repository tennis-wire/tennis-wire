import { read } from './api'
import { readQueue } from './queue'
import type { Ancestry, Branch, CommentPage } from './types'

const COMMENTS = '/api/discussion/comments'
// Top-level and reply pages alike (discussion-rules §3.4)
export const PAGE_SIZE = 20

function page(cursor?: string | null): string {
    const query = new URLSearchParams({ limit: String(PAGE_SIZE) })
    if (cursor) query.set('cursor', cursor)
    return query.toString()
}

export function listTopLevel(subjectType: string, subjectId: string, cursor?: string | null) {
    const query = new URLSearchParams({ subjectType, subjectId })
    return readQueue(() => read<CommentPage>(`${COMMENTS}?${query}&${page(cursor)}`))
}

export function branch(id: string) {
    return readQueue(() => read<Branch>(`${COMMENTS}/${id}/branch`))
}

export function replies(id: string, cursor?: string | null) {
    return readQueue(() => read<CommentPage>(`${COMMENTS}/${id}/replies?${page(cursor)}`))
}

export function ancestry(id: string) {
    return readQueue(() => read<Ancestry>(`${COMMENTS}/${id}/ancestry`))
}
