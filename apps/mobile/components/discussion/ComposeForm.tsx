// Mirrors public-web/components/discussion/ComposeForm.tsx.
//
// Real differences:
// - drafts.ts is async here (AsyncStorage, not localStorage), so the draft can no longer be read
//   synchronously into useState's initializer. The field starts empty and fills in once
//   readDraft resolves, which is a real, honest flash the web version does not have -- drafts
//   are rare enough that most forms start empty anyway.
// - <textarea> becomes a multiline TextInput; the footer's CSS `marginLeft: auto` push becomes
//   justifyContent: 'space-between' on the row instead, which does not depend on RN's spottier
//   support for auto margins.
// - Seed is imported from useDiscussion.ts rather than defined here (mobile's useDiscussion
//   does not import it from this file the way web's does, to avoid a dependency cycle in the
//   build order this port went in).

import { useEffect, useRef, useState } from 'react'
import { Pressable, TextInput, View } from 'react-native'
import { randomUUID } from 'expo-crypto'

import Avatar from '../Avatar'
import { useReaderSession } from '../auth/ReaderSessionProvider'
import { DiscussionError } from '../../lib/discussion/api'
import {
    type Failure,
    type Keyed,
    MAX_LENGTH,
    MAX_LINKS,
    classify,
    keyFor,
    normalize,
    problem,
} from '../../lib/discussion/compose'
import { clearDraft, readDraft, saveDraft } from '../../lib/discussion/drafts'
import { useTheme } from '../../theme'
import { Text } from '../ui'
import RestrictionPlate from './RestrictionPlate'
import { strings } from './strings'
import { discussionStyles } from './styles'
import type { Seed } from './useDiscussion'

type Props = {
    // null: nothing to key a draft by (the session carries no user id), so none is kept
    draftKey: string | null
    // text handed over from a reply whose parent is gone; `at` tells one hand-over
    // from the next
    seed?: Seed | null
    placeholder: string
    autoFocus?: boolean
    // sends the normalized text under its idempotency key; throws DiscussionError or NetworkError
    onSubmit: (body: string, idempotencyKey: string) => Promise<void>
    onCancel?: () => void
    // a reply form only: the parent is gone, the text can go up as a comment of its own
    onParentDeleted?: (text: string) => void
    onSessionExpired?: () => void
}

const DRAFT_DELAY_MS = 300

export default function ComposeForm({
    draftKey,
    seed = null,
    placeholder,
    autoFocus = false,
    onSubmit,
    onCancel,
    onParentDeleted,
    onSessionExpired,
}: Props) {
    const { colors } = useTheme()
    const styles = discussionStyles(colors)
    const { session, setSession } = useReaderSession()
    const [text, setText] = useState('')
    const [sending, setSending] = useState(false)
    const [failure, setFailure] = useState<Failure | null>(null)
    // undefined: no restriction met; null: one with no end
    const [restrictedUntil, setRestrictedUntil] = useState<string | null | undefined>(undefined)
    const sent = useRef(false)
    // the text last sent and the key it went under, until an answer says the comment is written
    const pending = useRef<Keyed | null>(null)
    const latest = useRef({ draftKey, text })
    // A hand-over replaces the text once; state adjusted during render, the way React wants
    // a prop change answered
    const [seedTaken, setSeedTaken] = useState<number | null>(null)
    if (seed && seed.at !== seedTaken) {
        setSeedTaken(seed.at)
        setText(seed.text)
    }

    // The draft this form starts from, once AsyncStorage answers. A seed handed over in the
    // meantime wins -- it is the newer intent -- so this only fills the field if nothing already
    // has.
    useEffect(() => {
        if (!draftKey) return
        let live = true
        readDraft(draftKey).then((stored) => {
            if (live && stored && text === '' && !seed) setText(stored)
        })
        return () => {
            live = false
        }
        // once per draftKey: a later external `text` change should not re-trigger this
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [draftKey])

    // The draft follows the typing at a short distance, and the last of it goes when the form
    // does: the reply form closes on cancel, and the material screen can be left mid-word.
    useEffect(() => {
        latest.current = { draftKey, text }
    })
    useEffect(() => {
        if (!draftKey) return
        const timer = setTimeout(() => void saveDraft(draftKey, text), DRAFT_DELAY_MS)
        return () => clearTimeout(timer)
    }, [draftKey, text])
    useEffect(
        () => () => {
            const { draftKey: key, text: left } = latest.current
            if (key && !sent.current) void saveDraft(key, left)
        },
        []
    )

    const issue = problem(text)
    const length = normalize(text).length

    async function submit() {
        if (issue || sending) return
        setSending(true)
        setFailure(null)
        try {
            const send = keyFor(pending.current, normalize(text), randomUUID)
            pending.current = send
            await onSubmit(send.body, send.key)
            pending.current = null
            sent.current = true
            if (draftKey) void clearDraft(draftKey)
            setText('')
        } catch (error) {
            if (error instanceof DiscussionError && error.status === 401) {
                // the token is no longer good; the text stays in the draft under this reader's id
                // and comes back after the next sign-in
                onSessionExpired?.()
                setSession({ authenticated: false })
                return
            }
            if (error instanceof DiscussionError && error.code === 'COMMENTING_RESTRICTED') {
                setRestrictedUntil(
                    (error.details.restrictedUntil as string | null | undefined) ?? null
                )
                return
            }
            setFailure(classify(error, onParentDeleted !== undefined))
        } finally {
            setSending(false)
        }
    }

    const mine = session?.authenticated ? session.displayName : null

    if (restrictedUntil !== undefined) {
        return (
            <RestrictionPlate until={restrictedUntil}>
                {text !== '' && (
                    <View
                        style={{
                            borderWidth: 1,
                            borderColor: colors.border,
                            borderRadius: 10,
                            backgroundColor: colors.surface,
                            padding: 10,
                        }}
                    >
                        <TextInput
                            editable={false}
                            value={text}
                            multiline
                            accessibilityLabel={placeholder}
                            style={{
                                fontSize: 15,
                                lineHeight: 22,
                                color: colors.text,
                                minHeight: 64,
                            }}
                        />
                    </View>
                )}
            </RestrictionPlate>
        )
    }

    return (
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
            <Avatar name={mine} size={36} />
            <View style={{ flex: 1 }}>
                <View
                    style={{
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 10,
                        backgroundColor: colors.surface,
                        padding: 10,
                    }}
                >
                    <TextInput
                        value={text}
                        onChangeText={setText}
                        placeholder={placeholder}
                        placeholderTextColor={colors.textMuted}
                        accessibilityLabel={placeholder}
                        autoFocus={autoFocus}
                        editable={!sending}
                        maxLength={MAX_LENGTH * 2}
                        multiline
                        style={{ fontSize: 15, lineHeight: 22, color: colors.text, minHeight: 64 }}
                    />
                    <View
                        style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginTop: 8,
                            paddingTop: 8,
                            borderTopWidth: 1,
                            borderTopColor: colors.border,
                            flexWrap: 'wrap',
                            gap: 12,
                        }}
                    >
                        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                            {issue === 'long' && (
                                <Text style={{ fontSize: 13, color: colors.live }}>
                                    {strings.tooLong(MAX_LENGTH)}
                                </Text>
                            )}
                            {issue === 'links' && (
                                <Text style={{ fontSize: 13, color: colors.live }}>
                                    {strings.tooManyLinks(MAX_LINKS)}
                                </Text>
                            )}
                            {/* The count is only worth the reader's attention as the limit comes up */}
                            {length > MAX_LENGTH - 200 && (
                                <Text
                                    style={[
                                        styles.muted,
                                        issue === 'long' && { color: colors.live },
                                    ]}
                                >
                                    {strings.counter(length, MAX_LENGTH)}
                                </Text>
                            )}
                        </View>
                        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                            {onCancel && (
                                <Pressable
                                    onPress={sending ? undefined : onCancel}
                                    disabled={sending}
                                >
                                    <Text style={[styles.action, sending && { opacity: 0.5 }]}>
                                        {strings.cancel}
                                    </Text>
                                </Pressable>
                            )}
                            <Pressable
                                onPress={sending || issue !== null ? undefined : submit}
                                disabled={sending || issue !== null}
                                style={{
                                    paddingHorizontal: 20,
                                    paddingVertical: 8,
                                    borderRadius: 20,
                                    backgroundColor: colors.primary,
                                    opacity: sending || issue !== null ? 0.5 : 1,
                                }}
                            >
                                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>
                                    {sending ? strings.sending : strings.send}
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
                {failure && (
                    <Text style={[styles.muted, { marginTop: 8 }]}>
                        {failure.kind === 'network' && (
                            <>
                                {strings.sendFailed}{' '}
                                <Text style={styles.linkButton} onPress={submit}>
                                    {strings.retry}
                                </Text>
                            </>
                        )}
                        {failure.kind === 'rate' && strings.tooOften}
                        {failure.kind === 'parent' && (
                            <>
                                {strings.parentDeleted}{' '}
                                {onParentDeleted && (
                                    <Text
                                        style={styles.linkButton}
                                        onPress={() => {
                                            // the text moves to the other form, draft and all
                                            sent.current = true
                                            if (draftKey) void clearDraft(draftKey)
                                            onParentDeleted(text)
                                        }}
                                    >
                                        {strings.postAsNew}
                                    </Text>
                                )}
                            </>
                        )}
                        {failure.kind === 'other' && failure.message}
                    </Text>
                )}
            </View>
        </View>
    )
}
