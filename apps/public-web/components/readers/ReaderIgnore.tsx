'use client'

import { useCallback, useEffect, useState } from 'react'

import { useReaderSession } from '@/components/auth/ReaderSessionProvider'
import IgnoreModePicker from '@/components/discussion/IgnoreModePicker'
import { strings } from '@/components/discussion/strings'
import { action, muted } from '@/components/discussion/styles'
import { DiscussionError } from '@/lib/discussion/api'
import { getBlock, removeBlock, setBlock } from '@/lib/discussion/endpoints'
import type { BlockMode } from '@/lib/discussion/modes'

// null: not ignored. No entry yet is the loading state.
type Entry = { kind: 'failed' } | { kind: 'known'; mode: BlockMode | null }

const status = (error: unknown) => (error instanceof DiscussionError ? error.status : null)

function failure(error: unknown, failed: string): string {
    if (status(error) === 429) return strings.tooOften
    if (error instanceof DiscussionError && error.code === 'BLOCK_LIST_FULL')
        return strings.ignoreListFull
    return failed
}

type Props = {
    readerId: string
    // the list below is shaped by the mode, so it is asked for again whenever this changes
    onMode: (mode: BlockMode | null) => void
}

// Nothing for someone signed out: ignoring is a reader's own list
export default function ReaderIgnore({ readerId, onMode }: Props) {
    const { session, setSession } = useReaderSession()
    const signedIn = session?.authenticated === true
    const [entry, setEntry] = useState<Entry | null>(null)
    const [editing, setEditing] = useState(false)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const settle = useCallback(
        (mode: BlockMode | null) => {
            setEntry({ kind: 'known', mode })
            onMode(mode)
        },
        [onMode]
    )

    const load = useCallback(() => {
        getBlock(readerId).then(
            (block) => settle(block.mode),
            (error: unknown) => {
                if (status(error) === 404) return settle(null)
                if (status(error) === 401) return setSession({ authenticated: false })
                setEntry({ kind: 'failed' })
            }
        )
    }, [readerId, settle, setSession])

    useEffect(() => {
        if (signedIn) load()
    }, [signedIn, load])

    async function change(request: () => Promise<BlockMode | null>, failed: string) {
        setBusy(true)
        setError(null)
        try {
            settle(await request())
            setEditing(false)
        } catch (error) {
            if (status(error) === 401) return setSession({ authenticated: false })
            setError(failure(error, failed))
        } finally {
            setBusy(false)
        }
    }

    if (!signedIn || entry === null) return null

    if (entry.kind === 'failed')
        return (
            <p style={{ ...muted, margin: '0 0 16px' }}>
                {strings.loadFailed} ·{' '}
                <button
                    type="button"
                    style={action}
                    onClick={() => {
                        setEntry(null)
                        load()
                    }}
                >
                    {strings.retry}
                </button>
            </p>
        )

    const { mode } = entry
    if (editing)
        return (
            <div style={{ margin: '0 0 16px' }}>
                <IgnoreModePicker
                    initial={mode ?? 'soft'}
                    confirmLabel={mode ? strings.save : strings.ignore}
                    busy={busy}
                    failure={error}
                    onConfirm={(next) =>
                        next === mode
                            ? setEditing(false)
                            : void change(
                                  async () => (await setBlock(readerId, next)).mode,
                                  mode ? strings.saveFailed : strings.ignoreFailed
                              )
                    }
                    onCancel={() => {
                        setEditing(false)
                        setError(null)
                    }}
                />
            </div>
        )

    return (
        <p style={{ ...muted, margin: '0 0 16px', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {mode && <span>{strings.ignoredAs(strings.modes[mode])}</span>}
            <button type="button" style={action} disabled={busy} onClick={() => setEditing(true)}>
                {mode ? strings.changeMode : strings.ignore}
            </button>
            {mode && (
                <button
                    type="button"
                    style={action}
                    disabled={busy}
                    onClick={() =>
                        void change(async () => {
                            await removeBlock(readerId)
                            return null
                        }, strings.unignoreFailed)
                    }
                >
                    {strings.unignore}
                </button>
            )}
            {error && <span role="alert">{error}</span>}
        </p>
    )
}
