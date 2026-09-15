'use client'

import type { Node } from '@/lib/discussion/tree'
import type { Author, Comment } from '@/lib/discussion/types'

import CommentBody, { Placeholder, placeholderFor } from './CommentBody'
import CommentMenu from './CommentMenu'
import ComposeForm from './ComposeForm'
import { formatWhen, loginHref } from './format'
import { strings } from './strings'
import { linkButton, muted } from './styles'

// What every comment on the page shares: who is reading, what is open, and the handlers
export type Ctx = {
    highlight: string | null
    replyingTo: string | null
    mutedUnder: string | null
    // the reader's draft key for a form under this comment, or null when none can be kept
    draftKeyFor: (parentId: string) => string | null
    signedIn: boolean
    // the reader's own id, to tell his comments from the rest; null while unknown
    userId: string | null
    onShowReplies: (id: string) => void
    onMoreReplies: (id: string, cursor: string | null | undefined) => void
    onReveal: (id: string) => void
    onReroot: (id: string) => void
    onOpenReply: (id: string) => void
    onCloseReply: () => void
    onReply: (parentId: string, body: string, inline: boolean) => Promise<void>
    onPromote: (text: string) => void
    onSessionExpired: () => void
    onRemove: (id: string) => Promise<void>
}

type Props = {
    node: Node
    // whether the direct replies are drawn under this comment. Where they are not, the reader
    // gets there by re-rooting on it (readers.md: the first level inline, deeper by re-root)
    inline: boolean
    ctx: Ctx
}

const card: React.CSSProperties = {
    padding: '12px 0',
    borderTop: '1px solid var(--tw-border)',
}

const highlighted: React.CSSProperties = {
    ...card,
    background: 'color-mix(in srgb, var(--tw-accent-soft) 35%, transparent)',
    margin: '0 -12px',
    padding: '12px 12px',
    borderRadius: 6,
}

const byline: React.CSSProperties = {
    display: 'flex',
    gap: 10,
    alignItems: 'baseline',
    flexWrap: 'wrap',
    fontSize: 13,
}

const notice: React.CSSProperties = {
    margin: '8px 0 0',
    padding: '6px 10px',
    borderRadius: 6,
    background: 'var(--tw-bg-alt)',
    fontSize: 13,
}

const name: React.CSSProperties = { fontWeight: 600, color: 'var(--tw-text)' }

export function AuthorName({ author }: { author?: Author }) {
    if (!author) return <span style={name}>{strings.nobody}</span>
    if ('restricted' in author)
        return <span style={{ ...muted, fontStyle: 'italic' }}>{strings.restricted}</span>
    return <span style={name}>{author.displayName}</span>
}

function elementId(comment: Comment) {
    return `comment-${comment.id}`
}

export default function CommentItem({ node, inline, ctx }: Props) {
    const { comment } = node
    const collapsed = comment.visibility === 'soft_hidden' && !node.revealed
    // a live comment: the one kind that takes a reply (§5.2)
    const readable =
        comment.visibility === 'visible' || (comment.visibility === 'soft_hidden' && node.revealed)
    const replying = ctx.replyingTo === comment.id
    const own = ctx.userId !== null && comment.author?.id === ctx.userId

    return (
        <div id={elementId(comment)} style={ctx.highlight === comment.id ? highlighted : card}>
            {collapsed ? (
                <p style={{ ...muted, margin: 0, fontSize: 14 }}>
                    {strings.ignoring} ·{' '}
                    <button
                        type="button"
                        style={linkButton}
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
                        <CommentMenu
                            comment={comment}
                            own={own}
                            onRemove={() => ctx.onRemove(comment.id)}
                            onSessionExpired={ctx.onSessionExpired}
                        />
                    </div>
                    {comment.body !== undefined && <CommentBody body={comment.body} />}
                    <p style={{ margin: '6px 0 0' }}>
                        <button
                            type="button"
                            style={linkButton}
                            onClick={() => ctx.onOpenReply(comment.id)}
                        >
                            {strings.reply}
                        </button>
                    </p>
                </>
            ) : (
                <>
                    <div style={byline}>
                        <span style={muted}>{formatWhen(comment.createdAt)}</span>
                    </div>
                    <Placeholder>
                        {placeholderFor(comment.visibility as 'gravestone' | 'deleted' | 'removed')}
                    </Placeholder>
                </>
            )}

            {replying && readable && (
                <div style={{ marginTop: 8 }}>
                    {ctx.signedIn ? (
                        <ComposeForm
                            draftKey={ctx.draftKeyFor(comment.id)}
                            placeholder={strings.yourReply}
                            autoFocus
                            onSubmit={(body) => ctx.onReply(comment.id, body, inline)}
                            onCancel={ctx.onCloseReply}
                            onParentDeleted={ctx.onPromote}
                            onSessionExpired={ctx.onSessionExpired}
                        />
                    ) : (
                        <p style={{ ...muted, margin: 0 }}>
                            {strings.signInToReply} ·{' '}
                            <a href={loginHref()} style={{ color: 'var(--tw-primary)' }}>
                                {strings.signIn}
                            </a>
                        </p>
                    )}
                </div>
            )}

            {ctx.mutedUnder === comment.id && <p style={notice}>{strings.mutedByRecipient}</p>}

            <Replies node={node} inline={inline} ctx={ctx} />
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
                            style={linkButton}
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
        <div style={{ marginLeft: 20, marginTop: 4 }}>
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
                        style={linkButton}
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
