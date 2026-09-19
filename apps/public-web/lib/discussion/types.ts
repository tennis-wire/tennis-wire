// The reader-facing wire of discussion-service, as far as this app reads it. Names match the
// service's records, and so do their meanings.

import type { BlockMode } from './modes'

export type Visibility = 'visible' | 'soft_hidden' | 'gravestone' | 'deleted' | 'removed'

export type Vote = 'like' | 'dislike'
// The two independent slots a reader fills on one comment
export type ReactionSlot = 'vote' | 'emoji'

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
    // the author rewrote the text: updatedAt is when he last did
    edited: boolean
    likeCount: number
    dislikeCount: number
    // only the keys with a count; a key the set no longer holds simply stops arriving
    emojiCounts: Record<string, number>
    // what this reader put here, missing when he put nothing or is not signed in
    viewerVote?: Vote
    viewerEmoji?: string
    // empty on a listing and on an ancestry chain, nested on a branch
    replies: Comment[]
}

// until: null for a restriction with no end
export type Restriction = { until: string | null }

// The reader's own standing, sent with the reads that open a thread: the listing and the chain a link
// leads to. Missing for someone not signed in; restriction is null when nothing stops him writing.
export type Viewer = { restriction: Restriction | null }

export type CommentPage = { items: Comment[]; nextCursor: string | null; viewer?: Viewer }
export type Branch = { root: Comment }
export type Ancestry = { chain: Comment[]; viewer?: Viewer }

// What a PATCH answers: only the fields an edit moves
export type Edited = { id: string; body: string; updatedAt: string; edited: boolean }

// What a POST answers: the comment as its author sees it, and whether the author of the comment
// replied to ignores him
export type CommentCreated = { comment: Comment; mutedByRecipient: boolean }

// A row of the reader's own ignore list. `user` takes the forms an author does and is missing when
// user-service has no profile; `blockedId` is always there, so the row can still be lifted
export type Block = { blockedId: string; user?: Author; mode: BlockMode; createdAt: string }
export type BlockPage = { items: Block[]; nextCursor: string | null }
