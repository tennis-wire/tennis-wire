import { read, write } from './api'
import type { BlockMode } from './modes'
import { readQueue } from './queue'
import type { ReportReason } from './reasons'
import type {
    Ancestry,
    Block,
    BlockPage,
    Branch,
    CommentCreated,
    CommentPage,
    Edited,
    ReactionSlot,
} from './types'

const COMMENTS = '/api/discussion/comments'
const BLOCKS = '/api/discussion/blocks'
// Top-level and reply pages alike
export const PAGE_SIZE = 20
// A row of the ignore list is one line, so a page holds more of them
const BLOCK_PAGE_SIZE = 50

function page(cursor?: string | null, size = PAGE_SIZE): string {
    const query = new URLSearchParams({ limit: String(size) })
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

// Sent again under the same key, both hand back the comment the first send wrote: 201 as before.
// The same key with another text is 422 IDEMPOTENCY_KEY_REUSED.
export function createComment(
    subjectType: string,
    subjectId: string,
    body: string,
    idempotencyKey: string
) {
    return write<CommentCreated>('POST', COMMENTS, { subjectType, subjectId, body }, idempotencyKey)
}

export function createReply(parentId: string, body: string, idempotencyKey: string) {
    return write<CommentCreated>(
        'POST',
        `${COMMENTS}/${parentId}/replies`,
        { body },
        idempotencyKey
    )
}

// No idempotency key: the same text sent twice is the same comment either way
export function editComment(id: string, body: string) {
    return write<Edited>('PATCH', `${COMMENTS}/${id}`, { body })
}

// Setting replaces whatever was in the slot, so the client never has to clear before it sets
export function setReaction(id: string, slot: ReactionSlot, value: string) {
    return write<void>('PUT', `${COMMENTS}/${id}/reactions/${slot}`, { value })
}

export function clearReaction(id: string, slot: ReactionSlot) {
    return write<void>('DELETE', `${COMMENTS}/${id}/reactions/${slot}`)
}

export function deleteComment(id: string) {
    return write<void>('DELETE', `${COMMENTS}/${id}`)
}

// Always 204 when taken: filed, already filed and taken-but-not-queued are one answer
export function reportComment(id: string, reason: ReportReason) {
    return write<void>('POST', `${COMMENTS}/${id}/reports`, { reason })
}

// Newest first
export function listBlocks(cursor?: string | null) {
    return readQueue(() => read<BlockPage>(`${BLOCKS}?${page(cursor, BLOCK_PAGE_SIZE)}`))
}

// One row: for a page that met the reader's own block and offers to change it there
export function getBlock(blockedId: string) {
    return readQueue(() => read<Block>(`${BLOCKS}/${blockedId}`))
}

// Makes the row or changes its mode: the pair is the identity. 404 USER_NOT_FOUND for someone
// user-service does not know, 409 BLOCK_LIST_FULL for a new person on a full list
export function setBlock(blockedId: string, mode: BlockMode) {
    return write<Block>('PUT', `${BLOCKS}/${blockedId}`, { mode })
}

// 204 whether the row was there or not
export function removeBlock(blockedId: string) {
    return write<void>('DELETE', `${BLOCKS}/${blockedId}`)
}
