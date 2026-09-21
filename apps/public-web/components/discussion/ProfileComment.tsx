import { articleHref, type ArticleRef } from '@/lib/content/refs'
import type { Comment } from '@/lib/discussion/types'

import CommentBody, { placeholder } from './CommentBody'
import { formatWhen } from './format'
import { strings } from './strings'
import { muted } from './styles'
import { hashFor } from './useDiscussion'

const item: React.CSSProperties = {
    padding: '16px 0',
    borderBottom: '1px solid var(--tw-border)',
}

const title: React.CSSProperties = {
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--tw-text)',
    textDecoration: 'none',
}

const meta: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
}

type Props = {
    comment: Comment
    // null: the article is gone; undefined: the comment does not stand under an article
    article: ArticleRef | null | undefined
}

// A comment away from its thread. The article's title leads back to it, re-rooted on this comment.
export default function ProfileComment({ comment, article }: Props) {
    return (
        <li style={item}>
            {article ? (
                // A full load, not next/link: the thread reads the hash when it mounts
                <a href={`${articleHref(article)}${hashFor(comment.id)}`} style={title}>
                    {article.title}
                </a>
            ) : article === null ? (
                <span style={muted}>{strings.articleGone}</span>
            ) : null}

            {comment.body === undefined ? (
                <p style={placeholder}>{strings.hidden}</p>
            ) : (
                <CommentBody body={comment.body} />
            )}

            <div style={meta}>
                <span style={muted}>{formatWhen(comment.createdAt)}</span>
                {comment.edited && (
                    <span style={muted} title={strings.editedAt(formatWhen(comment.updatedAt))}>
                        {strings.edited}
                    </span>
                )}
                {comment.replyCount > 0 && (
                    <span style={muted}>{strings.replyTally(comment.replyCount)}</span>
                )}
            </div>
        </li>
    )
}
