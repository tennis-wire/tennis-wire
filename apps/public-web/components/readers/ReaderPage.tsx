'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import Avatar from '@/components/Avatar'
import { useReaderSession } from '@/components/auth/ReaderSessionProvider'
import AuthorComments from '@/components/discussion/AuthorComments'
import { strings } from '@/components/discussion/strings'
import { linkButton, muted } from '@/components/discussion/styles'
import { NetworkError } from '@/lib/discussion/api'
import type { BlockMode } from '@/lib/discussion/modes'
import { formatDay } from '@/lib/format'
import { fetchReader, type Reader } from '@/lib/readers'

import ReaderIgnore from './ReaderIgnore'

type State =
    | { kind: 'loading' }
    | { kind: 'missing' }
    | { kind: 'failed'; offline: boolean }
    | { kind: 'ready'; reader: Reader }

const text: React.CSSProperties = { ...muted, fontSize: 14, margin: 0 }

export default function ReaderPage({ id }: { id: string }) {
    const router = useRouter()
    const { session } = useReaderSession()
    const own = session?.authenticated === true && session.userId === id
    const [state, setState] = useState<State>({ kind: 'loading' })
    const [attempt, setAttempt] = useState(0)
    // undefined until known, and for someone signed out
    const [mode, setMode] = useState<BlockMode | null | undefined>(undefined)

    // one's own page is the cabinet
    useEffect(() => {
        if (own) router.replace('/me')
    }, [own, router])

    useEffect(() => {
        if (own) return
        let live = true
        fetchReader(id).then(
            (reader) => {
                if (live) setState(reader ? { kind: 'ready', reader } : { kind: 'missing' })
            },
            (error: unknown) => {
                const offline = error instanceof NetworkError && error.reason === 'offline'
                if (live) setState({ kind: 'failed', offline })
            }
        )
        return () => {
            live = false
        }
    }, [id, own, attempt])

    function retry() {
        setState({ kind: 'loading' })
        setAttempt((n) => n + 1)
    }

    if (own) return null
    if (state.kind === 'loading') return <p style={text}>{strings.loading}</p>
    if (state.kind === 'missing') return <h1 style={{ fontSize: 26 }}>{strings.readerMissing}</h1>
    if (state.kind === 'failed')
        return (
            <p style={text}>
                {state.offline ? strings.offline : strings.loadFailed}{' '}
                <button type="button" style={{ ...linkButton, fontSize: 14 }} onClick={retry}>
                    {strings.retry}
                </button>
            </p>
        )

    const { reader } = state
    return (
        <>
            {/* The header wraps: the ignore control stands at its right, and the mode picker,
                once open, takes a line of its own under the name */}
            <header
                style={{
                    display: 'flex',
                    gap: 16,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    margin: '8px 0 18px',
                }}
            >
                <Avatar
                    name={reader.displayName}
                    src={reader.avatarLargeUrl ?? reader.avatarUrl}
                    size={64}
                />
                <div style={{ minWidth: 0 }}>
                    <h1
                        style={{
                            fontSize: 26,
                            margin: 0,
                            overflowWrap: 'anywhere',
                        }}
                    >
                        {reader.displayName}
                    </h1>
                    <p style={{ ...text, color: 'var(--tw-text-secondary)', marginTop: 4 }}>
                        {strings.readerSince(formatDay(reader.createdAt))} ·{' '}
                        {strings.commentTally(reader.commentCount)}
                    </p>
                </div>
                <ReaderIgnore readerId={reader.id} onMode={setMode} />
            </header>
            <AuthorComments
                key={mode ?? 'none'}
                authorId={reader.id}
                framed
                empty={
                    mode === 'subtree_removal' ? strings.readerRemovedByIgnore : strings.readerEmpty
                }
            />
        </>
    )
}
