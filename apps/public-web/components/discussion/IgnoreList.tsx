'use client'

import { useCallback, useEffect, useReducer, useState } from 'react'

import { useReaderSession } from '@/components/auth/ReaderSessionProvider'
import { DiscussionError } from '@/lib/discussion/api'
import { listBlocks, removeBlock, setBlock } from '@/lib/discussion/endpoints'
import { initial, reduce, type Failure, type Reason, type Row } from '@/lib/discussion/ignoreList'
import type { BlockMode } from '@/lib/discussion/modes'

import IgnoreModePicker, { PickerPanel } from './IgnoreModePicker'
import ModeBadge from './ModeBadge'
import { PersonFace, PersonName } from './Person'
import { formatDay } from './format'
import { strings } from './strings'
import { linkButton, muted } from './styles'

const status = (error: unknown) => (error instanceof DiscussionError ? error.status : null)

function reasonOf(error: unknown): Reason {
    if (status(error) === 429) return 'rate'
    if (error instanceof DiscussionError && error.code === 'BLOCK_LIST_FULL') return 'full'
    return 'failed'
}

const text: React.CSSProperties = { ...muted, fontSize: 14, margin: 0 }

const item: React.CSSProperties = {
    padding: '16px 0',
    borderTop: '1px solid var(--tw-border)',
}

const change: React.CSSProperties = { ...linkButton, fontSize: 14, fontWeight: 600 }
const lift: React.CSSProperties = {
    ...linkButton,
    fontSize: 14,
    color: 'var(--tw-text-secondary)',
}

// The hint reads on after the date, so it starts in lower case
function lowerFirst(text: string): string {
    return text.charAt(0).toLowerCase() + text.slice(1)
}

export default function IgnoreList() {
    const { setSession } = useReaderSession()
    const [state, dispatch] = useReducer(reduce, initial)
    // the one row whose mode is being chosen
    const [editing, setEditing] = useState<string | null>(null)

    // The session ran out: the page goes back to offering a sign-in
    const signedOut = useCallback(() => setSession({ authenticated: false }), [setSession])

    const load = useCallback(async () => {
        dispatch({ type: 'loading' })
        try {
            dispatch({ type: 'loaded', page: await listBlocks() })
        } catch (error) {
            if (status(error) === 401) return signedOut()
            dispatch({ type: 'load-failed' })
        }
    }, [signedOut])

    useEffect(() => {
        void load()
    }, [load])

    async function loadMore(cursor: string) {
        dispatch({ type: 'more-loading' })
        try {
            dispatch({ type: 'more-loaded', page: await listBlocks(cursor) })
        } catch (error) {
            if (status(error) === 401) return signedOut()
            dispatch({ type: 'more-failed' })
        }
    }

    // A PUT: a new mode for the row, or the old one again for a row put back
    async function save(row: Row, mode: BlockMode) {
        const id = row.block.blockedId
        if (!row.lifted && mode === row.block.mode) return setEditing(null)
        dispatch({ type: 'busy', blockedId: id })
        try {
            const block = await setBlock(id, mode)
            dispatch({ type: 'saved', block })
            setEditing(null)
        } catch (error) {
            if (status(error) === 401) return signedOut()
            // the person's account was deleted meanwhile: there is nobody left to ignore
            if (status(error) === 404) return dispatch({ type: 'gone', blockedId: id })
            dispatch({
                type: 'failed',
                blockedId: id,
                failure: { of: 'save', reason: reasonOf(error) },
            })
        }
    }

    // No confirmation: the row stays with an offer to put it back
    async function lift(row: Row) {
        const id = row.block.blockedId
        dispatch({ type: 'busy', blockedId: id })
        try {
            await removeBlock(id)
            dispatch({ type: 'lifted', blockedId: id })
        } catch (error) {
            if (status(error) === 401) return signedOut()
            dispatch({
                type: 'failed',
                blockedId: id,
                failure: { of: 'lift', reason: reasonOf(error) },
            })
        }
    }

    if (state.phase === 'loading') return <p style={text}>{strings.loading}</p>

    if (state.phase === 'failed') {
        return (
            <p style={text}>
                {strings.ignoreListFailed} ·{' '}
                <button type="button" style={{ ...linkButton, fontSize: 14 }} onClick={load}>
                    {strings.retry}
                </button>
            </p>
        )
    }

    if (state.rows.length === 0) return <p style={text}>{strings.ignoreListEmpty}</p>

    const { cursor, more } = state

    return (
        <div>
            <ul
                style={{
                    listStyle: 'none',
                    margin: 0,
                    padding: 0,
                    borderBottom: '1px solid var(--tw-border)',
                }}
            >
                {state.rows.map((row) => (
                    <IgnoreRow
                        key={row.block.blockedId}
                        row={row}
                        editing={editing === row.block.blockedId}
                        onEdit={() => setEditing(row.block.blockedId)}
                        onCancel={() => setEditing(null)}
                        onSave={(mode) => save(row, mode)}
                        onLift={() => lift(row)}
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
                        onClick={() => loadMore(cursor)}
                    >
                        {more === 'loading'
                            ? strings.loading
                            : more === 'failed'
                              ? strings.retry
                              : strings.more}
                    </button>
                </p>
            )}
        </div>
    )
}

type RowProps = {
    row: Row
    editing: boolean
    onEdit: () => void
    onCancel: () => void
    onSave: (mode: BlockMode) => void
    onLift: () => void
}

function IgnoreRow({ row, editing, onEdit, onCancel, onSave, onLift }: RowProps) {
    const { block, lifted, busy, failure } = row
    // Said where it was tried: a new mode inside the picker, a lift or a putting back on the row.
    // A picker closed after a failure takes its message with it.
    const failed = failure && failureText(failure, lifted)
    const inPicker = failure?.of === 'save' && !lifted

    return (
        <li style={item}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <PersonFace user={block.user} />
                <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <PersonName user={block.user} />
                        {!lifted && <ModeBadge mode={block.mode} />}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--tw-text-secondary)', marginTop: 3 }}>
                        {lifted
                            ? strings.notIgnoring
                            : `${strings.ignoringSince(formatDay(block.createdAt))} \u2014 ${lowerFirst(strings.modeHints[block.mode])}`}
                    </div>

                    {/* The choice opens under the row, not in a menu: the list is where the reader
                        came to look at modes */}
                    {editing ? (
                        <div style={{ marginTop: 12 }}>
                            <PickerPanel>
                                <IgnoreModePicker
                                    initial={block.mode}
                                    confirmLabel={strings.save}
                                    busy={busy}
                                    failure={inPicker ? failed : null}
                                    onConfirm={onSave}
                                    onCancel={onCancel}
                                />
                            </PickerPanel>
                        </div>
                    ) : (
                        failed &&
                        !inPicker && (
                            <p role="alert" style={{ ...muted, margin: '6px 0 0' }}>
                                {failed}
                            </p>
                        )
                    )}
                </div>

                {!editing && (
                    <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                        {lifted ? (
                            <button
                                type="button"
                                style={change}
                                disabled={busy}
                                onClick={() => onSave(block.mode)}
                            >
                                {busy ? strings.saving : strings.restore}
                            </button>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    style={change}
                                    disabled={busy}
                                    onClick={onEdit}
                                >
                                    {strings.changeMode}
                                </button>
                                <button type="button" style={lift} disabled={busy} onClick={onLift}>
                                    {strings.unignore}
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>
        </li>
    )
}

function failureText({ of, reason }: Failure, lifted: boolean): string {
    if (reason === 'rate') return strings.tooOften
    if (reason === 'full') return strings.ignoreListFull
    if (of === 'lift') return strings.unignoreFailed
    return lifted ? strings.restoreFailed : strings.saveFailed
}
