'use client'

import { useCallback, useEffect, useReducer } from 'react'

import { useReaderSession } from '@/components/auth/ReaderSessionProvider'
import ProfileComment from '@/components/discussion/ProfileComment'
import { strings } from '@/components/discussion/strings'
import { linkButton, muted } from '@/components/discussion/styles'
import { resolveRefs, type Refs } from '@/lib/content/refs'
import { NetworkError } from '@/lib/discussion/api'
import { initial, reduce, type Loaded } from '@/lib/discussion/authored'
import { listByAuthor } from '@/lib/discussion/endpoints'

const box: React.CSSProperties = { padding: '24px 28px 32px', maxWidth: 720 }
const text: React.CSSProperties = { ...muted, fontSize: 14, margin: 0 }

async function fetchPage(authorId: string, cursor: string | null, known: Refs): Promise<Loaded> {
    const page = await listByAuthor(authorId, cursor)
    return {
        items: page.items,
        cursor: page.nextCursor,
        refs: await resolveRefs(page.items, known),
    }
}

export default function AuthoredPage() {
    const { session } = useReaderSession()
    const authorId = session?.authenticated ? session.userId : null
    const [state, dispatch] = useReducer(reduce, initial)

    const load = useCallback(async () => {
        if (!authorId) return
        dispatch({ type: 'loading' })
        try {
            dispatch({ type: 'loaded', page: await fetchPage(authorId, null, new Map()) })
        } catch (error) {
            const offline = error instanceof NetworkError && error.reason === 'offline'
            dispatch({ type: 'load-failed', offline })
        }
    }, [authorId])

    useEffect(() => {
        void load()
    }, [load])

    async function loadMore(cursor: string, known: Refs) {
        if (!authorId) return
        dispatch({ type: 'more-loading' })
        try {
            dispatch({ type: 'more-loaded', page: await fetchPage(authorId, cursor, known) })
        } catch {
            dispatch({ type: 'more-failed' })
        }
    }

    if (session === null) return <p style={{ ...text, ...box }}>{strings.loading}</p>
    if (!session.authenticated) return null

    let body: React.ReactNode
    if (!authorId) {
        // signed in, but user-service did not say who: there is no author to list by
        body = <p style={text}>{strings.loadFailed}</p>
    } else if (state.phase === 'loading') {
        body = <p style={text}>{strings.loading}</p>
    } else if (state.phase === 'failed') {
        body = (
            <p style={text}>
                {state.offline ? strings.offline : strings.loadFailed}{' '}
                <button type="button" style={{ ...linkButton, fontSize: 14 }} onClick={load}>
                    {strings.retry}
                </button>
            </p>
        )
    } else if (state.items.length === 0) {
        body = <p style={text}>{strings.authoredEmpty}</p>
    } else {
        const { cursor, refs, more } = state
        body = (
            <>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {state.items.map((comment) => (
                        <ProfileComment
                            key={comment.id}
                            comment={comment}
                            article={refs.get(comment.subjectId)}
                        />
                    ))}
                </ul>

                {cursor && (
                    <p style={{ margin: '16px 0 0' }}>
                        {more === 'failed' && <span style={muted}>{strings.moreFailed} </span>}
                        <button
                            type="button"
                            style={linkButton}
                            disabled={more === 'loading'}
                            onClick={() => loadMore(cursor, refs)}
                        >
                            {more === 'loading'
                                ? strings.loading
                                : more === 'failed'
                                  ? strings.retry
                                  : strings.more}
                        </button>
                    </p>
                )}
            </>
        )
    }

    return (
        <div style={box}>
            <h1 style={{ fontFamily: 'var(--tw-font-display)', fontSize: 22, margin: '0 0 4px' }}>
                {strings.authored}
            </h1>
            <p style={{ ...text, margin: '0 0 12px' }}>{strings.authoredAbout}</p>
            {body}
        </div>
    )
}
