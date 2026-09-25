'use client'

import { useState } from 'react'

import { articleHref, type ArticleRef } from '@/lib/content/refs'
import type { Comment } from '@/lib/discussion/types'

import CommentBody, { placeholder } from './CommentBody'
import { formatShort, formatWhen } from '@/lib/format'
import { strings } from './strings'
import { action, muted } from './styles'
import { hashFor } from './useDiscussion'

const caption: React.CSSProperties = {
    fontSize: 13,
    color: 'var(--tw-text-secondary)',
    textDecoration: 'none',
}

const meta: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 8,
    fontSize: 13,
    color: 'var(--tw-text-secondary)',
}

const toThread: React.CSSProperties = {
    color: 'var(--tw-primary)',
    fontWeight: 600,
    textDecoration: 'none',
}

type Props = {
    comment: Comment
    // null: the article is gone; undefined: the comment does not stand under an article
    article: ArticleRef | null | undefined
    // a rule above this one: all of them in a plain list, all but the first inside a card
    divided: boolean
}

// A comment away from its thread. The reply reads first; the article it stands under is a caption
// over it. The caption and the link at the end both lead back, re-rooted on this comment.
export default function ProfileComment({ comment, article, divided }: Props) {
    const [revealed, setRevealed] = useState(false)
    const collapsed = comment.visibility === 'soft_hidden' && !revealed
    // A full load, not next/link: the thread reads the hash when it mounts
    const thread = article ? `${articleHref(article)}${hashFor(comment.id)}` : null

    return (
        <li
            style={{
                padding: '16px 0',
                borderTop: divided ? '1px solid var(--tw-border)' : 'none',
            }}
        >
            {thread && article ? (
                <a href={thread} style={caption}>
                    {article.title}
                </a>
            ) : article === null ? (
                <span style={caption}>{strings.articleGone}</span>
            ) : null}

            {collapsed ? (
                <p style={{ ...muted, margin: '6px 0 0', fontSize: 14 }}>
                    {strings.ignoring} &middot;{' '}
                    <button type="button" style={action} onClick={() => setRevealed(true)}>
                        {strings.reveal}
                    </button>
                </p>
            ) : comment.body === undefined ? (
                <p style={placeholder}>{strings.hidden}</p>
            ) : (
                <CommentBody body={comment.body} />
            )}

            <div style={meta}>
                <span title={formatWhen(comment.createdAt)}>{formatShort(comment.createdAt)}</span>
                {comment.edited && (
                    <span title={strings.editedAt(formatWhen(comment.updatedAt))}>
                        {strings.edited}
                    </span>
                )}
                {comment.replyCount > 0 && <span>{strings.replyTally(comment.replyCount)}</span>}
                {thread && (
                    <a href={thread} style={toThread}>
                        {strings.toThread}
                    </a>
                )}
            </div>
        </li>
    )
}
