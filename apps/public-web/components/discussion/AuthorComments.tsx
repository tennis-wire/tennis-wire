'use client'

import { useCallback, useEffect, useReducer } from 'react'

import { resolveRefs, type Refs } from '@/lib/content/refs'
import { NetworkError } from '@/lib/discussion/api'
import { initial, reduce, type Loaded } from '@/lib/discussion/authored'
import { listByAuthor } from '@/lib/discussion/endpoints'

import ProfileComment from './ProfileComment'
import { strings } from './strings'
import { linkButton, muted } from './styles'

const text: React.CSSProperties = { ...muted, fontSize: 14, margin: 0 }

// Someone else's page shows the list as a card of its own; the cabinet is a card already
const card: React.CSSProperties = {
    background: 'var(--tw-surface)',
    border: '1px solid var(--tw-border)',
    borderRadius: 14,
    boxShadow: 'var(--tw-card-shadow)',
    padding: '4px 22px 18px',
}

const moreLink: React.CSSProperties = { ...linkButton, fontSize: 15, fontWeight: 600 }

async function fetchPage(authorId: string, cursor: string | null, known: Refs): Promise<Loaded> {
    const page = await listByAuthor(authorId, cursor)
    return {
        items: page.items,
        cursor: page.nextCursor,
        refs: await resolveRefs(page.items, known),
    }
}

// One author's comments away from their threads: the cabinet's own list and a reader's page
export default function AuthorComments({
    authorId,
    empty,
    framed = false,
}: {
    authorId: string
    empty: string
    framed?: boolean
}) {
    const [state, dispatch] = useReducer(reduce, initial)

    const load = useCallback(async () => {
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
        dispatch({ type: 'more-loading' })
        try {
            dispatch({ type: 'more-loaded', page: await fetchPage(authorId, cursor, known) })
        } catch {
            dispatch({ type: 'more-failed' })
        }
    }

    if (state.phase === 'loading') return <p style={text}>{strings.loading}</p>
    if (state.phase === 'failed')
        return (
            <p style={text}>
                {state.offline ? strings.offline : strings.loadFailed}{' '}
                <button type="button" style={{ ...linkButton, fontSize: 14 }} onClick={load}>
                    {strings.retry}
                </button>
            </p>
        )
    if (state.items.length === 0) return <p style={text}>{empty}</p>

    const { cursor, refs, more } = state
    const list = (
        <ul
            style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                borderBottom: framed ? 'none' : '1px solid var(--tw-border)',
            }}
        >
            {state.items.map((comment, i) => (
                <ProfileComment
                    key={comment.id}
                    comment={comment}
                    article={refs.get(comment.subjectId)}
                    divided={!framed || i > 0}
                />
            ))}
        </ul>
    )
    return (
        <>
            {framed ? <div style={card}>{list}</div> : list}

            {cursor && (
                <p style={{ margin: '16px 0 0' }}>
                    {more === 'failed' && <span style={muted}>{strings.moreFailed} </span>}
                    <button
                        type="button"
                        style={moreLink}
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
