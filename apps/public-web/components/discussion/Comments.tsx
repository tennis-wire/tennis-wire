'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { useReaderSession } from '@/components/auth/ReaderSessionProvider'
import { loginHere } from '@/lib/auth/loginHref'
import { draftKey, sweepDrafts } from '@/lib/discussion/drafts'

import CommentBody, { Placeholder, placeholderFor } from './CommentBody'
import CommentItem, { AuthorName, type Ctx } from './CommentItem'
import ComposeForm from './ComposeForm'
import HiddenBranch from './HiddenBranch'
import RestrictionPlate from './RestrictionPlate'
import SortPicker from './SortPicker'
import { formatWhen } from './format'
import { strings } from './strings'
import { action, blankFace, linkButton, muted, signInLink } from './styles'
import { rootedId, useDiscussion } from './useDiscussion'

type Props = { subjectType: string; subjectId: string }

const section: React.CSSProperties = {
    maxWidth: 760,
    margin: '48px auto 0',
    paddingTop: 28,
    borderTop: '1px solid var(--tw-border)',
}

const heading: React.CSSProperties = {
    fontSize: 24,
    margin: '0 0 20px',
}

// Stands where the form would be, so the block does not start with a line of fine print. The
// empty circle is where the reader's own would be.
const invitation: React.CSSProperties = {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    padding: '14px 16px',
    borderRadius: 10,
    background: 'var(--tw-bg-alt)',
}

// The chain that led to the comment being read: quoted, so it does not read as the thread itself
const quote: React.CSSProperties = {
    borderLeft: '2px solid var(--tw-border)',
    paddingLeft: 14,
    marginBottom: 12,
}

// The comments block. Loads when the reader is about a screen away from it, or at once when the
// URL points at a comment; the article above it does not wait for any of this
export default function Comments({ subjectType, subjectId }: Props) {
    const discussion = useDiscussion(subjectType, subjectId)
    const { session } = useReaderSession()
    const { state, load } = discussion
    const anchor = useRef<HTMLElement>(null)
    // the last write met a session that was no longer there
    const [sessionExpired, setSessionExpired] = useState(false)

    useEffect(() => {
        sweepDrafts()
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

    // The comment the reader was brought to goes into view once it is drawn
    const highlight = state.phase === 'ready' ? state.highlight : null
    const restriction = state.phase === 'ready' ? state.restriction : null
    useEffect(() => {
        if (highlight)
            document.getElementById(`comment-${highlight}`)?.scrollIntoView({ block: 'center' })
    }, [highlight])

    const signedIn = session?.authenticated === true
    const userId = session?.authenticated ? session.userId : null
    const draftKeyFor = useCallback(
        (parentId: string | null) => (userId ? draftKey(userId, subjectId, parentId) : null),
        [userId, subjectId]
    )
    const onSessionExpired = useCallback(() => setSessionExpired(true), [])

    const ctx: Ctx = {
        highlight,
        replyingTo: discussion.replyingTo,
        mutedUnder: discussion.mutedUnder,
        draftKeyFor,
        signedIn,
        restriction,
        userId,
        onShowReplies: discussion.showReplies,
        onMoreReplies: discussion.moreReplies,
        onReveal: discussion.reveal,
        onReroot: discussion.reroot,
        onOpenReply: discussion.openReply,
        onCloseReply: discussion.closeReply,
        onReply: discussion.reply,
        onPromote: discussion.promote,
        onSessionExpired,
        onRemove: discussion.remove,
        editing: discussion.editing,
        onOpenEdit: discussion.openEdit,
        onCloseEdit: discussion.closeEdit,
        onEdit: discussion.edit,
        onReact: discussion.react,
        onReport: discussion.report,
        onIgnore: discussion.ignore,
        onUnignore: discussion.unignore,
    }

    return (
        <section ref={anchor} id="comments" style={section} aria-live="polite">
            <h2 style={heading}>{strings.heading}</h2>
            <Body
                discussion={discussion}
                ctx={ctx}
                sessionKnown={session !== null}
                sessionExpired={sessionExpired}
                draftKey={draftKeyFor(null)}
            />
        </section>
    )
}

type BodyProps = {
    discussion: ReturnType<typeof useDiscussion>
    ctx: Ctx
    sessionKnown: boolean
    sessionExpired: boolean
    draftKey: string | null
}

function Body({ discussion, ctx, sessionKnown, sessionExpired, draftKey }: BodyProps) {
    const { state, load, loadMore, reroot, backToAll, post, seed, sort, setSort } = discussion

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
        case 'gone':
            return (
                <p style={muted}>
                    {strings.gone}{' '}
                    <button type="button" style={linkButton} onClick={backToAll}>
                        {strings.allComments}
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
        case 'hidden':
            return (
                <HiddenBranch
                    blockedIds={state.blockedIds}
                    onChanged={load}
                    onBack={backToAll}
                    onSessionExpired={ctx.onSessionExpired}
                />
            )
    }

    const { view } = state

    if (view.kind === 'rooted') {
        const context = view.chain.slice(0, -1)
        return (
            <div>
                <p style={{ margin: '0 0 16px' }}>
                    <button type="button" style={action} onClick={backToAll}>
                        ← {strings.allComments}
                    </button>
                </p>
                {/* Context only: a collapsed comment stays collapsed here, name and all */}
                {context.length > 0 && (
                    <div style={quote}>
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
                <CommentItem node={view.root} inline ctx={ctx} />
            </div>
        )
    }

    return (
        <div>
            {/* The form waits for the session to be known: a signed-in reader should not see
                the invitation to sign in flash first */}
            {sessionKnown && (
                <div style={{ marginBottom: 24 }}>
                    {ctx.signedIn && ctx.restriction ? (
                        <RestrictionPlate until={ctx.restriction.until} />
                    ) : ctx.signedIn ? (
                        <ComposeForm
                            draftKey={draftKey}
                            seed={seed}
                            placeholder={strings.yourComment}
                            onSubmit={post}
                            onSessionExpired={ctx.onSessionExpired}
                        />
                    ) : (
                        <div style={invitation}>
                            <span style={blankFace} />
                            <p
                                style={{
                                    margin: 0,
                                    fontSize: 15,
                                    color: 'var(--tw-text-secondary)',
                                }}
                            >
                                {sessionExpired ? strings.sessionExpired : strings.signInToComment}{' '}
                                &middot;{' '}
                                <a href={loginHere()} style={signInLink}>
                                    {strings.signIn}
                                </a>
                            </p>
                        </div>
                    )}
                </div>
            )}
            {/* Only where there is something to order, and not on a re-rooted view: a branch is
                always read oldest first */}
            {view.items.length > 1 && <SortPicker sort={sort} onChange={setSort} />}
            {view.items.length === 0 ? (
                <p style={muted}>{strings.none}</p>
            ) : (
                view.items.map((node) => (
                    <CommentItem key={node.comment.id} node={node} inline ctx={ctx} />
                ))
            )}
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
