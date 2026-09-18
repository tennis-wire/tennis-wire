// Mirrors public-web/components/discussion/IgnoreList.tsx. Same real difference as
// HiddenBranch: listBlocks/setBlock/removeBlock need accessToken here, taken from
// useReaderSession() directly rather than read from a cookie by a proxy.

import { useCallback, useEffect, useReducer, useState } from 'react'
import { View } from 'react-native'

import { useReaderSession } from '../auth/ReaderSessionProvider'
import { DiscussionError } from '../../lib/discussion/api'
import { listBlocks, removeBlock, setBlock } from '../../lib/discussion/endpoints'
import {
    initial,
    reduce,
    type Failure,
    type Reason,
    type Row,
} from '../../lib/discussion/ignoreList'
import type { BlockMode } from '../../lib/discussion/modes'
import { useTheme } from '../../theme'
import { Text } from '../ui'
import IgnoreModePicker from './IgnoreModePicker'
import { PersonFace, PersonName } from './Person'
import { formatDay } from './format'
import { strings } from './strings'
import { discussionStyles } from './styles'

const status = (error: unknown) => (error instanceof DiscussionError ? error.status : null)

function reasonOf(error: unknown): Reason {
    if (status(error) === 429) return 'rate'
    if (error instanceof DiscussionError && error.code === 'BLOCK_LIST_FULL') return 'full'
    return 'failed'
}

export default function IgnoreList() {
    const { colors } = useTheme()
    const styles = discussionStyles(colors)
    const { setSession, accessToken } = useReaderSession()
    const [state, dispatch] = useReducer(reduce, initial)
    // the one row whose mode is being chosen
    const [editing, setEditing] = useState<string | null>(null)

    // The session ran out: the screen goes back to offering a sign-in
    const signedOut = useCallback(() => setSession({ authenticated: false }), [setSession])

    const load = useCallback(async () => {
        if (!accessToken) return
        dispatch({ type: 'loading' })
        try {
            dispatch({ type: 'loaded', page: await listBlocks(undefined, accessToken) })
        } catch (error) {
            if (status(error) === 401) return signedOut()
            dispatch({ type: 'load-failed' })
        }
    }, [accessToken, signedOut])

    useEffect(() => {
        void load()
    }, [load])

    async function loadMore(cursor: string) {
        if (!accessToken) return
        dispatch({ type: 'more-loading' })
        try {
            dispatch({ type: 'more-loaded', page: await listBlocks(cursor, accessToken) })
        } catch (error) {
            if (status(error) === 401) return signedOut()
            dispatch({ type: 'more-failed' })
        }
    }

    // A PUT: a new mode for the row, or the old one again for a row put back
    async function save(row: Row, mode: BlockMode) {
        if (!accessToken) return signedOut()
        const id = row.block.blockedId
        if (!row.lifted && mode === row.block.mode) return setEditing(null)
        dispatch({ type: 'busy', blockedId: id })
        try {
            const block = await setBlock(id, mode, accessToken)
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
        if (!accessToken) return signedOut()
        const id = row.block.blockedId
        dispatch({ type: 'busy', blockedId: id })
        try {
            await removeBlock(id, accessToken)
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

    if (state.phase === 'loading')
        return <Text style={[styles.muted, { fontSize: 14 }]}>{strings.loading}</Text>

    if (state.phase === 'failed') {
        return (
            <Text style={[styles.muted, { fontSize: 14 }]}>
                {strings.ignoreListFailed} ·{' '}
                <Text style={[styles.linkButton, { fontSize: 14 }]} onPress={load}>
                    {strings.retry}
                </Text>
            </Text>
        )
    }

    if (state.rows.length === 0)
        return <Text style={[styles.muted, { fontSize: 14 }]}>{strings.ignoreListEmpty}</Text>

    const { cursor, more } = state

    return (
        <View>
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

            {cursor && (
                <Text style={{ marginTop: 16 }}>
                    {more === 'failed' && <Text style={styles.muted}>{strings.moreFailed} </Text>}
                    <Text
                        style={[styles.linkButton, more === 'loading' && { opacity: 0.5 }]}
                        onPress={more === 'loading' ? undefined : () => loadMore(cursor)}
                    >
                        {more === 'loading'
                            ? strings.loading
                            : more === 'failed'
                              ? strings.retry
                              : strings.more}
                    </Text>
                </Text>
            )}
        </View>
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
    const { colors } = useTheme()
    const styles = discussionStyles(colors)
    const { block, lifted, busy, failure } = row
    // Said where it was tried: a new mode inside the picker, a lift or a putting back on the row.
    // A picker closed after a failure takes its message with it.
    const failed = failure && failureText(failure, lifted)
    const inPicker = failure?.of === 'save' && !lifted

    return (
        <View
            style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}
        >
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <PersonFace user={block.user} />
                <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 160 }}>
                    <PersonName user={block.user} />
                    <Text style={[styles.muted, { marginTop: 2 }]}>
                        {lifted
                            ? strings.notIgnoring
                            : `${strings.modes[block.mode]} · ${strings.ignoringSince(formatDay(block.createdAt))}`}
                    </Text>
                </View>

                {!editing && (
                    <View style={{ flexDirection: 'row', gap: 16 }}>
                        {lifted ? (
                            <Text
                                style={[styles.action, busy && { opacity: 0.5 }]}
                                onPress={busy ? undefined : () => onSave(block.mode)}
                            >
                                {busy ? strings.saving : strings.restore}
                            </Text>
                        ) : (
                            <>
                                <Text
                                    style={[styles.action, busy && { opacity: 0.5 }]}
                                    onPress={busy ? undefined : onEdit}
                                >
                                    {strings.changeMode}
                                </Text>
                                <Text
                                    style={[styles.action, busy && { opacity: 0.5 }]}
                                    onPress={busy ? undefined : onLift}
                                >
                                    {strings.unignore}
                                </Text>
                            </>
                        )}
                    </View>
                )}
            </View>

            {editing ? (
                <View style={{ marginTop: 10, marginLeft: 48 }}>
                    <IgnoreModePicker
                        initial={block.mode}
                        confirmLabel={strings.save}
                        busy={busy}
                        failure={inPicker ? failed : null}
                        onConfirm={onSave}
                        onCancel={onCancel}
                    />
                </View>
            ) : (
                failed &&
                !inPicker && (
                    <Text style={[styles.muted, { marginTop: 6, marginLeft: 48 }]}>{failed}</Text>
                )
            )}
        </View>
    )
}

function failureText({ of, reason }: Failure, lifted: boolean): string {
    if (reason === 'rate') return strings.tooOften
    if (reason === 'full') return strings.ignoreListFull
    if (of === 'lift') return strings.unignoreFailed
    return lifted ? strings.restoreFailed : strings.saveFailed
}
