'use client'

import { useEffect, useRef } from 'react'

import CommentBody, { Placeholder, placeholderFor } from './CommentBody'
import CommentItem, { AuthorName } from './CommentItem'
import { formatWhen } from './format'
import { strings } from './strings'
import { linkButton, muted } from './styles'
import { rootedId, useDiscussion } from './useDiscussion'

type Props = { subjectType: string; subjectId: string }

const section: React.CSSProperties = { maxWidth: 760, margin: '40px auto 0' }
const heading: React.CSSProperties = {
    fontFamily: 'var(--tw-font-display)',
    fontSize: 24,
    margin: '0 0 12px',
}

// The comments block. Loads when the reader is about a screen away from it, or at once when the
// URL points at a comment; the article above it does not wait for any of this (§3.1–2).
export default function Comments({ subjectType, subjectId }: Props) {
    const discussion = useDiscussion(subjectType, subjectId)
    const { state, load } = discussion
    const anchor = useRef<HTMLElement>(null)

    useEffect(() => {
        if (rootedId(window.location.hash)) {
            load()
            return
        }
        const element = anchor.current
        if (!element || typeof IntersectionObserver === 'undefined') {
            load()
            return
        }
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    observer.disconnect()
                    load()
                }
            },
            { rootMargin: '100% 0px' }
        )
        observer.observe(element)
        return () => observer.disconnect()
        // once: the loader is stable for one subject, and a later hash change has its own listener
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [subjectId])

    // The comment the URL points at goes into view once it is drawn
    const rootId =
        state.phase === 'ready' && state.view.kind === 'rooted' ? state.view.root.comment.id : null
    useEffect(() => {
        if (rootId)
            document.getElementById(`comment-${rootId}`)?.scrollIntoView({ block: 'center' })
    }, [rootId])

    return (
        <section ref={anchor} id="comments" style={section} aria-live="polite">
            <h2 style={heading}>{strings.heading}</h2>
            <Body discussion={discussion} />
        </section>
    )
}

function Body({ discussion }: { discussion: ReturnType<typeof useDiscussion> }) {
    const { state, load, loadMore, showReplies, moreReplies, reveal, reroot, backToAll } =
        discussion

    switch (state.phase) {
        case 'idle':
        case 'loading':
            return <p style={muted}>{strings.loading}</p>
        case 'failed':
            return (
                <p style={muted}>
                    {state.offline ? strings.offline : strings.loadFailed}{' '}
                    <button type="button" style={linkButton} onClick={load}>
                        {strings.retry}
                    </button>
                </p>
            )
        case 'missing':
            return (
                <p style={muted}>
                    {strings.missing}{' '}
                    <button type="button" style={linkButton} onClick={backToAll}>
                        {strings.allComments}
                    </button>
                </p>
            )
    }

    const { view } = state
    const handlers = {
        onShowReplies: showReplies,
        onMoreReplies: moreReplies,
        onReveal: reveal,
        onReroot: reroot,
    }

    if (view.kind === 'rooted') {
        const context = view.chain.slice(0, -1)
        return (
            <div>
                <p style={{ margin: '0 0 12px' }}>
                    <button type="button" style={linkButton} onClick={backToAll}>
                        ← {strings.allComments}
                    </button>
                </p>
                {/* Context only: a collapsed comment stays collapsed here, name and all (§9.11) */}
                {context.length > 0 && (
                    <div
                        style={{
                            borderLeft: '3px solid var(--tw-border)',
                            paddingLeft: 12,
                            marginBottom: 8,
                        }}
                    >
                        <p style={{ ...muted, margin: '0 0 4px' }}>{strings.inReplyTo}</p>
                        {context.map((comment) => (
                            <div key={comment.id} style={{ padding: '6px 0' }}>
                                <div
                                    style={{
                                        display: 'flex',
                                        gap: 10,
                                        alignItems: 'baseline',
                                        fontSize: 13,
                                    }}
                                >
                                    {comment.visibility === 'visible' && (
                                        <AuthorName author={comment.author} />
                                    )}
                                    <button
                                        type="button"
                                        style={{ ...linkButton, ...muted }}
                                        onClick={() => reroot(comment.id)}
                                    >
                                        {formatWhen(comment.createdAt)}
                                    </button>
                                </div>
                                {comment.visibility === 'visible' && comment.body !== undefined ? (
                                    <CommentBody body={comment.body} />
                                ) : (
                                    <Placeholder>
                                        {comment.visibility === 'soft_hidden'
                                            ? strings.ignoring
                                            : placeholderFor(
                                                  comment.visibility as
                                                      'gravestone' | 'deleted' | 'removed'
                                              )}
                                    </Placeholder>
                                )}
                            </div>
                        ))}
                    </div>
                )}
                <CommentItem node={view.root} inline highlighted {...handlers} />
            </div>
        )
    }

    if (view.items.length === 0) return <p style={muted}>{strings.none}</p>

    return (
        <div>
            {view.items.map((node) => (
                <CommentItem key={node.comment.id} node={node} inline {...handlers} />
            ))}
            {view.nextCursor && (
                <p style={{ margin: '12px 0 0' }}>
                    {view.more === 'failed' && <span style={muted}>{strings.moreFailed} </span>}
                    <button
                        type="button"
                        style={linkButton}
                        disabled={view.more === 'loading'}
                        onClick={loadMore}
                    >
                        {view.more === 'loading'
                            ? strings.loading
                            : view.more === 'failed'
                              ? strings.retry
                              : strings.more}
                    </button>
                </p>
            )}
        </div>
    )
}
