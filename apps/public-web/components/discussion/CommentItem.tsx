'use client'

import Link from 'next/link'

import Avatar from '@/components/Avatar'
import { useReaderSession } from '@/components/auth/ReaderSessionProvider'
import { loginHere } from '@/lib/auth/loginHref'
import { canEdit } from '@/lib/discussion/edit'
import type { BlockMode } from '@/lib/discussion/modes'
import type { ReportReason } from '@/lib/discussion/reasons'
import type { Node } from '@/lib/discussion/tree'
import type { Author, Comment, ReactionSlot, Restriction } from '@/lib/discussion/types'

import CommentBody, { Placeholder, placeholderFor } from './CommentBody'
import CommentMenu from './CommentMenu'
import ComposeForm from './ComposeForm'
import EditForm from './EditForm'
import ReactionBar from './ReactionBar'
import RestrictionPlate from './RestrictionPlate'
import { formatWhen } from './format'
import { strings } from './strings'
import { action, blankFace, linkButton, muted, signInLink } from './styles'

// What every comment on the page shares: who is reading, what is open, and the handlers
export type Ctx = {
    highlight: string | null
    replyingTo: string | null
    mutedUnder: string | null
    // the reader's draft key for a form under this comment, or null when none can be kept
    draftKeyFor: (parentId: string) => string | null
    signedIn: boolean
    // what stops the reader writing, known with the page: "Reply" opens the plate instead of a form
    restriction: Restriction | null
    // the reader's own id, to tell his comments from the rest; null while unknown
    userId: string | null
    onShowReplies: (id: string) => void
    onMoreReplies: (id: string, cursor: string | null | undefined) => void
    onReveal: (id: string) => void
    onReroot: (id: string) => void
    onOpenReply: (id: string) => void
    onCloseReply: () => void
    onReply: (
        parentId: string,
        body: string,
        inline: boolean,
        idempotencyKey: string
    ) => Promise<void>
    onPromote: (text: string) => void
    onSessionExpired: () => void
    onRemove: (id: string) => Promise<void>
    // which comment has its edit form open, and the three handlers around it
    editing: string | null
    onOpenEdit: (id: string) => void
    onCloseEdit: () => void
    onEdit: (id: string, body: string) => Promise<void>
    onReact: (comment: Comment, slot: ReactionSlot, to: string | null) => void
    onReport: (id: string, reason: ReportReason) => Promise<void>
    onIgnore: (commentId: string, authorId: string, mode: BlockMode) => Promise<void>
    onUnignore: (authorId: string) => Promise<void>
}

type Props = {
    node: Node
    // whether the direct replies are drawn under this comment. Where they are not, the reader
    // gets there by re-rooting on it: the first level inline, deeper by re-root
    inline: boolean
    ctx: Ctx
}

// No rule between comments: the space above each one and the thread down the rail keep them
// apart. A reply sits closer to its parent than one comment to the next.
const card = (top: number): React.CSSProperties => ({ paddingTop: top })

const highlighted = (top: number): React.CSSProperties => ({
    background: 'color-mix(in srgb, var(--tw-accent-soft) 35%, transparent)',
    margin: '0 -12px',
    padding: `${top}px 12px 12px`,
    borderRadius: 6,
})

// A comment is a rail and a column: the author's circle on the left, everything he wrote on the
// right. Where replies are drawn under it, a thread runs down the rail past them, so the eye can
// tell a reply to this comment from the next comment along.
const row: React.CSSProperties = {
    display: 'flex',
    gap: 12,
    alignItems: 'stretch',
}

const rail: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    flexShrink: 0,
}

const thread: React.CSSProperties = {
    flex: 1,
    width: 2,
    marginTop: 8,
    borderRadius: 1,
    background: 'var(--tw-border)',
}

const column: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
}

const byline: React.CSSProperties = {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    minHeight: 24,
}

const notice: React.CSSProperties = {
    margin: '8px 0 0',
    padding: '6px 10px',
    borderRadius: 6,
    background: 'var(--tw-bg-alt)',
    fontSize: 13,
}

const name: React.CSSProperties = {
    fontWeight: 600,
    fontSize: 15,
    color: 'var(--tw-text)',
}

// The name leads to the reader's page, one's own to the cabinet. No link for a restricted author:
// he has no page, and none for someone user-service does not know.
export function AuthorName({ author }: { author?: Author }) {
    const { session } = useReaderSession()
    if (!author) return <span style={name}>{strings.nobody}</span>
    // the label stands instead of the name, and the server sends no name at all
    if ('restricted' in author)
        return <span style={{ ...name, color: 'var(--tw-text-muted)' }}>{strings.restricted}</span>
    const own = session?.authenticated === true && session.userId === author.id
    return (
        <Link href={own ? '/me' : `/u/${author.id}`} style={{ ...name, textDecoration: 'none' }}>
            {author.displayName}
        </Link>
    )
}

// The same circle the header draws, and the same emptiness where there is no author
function authorFace(author?: Author) {
    if (!author || 'restricted' in author) return <Avatar size={36} />
    return <Avatar name={author.displayName} src={author.avatarUrl} size={36} />
}

function elementId(comment: Comment) {
    return `comment-${comment.id}`
}

export default function CommentItem({ node, inline, ctx }: Props) {
    const { comment } = node
    const collapsed = comment.visibility === 'soft_hidden' && !node.revealed
    // a live comment: the one kind that takes a reply
    const readable =
        comment.visibility === 'visible' || (comment.visibility === 'soft_hidden' && node.revealed)
    const replying = ctx.replyingTo === comment.id
    const own = ctx.userId !== null && comment.author?.id === ctx.userId
    const editing = ctx.editing === comment.id
    // a line down to a button would say there is a thread where there is only an offer to load one
    const threaded = (replying && readable && ctx.signedIn) || (node.replies?.length ?? 0) > 0
    const top = inline ? 18 : 14

    return (
        <div
            id={elementId(comment)}
            style={ctx.highlight === comment.id ? highlighted(top) : card(top)}
        >
            <div style={row}>
                <div style={rail}>
                    {collapsed || !readable ? (
                        <span style={blankFace} />
                    ) : (
                        authorFace(comment.author)
                    )}
                    {threaded && <span style={thread} />}
                </div>
                <div style={column}>
                    {collapsed ? (
                        <p style={{ ...muted, margin: 0, fontSize: 14, minHeight: 36 }}>
                            {strings.ignoring} ·{' '}
                            <button
                                type="button"
                                style={action}
                                onClick={() => ctx.onReveal(comment.id)}
                            >
                                {strings.reveal}
                            </button>
                        </p>
                    ) : readable ? (
                        <>
                            <div style={byline}>
                                <AuthorName author={comment.author} />
                                <span style={muted}>{formatWhen(comment.createdAt)}</span>
                                {comment.edited && (
                                    <span
                                        style={muted}
                                        title={strings.editedAt(formatWhen(comment.updatedAt))}
                                    >
                                        {strings.edited}
                                    </span>
                                )}
                                <CommentMenu
                                    comment={comment}
                                    own={own}
                                    signedIn={ctx.signedIn}
                                    onEdit={
                                        own && canEdit(comment)
                                            ? () => ctx.onOpenEdit(comment.id)
                                            : undefined
                                    }
                                    onRemove={() => ctx.onRemove(comment.id)}
                                    onReport={(reason) => ctx.onReport(comment.id, reason)}
                                    onIgnore={(authorId, mode) =>
                                        ctx.onIgnore(comment.id, authorId, mode)
                                    }
                                    onUnignore={ctx.onUnignore}
                                    onSessionExpired={ctx.onSessionExpired}
                                />
                            </div>
                            {editing && comment.body !== undefined ? (
                                <EditForm
                                    body={comment.body}
                                    onSave={(body) => ctx.onEdit(comment.id, body)}
                                    onCancel={ctx.onCloseEdit}
                                    onSessionExpired={ctx.onSessionExpired}
                                />
                            ) : (
                                <>
                                    {comment.body !== undefined && (
                                        <CommentBody body={comment.body} />
                                    )}
                                    <ReactionBar
                                        comment={comment}
                                        canReact={ctx.signedIn && !own}
                                        loginHref={own ? undefined : loginHere()}
                                        onReact={ctx.onReact}
                                    />
                                    <p style={{ margin: '10px 0 0' }}>
                                        {/* Someone signed out gets the way in where the button
                                            stood, not under it */}
                                        {replying && !ctx.signedIn ? (
                                            <span style={muted}>
                                                {strings.signInToReply} &middot;{' '}
                                                <a href={loginHere()} style={signInLink}>
                                                    {strings.signIn}
                                                </a>
                                            </span>
                                        ) : (
                                            <button
                                                type="button"
                                                style={action}
                                                onClick={() => ctx.onOpenReply(comment.id)}
                                            >
                                                {strings.reply}
                                            </button>
                                        )}
                                    </p>
                                </>
                            )}
                        </>
                    ) : (
                        <>
                            <div style={byline}>
                                <span style={muted}>{formatWhen(comment.createdAt)}</span>
                            </div>
                            <Placeholder>
                                {placeholderFor(
                                    comment.visibility as 'gravestone' | 'deleted' | 'removed'
                                )}
                            </Placeholder>
                        </>
                    )}
                    {replying && readable && ctx.signedIn && (
                        <div style={{ marginTop: 8 }}>
                            {ctx.restriction ? (
                                <RestrictionPlate until={ctx.restriction.until} />
                            ) : (
                                <ComposeForm
                                    draftKey={ctx.draftKeyFor(comment.id)}
                                    placeholder={strings.yourReply}
                                    autoFocus
                                    onSubmit={(body, idempotencyKey) =>
                                        ctx.onReply(comment.id, body, inline, idempotencyKey)
                                    }
                                    onCancel={ctx.onCloseReply}
                                    onParentDeleted={ctx.onPromote}
                                    onSessionExpired={ctx.onSessionExpired}
                                />
                            )}
                        </div>
                    )}

                    {ctx.mutedUnder === comment.id && (
                        <p style={notice}>{strings.mutedByRecipient}</p>
                    )}

                    <Replies node={node} inline={inline} ctx={ctx} />
                </div>
            </div>
        </div>
    )
}

function Replies({ node, inline, ctx }: Props) {
    const { comment } = node
    if (comment.replyCount === 0 && node.replies === null) return null

    // Not drawn here: one control, and it re-roots
    if (!inline) {
        return (
            <p style={{ margin: '8px 0 0' }}>
                <button type="button" style={linkButton} onClick={() => ctx.onReroot(comment.id)}>
                    {strings.showReplies(comment.replyCount)}
                </button>
            </p>
        )
    }

    if (node.replies === null) {
        return (
            <p style={{ margin: '8px 0 0' }}>
                {node.failed ? (
                    <>
                        <span style={muted}>{strings.repliesFailed}</span>{' '}
                        <button
                            type="button"
                            style={action}
                            onClick={() => ctx.onShowReplies(comment.id)}
                        >
                            {strings.retry}
                        </button>
                    </>
                ) : (
                    <button
                        type="button"
                        style={linkButton}
                        disabled={node.loading}
                        onClick={() => ctx.onShowReplies(comment.id)}
                    >
                        {node.loading ? strings.loading : strings.showReplies(comment.replyCount)}
                    </button>
                )}
            </p>
        )
    }

    return (
        <div style={{ marginTop: 4 }}>
            {node.replies.length === 0 && comment.replyCount > 0 && (
                <p style={{ ...muted, margin: '8px 0 0' }}>{strings.noRepliesLeft}</p>
            )}
            {node.replies.map((reply) => (
                <CommentItem key={reply.comment.id} node={reply} inline={false} ctx={ctx} />
            ))}
            {node.hasMore && (
                <p style={{ margin: '8px 0 0' }}>
                    {node.failed && <span style={muted}>{strings.repliesFailed} </span>}
                    <button
                        type="button"
                        style={node.failed ? action : linkButton}
                        disabled={node.loading}
                        onClick={() => ctx.onMoreReplies(comment.id, node.cursor)}
                    >
                        {node.loading
                            ? strings.loading
                            : node.failed
                              ? strings.retry
                              : strings.moreReplies}
                    </button>
                </p>
            )}
        </div>
    )
}
