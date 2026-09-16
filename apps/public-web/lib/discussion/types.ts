// The reader-facing wire of discussion-service, as far as this app reads it. Names match the
// service's records, and so do their meanings.

import type { BlockMode } from './modes'

export type Visibility = 'visible' | 'soft_hidden' | 'gravestone' | 'deleted' | 'removed'

export type Author =
    | { id: string; displayName: string; avatarUrl: string | null }
    // an author under a commenting restriction: no name, the client picks the word
    | { id: string; restricted: true }

export type Comment = {
    id: string
    subjectType: string
    subjectId: string
    inReplyToId: string | null
    rootId: string
    // missing when the visibility withholds it, and when user-service has no profile
    author?: Author
    // missing when the visibility withholds it
    body?: string
    visibility: Visibility
    // direct replies this reader gets: the ones his own "remove with branches" takes out are not
    // counted
    replyCount: number
    // this response carries fewer direct replies than the reader gets; read them from /replies
    repliesTruncated: boolean
    createdAt: string
    updatedAt: string
    // empty on a listing and on an ancestry chain, nested on a branch
    replies: Comment[]
}

export type CommentPage = { items: Comment[]; nextCursor: string | null }
export type Branch = { root: Comment }
export type Ancestry = { chain: Comment[] }

// What a POST answers: the comment as its author sees it, and whether the author of the comment
// replied to ignores him
export type CommentCreated = { comment: Comment; mutedByRecipient: boolean }

// A row of the reader's own ignore list. `user` takes the forms an author does and is missing when
// user-service has no profile; `blockedId` is always there, so the row can still be lifted
export type Block = { blockedId: string; user?: Author; mode: BlockMode; createdAt: string }
export type BlockPage = { items: Block[]; nextCursor: string | null }
