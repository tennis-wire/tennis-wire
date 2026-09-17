// Mirrors public-web/components/discussion/HiddenBranch.tsx.
//
// Real differences:
// - getBlock/setBlock/removeBlock need accessToken here (no proxy to read a cookie), taken from
//   useReaderSession() directly. The signedOut/still-loading distinction web's comment on
//   `signedOut` describes turns out to hold here too, for the same underlying reason: this
//   provider sets tokens before it resolves the profile fetch that decides `session.authenticated`,
//   so accessToken can already be usable while session is still null.
// - "Ко всему игнор-листу" now pushes /me/ignore instead of a Next Link to
//   /me/settings/ignore; that route is created alongside IgnoreList.tsx, next in this port.
// - "Sign in" calls onSignIn() instead of linking to a URL with a returnTo param, same reasoning
//   as CommentItem/CommentMenu.
// - flex: '1 1 160px' becomes flexGrow/flexShrink/flexBasis set separately -- RN takes no flex
//   shorthand string.

import { useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { View } from 'react-native'

import { useReaderSession } from '../auth/ReaderSessionProvider'
import { DiscussionError } from '../../lib/discussion/api'
import { getBlock, removeBlock, setBlock } from '../../lib/discussion/endpoints'
import type { BlockMode } from '../../lib/discussion/modes'
import type { Block } from '../../lib/discussion/types'
import { useTheme } from '../../theme'
import { Text } from '../ui'
import IgnoreModePicker from './IgnoreModePicker'
import { PersonFace, PersonName } from './Person'
import { strings } from './strings'
import { discussionStyles } from './styles'

type Props = {
    // whose blocks hide the branch, nearest the root first; empty when a placeholder does
    blockedIds: string[]
    // a block was changed or lifted: the view is asked for again, and opens if nothing else hides it
    onChanged: () => void
    onBack: () => void
    onSessionExpired: () => void
    // opens the sign-in flow directly; web links to a return-to URL instead
    onSignIn: () => void
}

// No entry yet is the loading state, so the effect sets nothing before an answer comes.
// 'absent': the row was lifted elsewhere in the meantime, and there is nothing to offer for it.
type Entry = { kind: 'failed' } | { kind: 'absent' } | { kind: 'ready'; block: Block }

const status = (error: unknown) => (error instanceof DiscussionError ? error.status : null)

// null: the session is over
async function entryFor(id: string, accessToken: string): Promise<Entry | null> {
    try {
        return { kind: 'ready', block: await getBlock(id, accessToken) }
    } catch (error) {
        if (status(error) === 401) return null
        return status(error) === 404 ? { kind: 'absent' } : { kind: 'failed' }
    }
}

// with the blocks behind it offered for change right here: finding the name in the whole
// list is the reader's job otherwise
export default function HiddenBranch({
    blockedIds,
    onChanged,
    onBack,
    onSessionExpired,
    onSignIn,
}: Props) {
    const { colors } = useTheme()
    const styles = discussionStyles(colors)
    const router = useRouter()
    const { session, setSession, accessToken } = useReaderSession()
    // Only a session known to be over: while accessToken is still settling, requests still work
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
        if (!accessToken) return
        let live = true
        for (const id of blockedIds) {
            void entryFor(id, accessToken).then((entry) => live && settle(id, entry))
        }
        return () => {
            live = false
        }
    }, [blockedIds, accessToken, settle])

    function retry(id: string) {
        if (!accessToken) return
        setEntries((current) => ({ ...current, [id]: undefined }))
        void entryFor(id, accessToken).then((entry) => settle(id, entry))
    }

    async function change(
        id: string,
        request: (token: string) => Promise<unknown>,
        failed: string
    ) {
        if (!accessToken) return expired()
        setBusy(id)
        setFailure(null)
        try {
            await request(accessToken)
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
        void change(
            block.blockedId,
            (token) => setBlock(block.blockedId, mode, token),
            strings.saveFailed
        )
    }

    function lift(block: Block) {
        void change(
            block.blockedId,
            (token) => removeBlock(block.blockedId, token),
            strings.unignoreFailed
        )
    }

    return (
        <View>
            <Text style={{ fontSize: 14, color: colors.textSecondary }}>
                {strings.hiddenByIgnore}
            </Text>

            {signedOut ? (
                <Text style={[styles.muted, { marginTop: 8 }]}>
                    {strings.sessionExpired} ·{' '}
                    <Text style={{ color: colors.primary }} onPress={onSignIn}>
                        {strings.signIn}
                    </Text>
                </Text>
            ) : (
                blockedIds.length > 0 && (
                    <View style={{ marginTop: 8 }}>
                        {blockedIds.map((id) => {
                            const entry = entries[id]
                            if (entry?.kind === 'absent') return null
                            return (
                                <View
                                    key={id}
                                    style={{
                                        paddingVertical: 14,
                                        borderBottomWidth: 1,
                                        borderBottomColor: colors.border,
                                    }}
                                >
                                    {entry === undefined ? (
                                        <Text style={styles.muted}>{strings.loading}</Text>
                                    ) : entry.kind === 'failed' ? (
                                        <Text style={styles.muted}>
                                            {strings.moreFailed} ·{' '}
                                            <Text
                                                style={styles.linkButton}
                                                onPress={() => retry(id)}
                                            >
                                                {strings.retry}
                                            </Text>
                                        </Text>
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
                                </View>
                            )
                        })}
                    </View>
                )
            )}

            <View style={{ marginTop: 16, flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
                <Text style={styles.linkButton} onPress={() => router.push('/me/ignore')}>
                    {strings.wholeIgnoreList}
                </Text>
                <Text style={styles.linkButton} onPress={onBack}>
                    {strings.allComments}
                </Text>
            </View>
        </View>
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
    const { colors } = useTheme()
    const styles = discussionStyles(colors)

    return (
        <>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <PersonFace user={block.user} />
                <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 160 }}>
                    <PersonName user={block.user} />
                    <Text style={[styles.muted, { marginTop: 2 }]}>
                        {strings.modes[block.mode]}
                    </Text>
                </View>
                {!editing && (
                    <View style={{ flexDirection: 'row', gap: 16 }}>
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
                    </View>
                )}
            </View>

            {editing ? (
                <View style={{ marginTop: 10, marginLeft: 48 }}>
                    <IgnoreModePicker
                        initial={block.mode}
                        confirmLabel={strings.save}
                        busy={busy}
                        failure={failure}
                        onConfirm={onSave}
                        onCancel={onCancel}
                    />
                </View>
            ) : (
                failure && (
                    <Text style={[styles.muted, { marginTop: 6, marginLeft: 48 }]}>{failure}</Text>
                )
            )}
        </>
    )
}
