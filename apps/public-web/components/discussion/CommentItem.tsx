'use client'

import type { Node } from '@/lib/discussion/tree'
import type { Author, Comment } from '@/lib/discussion/types'

import CommentBody, { Placeholder, placeholderFor } from './CommentBody'
import { formatWhen } from './format'
import { strings } from './strings'
import { linkButton, muted } from './styles'

type Props = {
    node: Node
    // whether the direct replies are drawn under this comment. Where they are not, the reader
    // gets there by re-rooting on it (readers.md: the first level inline, deeper by re-root)
    inline: boolean
    highlighted?: boolean
    onShowReplies: (id: string) => void
    onMoreReplies: (id: string, cursor: string | null | undefined) => void
    onReveal: (id: string) => void
    onReroot: (id: string) => void
}

const card: React.CSSProperties = {
    padding: '12px 0',
    borderTop: '1px solid var(--tw-border)',
}

const highlight: React.CSSProperties = {
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

export default function CommentItem({
    node,
    inline,
    highlighted = false,
    onShowReplies,
    onMoreReplies,
    onReveal,
    onReroot,
}: Props) {
    const { comment } = node
    const collapsed = comment.visibility === 'soft_hidden' && !node.revealed
    const readable =
        comment.visibility === 'visible' || (comment.visibility === 'soft_hidden' && node.revealed)

    return (
        <div id={elementId(comment)} style={highlighted ? highlight : card}>
            {collapsed ? (
                <p style={{ ...muted, margin: 0, fontSize: 14 }}>
                    {strings.ignoring} ·{' '}
                    <button type="button" style={linkButton} onClick={() => onReveal(comment.id)}>
                        {strings.reveal}
                    </button>
                </p>
            ) : readable ? (
                <>
                    <div style={byline}>
                        <AuthorName author={comment.author} />
                        <span style={muted}>{formatWhen(comment.createdAt)}</span>
                    </div>
                    {comment.body !== undefined && <CommentBody body={comment.body} />}
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

            <Replies
                node={node}
                inline={inline}
                onShowReplies={onShowReplies}
                onMoreReplies={onMoreReplies}
                onReveal={onReveal}
                onReroot={onReroot}
            />
        </div>
    )
}

function Replies({
    node,
    inline,
    onShowReplies,
    onMoreReplies,
    onReveal,
    onReroot,
}: Omit<Props, 'highlighted'>) {
    const { comment } = node
    if (comment.replyCount === 0 && node.replies === null) return null

    // Not drawn here: one control, and it re-roots (§ layout)
    if (!inline) {
        return (
            <p style={{ margin: '8px 0 0' }}>
                <button type="button" style={linkButton} onClick={() => onReroot(comment.id)}>
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
                            onClick={() => onShowReplies(comment.id)}
                        >
                            {strings.retry}
                        </button>
                    </>
                ) : (
                    <button
                        type="button"
                        style={linkButton}
                        disabled={node.loading}
                        onClick={() => onShowReplies(comment.id)}
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
                <CommentItem
                    key={reply.comment.id}
                    node={reply}
                    inline={false}
                    onShowReplies={onShowReplies}
                    onMoreReplies={onMoreReplies}
                    onReveal={onReveal}
                    onReroot={onReroot}
                />
            ))}
            {node.hasMore && (
                <p style={{ margin: '8px 0 0' }}>
                    {node.failed && <span style={muted}>{strings.repliesFailed} </span>}
                    <button
                        type="button"
                        style={linkButton}
                        disabled={node.loading}
                        onClick={() => onMoreReplies(comment.id, node.cursor)}
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
