// Mirrors public-web/lib/discussion/endpoints.ts. Every function gains an accessToken
// parameter that public-web's proxy route fills in from the session cookie instead: optional on
// reads (anonymous reads are allowed), required on writes and everything under /blocks (the
// ignore list only exists for a signed-in reader).

import { read, write } from './api'
import type { BlockMode } from './modes'
import { readQueue } from './queue'
import type { ReportReason } from './reasons'
import type { Ancestry, Block, BlockPage, Branch, CommentCreated, CommentPage } from './types'

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

export function listTopLevel(
    subjectType: string,
    subjectId: string,
    cursor?: string | null,
    accessToken?: string
) {
    const query = new URLSearchParams({ subjectType, subjectId })
    return readQueue(() => read<CommentPage>(`${COMMENTS}?${query}&${page(cursor)}`, accessToken))
}

export function branch(id: string, accessToken?: string) {
    return readQueue(() => read<Branch>(`${COMMENTS}/${id}/branch`, accessToken))
}

export function replies(id: string, cursor?: string | null, accessToken?: string) {
    return readQueue(() =>
        read<CommentPage>(`${COMMENTS}/${id}/replies?${page(cursor)}`, accessToken)
    )
}

export function ancestry(id: string, accessToken?: string) {
    return readQueue(() => read<Ancestry>(`${COMMENTS}/${id}/ancestry`, accessToken))
}

// Sent again under the same key, both hand back the comment the first send wrote: 201 as before.
// The same key with another text is 422 IDEMPOTENCY_KEY_REUSED.
export function createComment(
    subjectType: string,
    subjectId: string,
    body: string,
    idempotencyKey: string,
    accessToken: string
) {
    return write<CommentCreated>(
        'POST',
        COMMENTS,
        accessToken,
        { subjectType, subjectId, body },
        idempotencyKey
    )
}

export function createReply(
    parentId: string,
    body: string,
    idempotencyKey: string,
    accessToken: string
) {
    return write<CommentCreated>(
        'POST',
        `${COMMENTS}/${parentId}/replies`,
        accessToken,
        { body },
        idempotencyKey
    )
}

export function deleteComment(id: string, accessToken: string) {
    return write<void>('DELETE', `${COMMENTS}/${id}`, accessToken)
}

// Always 204 when taken: filed, already filed and taken-but-not-queued are one answer
export function reportComment(id: string, reason: ReportReason, accessToken: string) {
    return write<void>('POST', `${COMMENTS}/${id}/reports`, accessToken, { reason })
}

// Newest first
export function listBlocks(cursor: string | null | undefined, accessToken: string) {
    return readQueue(() =>
        read<BlockPage>(`${BLOCKS}?${page(cursor, BLOCK_PAGE_SIZE)}`, accessToken)
    )
}

// One row: for a page that met the reader's own block and offers to change it there
export function getBlock(blockedId: string, accessToken: string) {
    return readQueue(() => read<Block>(`${BLOCKS}/${blockedId}`, accessToken))
}

// Makes the row or changes its mode: the pair is the identity. 404 USER_NOT_FOUND for someone
// user-service does not know, 409 BLOCK_LIST_FULL for a new person on a full list
export function setBlock(blockedId: string, mode: BlockMode, accessToken: string) {
    return write<Block>('PUT', `${BLOCKS}/${blockedId}`, accessToken, { mode })
}

// 204 whether the row was there or not
export function removeBlock(blockedId: string, accessToken: string) {
    return write<void>('DELETE', `${BLOCKS}/${blockedId}`, accessToken)
}
