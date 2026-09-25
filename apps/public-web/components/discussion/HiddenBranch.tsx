'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import { useReaderSession } from '@/components/auth/ReaderSessionProvider'
import { loginHere } from '@/lib/auth/loginHref'
import { DiscussionError } from '@/lib/discussion/api'
import { getBlock, removeBlock, setBlock } from '@/lib/discussion/endpoints'
import type { BlockMode } from '@/lib/discussion/modes'
import type { Block } from '@/lib/discussion/types'

import IgnoreModePicker from './IgnoreModePicker'
import { PersonFace, PersonName } from './Person'
import { strings } from './strings'
import { action, linkButton, muted } from './styles'

type Props = {
    // whose blocks hide the branch, nearest the root first; empty when a placeholder does
    blockedIds: string[]
    // a block was changed or lifted: the view is asked for again, and opens if nothing else hides it
    onChanged: () => void
    onBack: () => void
    onSessionExpired: () => void
}

// No entry yet is the loading state, so the effect sets nothing before an answer comes.
// 'absent': the row was lifted elsewhere in the meantime, and there is nothing to offer for it.
type Entry = { kind: 'failed' } | { kind: 'absent' } | { kind: 'ready'; block: Block }

const status = (error: unknown) => (error instanceof DiscussionError ? error.status : null)

// null: the session is over
async function entryFor(id: string): Promise<Entry | null> {
    try {
        return { kind: 'ready', block: await getBlock(id) }
    } catch (error) {
        if (status(error) === 401) return null
        return status(error) === 404 ? { kind: 'absent' } : { kind: 'failed' }
    }
}

const row: React.CSSProperties = {
    padding: '14px 0',
    borderBottom: '1px solid var(--tw-border)',
}

// with the blocks behind it offered for change right here: finding the name in the whole
// list is the reader's job otherwise
export default function HiddenBranch({ blockedIds, onChanged, onBack, onSessionExpired }: Props) {
    const { session, setSession } = useReaderSession()
    // Only a session known to be over: while it is still being asked for, the proxy has the
    // cookie and the blocks load all the same
    const signedOut = session?.authenticated === false
    const [entries, setEntries] = useState<Record<string, Entry | undefined>>({})
    const [editing, setEditing] = useState<string | null>(null)
    const [busy, setBusy] = useState<string | null>(null)
    const [failure, setFailure] = useState<{ id: string; text: string } | null>(null)

    const expired = useCallback(() => {
        onSessionExpired()
        setSession({ authenticated: false })
    }, [onSessionExpired, setSession])

    const settle = useCallback(
        (id: string, entry: Entry | null) => {
            if (entry === null) return expired()
            setEntries((current) => ({ ...current, [id]: entry }))
        },
        [expired]
    )

    useEffect(() => {
        let live = true
        for (const id of blockedIds) {
            void entryFor(id).then((entry) => live && settle(id, entry))
        }
        return () => {
            live = false
        }
    }, [blockedIds, settle])

    function retry(id: string) {
        setEntries((current) => ({ ...current, [id]: undefined }))
        void entryFor(id).then((entry) => settle(id, entry))
    }

    async function change(id: string, request: () => Promise<unknown>, failed: string) {
        setBusy(id)
        setFailure(null)
        try {
            await request()
            onChanged()
        } catch (error) {
            setBusy(null)
            if (status(error) === 401) return expired()
            // the person's account went meanwhile, and the block with it: the branch may be open
            if (status(error) === 404) return onChanged()
            setFailure({ id, text: status(error) === 429 ? strings.tooOften : failed })
        }
    }

    function save(block: Block, mode: BlockMode) {
        if (mode === block.mode) return setEditing(null)
        void change(block.blockedId, () => setBlock(block.blockedId, mode), strings.saveFailed)
    }

    function lift(block: Block) {
        void change(block.blockedId, () => removeBlock(block.blockedId), strings.unignoreFailed)
    }

    return (
        <div>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--tw-text-secondary)' }}>
                {strings.hiddenByIgnore}
            </p>

            {signedOut ? (
                <p style={{ ...muted, margin: '8px 0 0' }}>
                    {strings.sessionExpired} ·{' '}
                    <a href={loginHere()} style={{ color: 'var(--tw-primary)' }}>
                        {strings.signIn}
                    </a>
                </p>
            ) : (
                blockedIds.length > 0 && (
                    <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0 }}>
                        {blockedIds.map((id) => {
                            const entry = entries[id]
                            if (entry?.kind === 'absent') return null
                            return (
                                <li key={id} style={row}>
                                    {entry === undefined ? (
                                        <span style={muted}>{strings.loading}</span>
                                    ) : entry.kind === 'failed' ? (
                                        <span style={muted}>
                                            {strings.moreFailed} ·{' '}
                                            <button
                                                type="button"
                                                style={linkButton}
                                                onClick={() => retry(id)}
                                            >
                                                {strings.retry}
                                            </button>
                                        </span>
                                    ) : (
                                        <BlockedBy
                                            block={entry.block}
                                            editing={editing === id}
                                            busy={busy === id}
                                            failure={failure?.id === id ? failure.text : null}
                                            onEdit={() => {
                                                setFailure(null)
                                                setEditing(id)
                                            }}
                                            onCancel={() => setEditing(null)}
                                            onSave={(mode) => save(entry.block, mode)}
                                            onLift={() => lift(entry.block)}
                                        />
                                    )}
                                </li>
                            )
                        })}
                    </ul>
                )
            )}

            <p style={{ margin: '16px 0 0', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <Link href="/me/settings/ignore" style={linkButton}>
                    {strings.wholeIgnoreList}
                </Link>
                <button type="button" style={linkButton} onClick={onBack}>
                    {strings.allComments}
                </button>
            </p>
        </div>
    )
}

type BlockedByProps = {
    block: Block
    editing: boolean
    busy: boolean
    failure: string | null
    onEdit: () => void
    onCancel: () => void
    onSave: (mode: BlockMode) => void
    onLift: () => void
}

function BlockedBy({
    block,
    editing,
    busy,
    failure,
    onEdit,
    onCancel,
    onSave,
    onLift,
}: BlockedByProps) {
    return (
        <>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <PersonFace user={block.user} />
                <div style={{ minWidth: 0, flex: '1 1 160px' }}>
                    <PersonName user={block.user} />
                    <div style={{ ...muted, marginTop: 2 }}>{strings.modes[block.mode]}</div>
                </div>
                {!editing && (
                    <div style={{ display: 'flex', gap: 16 }}>
                        <button type="button" style={action} disabled={busy} onClick={onEdit}>
                            {strings.changeMode}
                        </button>
                        <button type="button" style={action} disabled={busy} onClick={onLift}>
                            {strings.unignore}
                        </button>
                    </div>
                )}
            </div>

            {editing ? (
                <div style={{ margin: '10px 0 0 48px' }}>
                    <IgnoreModePicker
                        initial={block.mode}
                        confirmLabel={strings.save}
                        busy={busy}
                        failure={failure}
                        onConfirm={onSave}
                        onCancel={onCancel}
                    />
                </div>
            ) : (
                failure && (
                    <p role="alert" style={{ ...muted, margin: '6px 0 0 48px' }}>
                        {failure}
                    </p>
                )
            )}
        </>
    )
}
