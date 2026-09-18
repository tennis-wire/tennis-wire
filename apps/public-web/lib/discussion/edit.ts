import { DiscussionError, NetworkError } from './api'
import type { Comment } from './types'

// discussion.comment.edit-window in the service. Kept here so the item disappears by itself; the
// service checks the same thing, and a clock that has drifted meets a 403 rather than a silent pass.
export const EDIT_WINDOW_MS = 15 * 60 * 1000

export function canEdit(comment: Comment, now: number = Date.now()): boolean {
    if (comment.visibility !== 'visible' && comment.visibility !== 'soft_hidden') return false
    return now < new Date(comment.createdAt).getTime() + EDIT_WINDOW_MS
}

export type EditFailure =
    | { kind: 'network' }
    | { kind: 'rate' }
    // the window closed while the form was open
    | { kind: 'late' }
    // the comment went down meanwhile, by another device or by moderation
    | { kind: 'deleted' }
    | { kind: 'removed' }
    | { kind: 'other'; message: string }

export function editFailure(error: unknown): EditFailure {
    if (error instanceof NetworkError) return { kind: 'network' }
    if (error instanceof DiscussionError) {
        if (error.status === 429) return { kind: 'rate' }
        if (error.code === 'EDIT_WINDOW_CLOSED') return { kind: 'late' }
        // 404 too: the comment had no replies to hold it up and went altogether
        if (error.code === 'COMMENT_DELETED' || error.status === 404) return { kind: 'deleted' }
        if (error.code === 'COMMENT_ALREADY_REMOVED') return { kind: 'removed' }
        if (error.status >= 500 || error.code === 'GATEWAY_UNAVAILABLE') return { kind: 'network' }
        return { kind: 'other', message: error.message }
    }
    return { kind: 'network' }
}
