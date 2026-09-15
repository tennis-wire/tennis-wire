// The reader-facing wire of discussion-service, as far as this app reads it. Names match the
// service's records; see discussion-service/README.md for the semantics.

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
    // direct replies as stored: a blocking viewer may get back fewer
    replyCount: number
    // this response carries fewer direct replies than there are; read them from /replies
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
// replied to ignores him (§5.6)
export type CommentCreated = { comment: Comment; mutedByRecipient: boolean }
