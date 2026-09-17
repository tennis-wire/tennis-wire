// Mirrors public-web/components/discussion/CommentMenu.tsx. The state machine (Panel, every
// handler) is a straight port; the presentation is not:
//
// - The anchored CSS popover (position: absolute off the "···" button) becomes a Modal
//   presented from the bottom. Comments render as scrolling siblings, and an absolutely
//   positioned popover in that context runs into RN's rougher edges around z-index and
//   overflow across sibling list rows; a Modal sidesteps all of it by rendering on its own
//   native layer, and a bottom sheet is the standard mobile pattern for a "..." action menu
//   anyway (Twitter, Reddit, YouTube all do this).
// - The Escape-key listener has no mobile equivalent; Modal's onRequestClose covers Android's
//   back button/gesture instead, which is the nearest thing this platform has.
// - "Sign in to report/ignore" calls onSignIn() instead of linking to a URL with a returnTo
//   query param (loginHref.ts is web-only): there is no page to return to here, the same
//   screen just re-renders once the session settles.

import { useEffect, useState } from 'react'
import { Modal, Pressable, View } from 'react-native'

import { useReaderSession } from '../auth/ReaderSessionProvider'
import { DiscussionError } from '../../lib/discussion/api'
import type { BlockMode } from '../../lib/discussion/modes'
import { REPORT_REASONS, type ReportReason } from '../../lib/discussion/reasons'
import { wasReported } from '../../lib/discussion/reported'
import type { Author, Comment } from '../../lib/discussion/types'
import { useTheme } from '../../theme'
import { Text } from '../ui'
import IgnoreModePicker from './IgnoreModePicker'
import { strings } from './strings'
import { discussionStyles } from './styles'

type Props = {
    comment: Comment
    // the reader wrote it: the menu offers to take it down, and nothing to report
    own: boolean
    signedIn: boolean
    onRemove: () => Promise<void>
    onReport: (reason: ReportReason) => Promise<void>
    // a new ignore of the author, or a change of mode; and lifting it. Both throw to be explained
    onIgnore: (authorId: string, mode: BlockMode) => Promise<void>
    onUnignore: (authorId: string) => Promise<void>
    onSessionExpired: () => void
    // opens the sign-in flow directly; web links to a return-to URL instead
    onSignIn: () => void
}

type ReportFailure = 'network' | 'rate' | 'removed'

type Panel =
    | { kind: 'closed' }
    | { kind: 'menu' }
    | { kind: 'remove'; busy: boolean; failed: boolean }
    | { kind: 'sign-in'; to: 'report' | 'ignore' }
    | { kind: 'report'; reason: ReportReason | null; busy: boolean; failure: ReportFailure | null }
    | { kind: 'reported' }
    | { kind: 'ignore'; busy: boolean; failure: string | null }

// the reason a retry re-sends; the panel only offers one once a reason was picked
function chosen(panel: Extract<Panel, { kind: 'report' }>): ReportReason {
    return panel.reason ?? 'other'
}

// A restricted author has no name to put in the title
function nameOf(author: Author): string | null {
    return 'restricted' in author ? null : author.displayName
}

function ignoreFailure(error: unknown, failed: string): string {
    if (error instanceof DiscussionError && error.status === 429) return strings.tooOften
    if (error instanceof DiscussionError && error.code === 'BLOCK_LIST_FULL')
        return strings.ignoreListFull
    return failed
}

export default function CommentMenu({
    comment,
    own,
    signedIn,
    onRemove,
    onReport,
    onIgnore,
    onUnignore,
    onSessionExpired,
    onSignIn,
}: Props) {
    const { colors } = useTheme()
    const styles = discussionStyles(colors)
    const { setSession } = useReaderSession()
    const [panel, setPanel] = useState<Panel>({ kind: 'closed' })
    // what this device already sent, once AsyncStorage answers
    const [reported, setReported] = useState(false)
    useEffect(() => {
        let live = true
        void wasReported(comment.id).then((value) => {
            if (live) setReported(value)
        })
        return () => {
            live = false
        }
    }, [comment.id])
    const { author } = comment
    // the menu is only drawn on a comment the reader can read, so a soft_hidden one here is one he
    // collapsed by his ignore and opened again
    const ignoring = comment.visibility === 'soft_hidden'

    const close = () => setPanel({ kind: 'closed' })

    function signedOut() {
        onSessionExpired()
        setSession({ authenticated: false })
        close()
    }

    async function remove() {
        setPanel({ kind: 'remove', busy: true, failed: false })
        try {
            await onRemove()
            // the node this menu sat on is a placeholder or gone by now
            close()
        } catch (error) {
            if (error instanceof DiscussionError && error.status === 401) return signedOut()
            // a 403 cannot happen from here, the item is only offered on the reader's own; the
            // rest is the network, and a retry is the reader's
            setPanel({ kind: 'remove', busy: false, failed: true })
        }
    }

    async function report(reason: ReportReason) {
        setPanel({ kind: 'report', reason, busy: true, failure: null })
        try {
            await onReport(reason)
            setReported(true)
            setPanel({ kind: 'reported' })
        } catch (error) {
            if (error instanceof DiscussionError && error.status === 401) return signedOut()
            const failure: ReportFailure =
                error instanceof DiscussionError && error.status === 429
                    ? 'rate'
                    : error instanceof DiscussionError && error.code === 'COMMENT_ALREADY_REMOVED'
                      ? 'removed'
                      : 'network'
            setPanel({ kind: 'report', reason, busy: false, failure })
        }
    }

    function openReport() {
        if (!signedIn) return setPanel({ kind: 'sign-in', to: 'report' })
        setPanel({ kind: 'report', reason: null, busy: false, failure: null })
    }

    function openIgnore() {
        if (!signedIn) return setPanel({ kind: 'sign-in', to: 'ignore' })
        setPanel({ kind: 'ignore', busy: false, failure: null })
    }

    async function ignore(authorId: string, mode: BlockMode) {
        // collapsed already, and asked to stay that way
        if (ignoring && mode === 'soft') return close()
        setPanel({ kind: 'ignore', busy: true, failure: null })
        try {
            // on success the comment collapses, hides or goes, and this menu with it
            await onIgnore(authorId, mode)
            close()
        } catch (error) {
            if (error instanceof DiscussionError && error.status === 401) return signedOut()
            const failed = ignoring ? strings.saveFailed : strings.ignoreFailed
            setPanel({ kind: 'ignore', busy: false, failure: ignoreFailure(error, failed) })
        }
    }

    async function unignore(authorId: string) {
        setPanel({ kind: 'ignore', busy: true, failure: null })
        try {
            await onUnignore(authorId)
            close()
        } catch (error) {
            if (error instanceof DiscussionError && error.status === 401) return signedOut()
            const failure = ignoreFailure(error, strings.unignoreFailed)
            setPanel({ kind: 'ignore', busy: false, failure })
        }
    }

    return (
        <View style={{ marginLeft: 'auto' }}>
            <Pressable
                accessibilityLabel={strings.actions}
                accessibilityRole="button"
                hitSlop={{ top: 8, left: 8, right: 8, bottom: 8 }}
                onPress={() =>
                    setPanel(panel.kind === 'closed' ? { kind: 'menu' } : { kind: 'closed' })
                }
            >
                <Text style={{ color: colors.textMuted, fontSize: 16 }}>···</Text>
            </Pressable>

            <Modal
                visible={panel.kind !== 'closed'}
                transparent
                animationType="fade"
                onRequestClose={close}
            >
                <Pressable
                    style={{
                        flex: 1,
                        backgroundColor: 'rgba(0,0,0,0.35)',
                        justifyContent: 'flex-end',
                    }}
                    onPress={close}
                >
                    <Pressable
                        style={{
                            backgroundColor: colors.surface,
                            borderTopLeftRadius: 14,
                            borderTopRightRadius: 14,
                            paddingHorizontal: 10,
                            paddingTop: 10,
                            paddingBottom: 24,
                        }}
                    >
                        {panel.kind === 'menu' &&
                            (own ? (
                                <MenuItem
                                    danger
                                    onPress={() =>
                                        setPanel({ kind: 'remove', busy: false, failed: false })
                                    }
                                >
                                    {strings.remove}
                                </MenuItem>
                            ) : (
                                <>
                                    <MenuItem disabled={reported} onPress={openReport}>
                                        {reported ? strings.reported : strings.report}
                                    </MenuItem>
                                    {/* no author, no id to ignore by: user-service had no profile */}
                                    {author && (
                                        <MenuItem onPress={openIgnore}>
                                            {ignoring
                                                ? strings.ignoredAs(strings.modes.soft)
                                                : strings.ignore}
                                        </MenuItem>
                                    )}
                                </>
                            ))}

                        {panel.kind === 'remove' && (
                            <>
                                <Note>
                                    {strings.confirmRemove}
                                    {comment.replyCount > 0 && ` ${strings.confirmRemoveReplies}`}
                                </Note>
                                <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
                                    <MenuItem danger disabled={panel.busy} onPress={remove}>
                                        {panel.busy
                                            ? strings.sending
                                            : panel.failed
                                              ? strings.retry
                                              : strings.remove}
                                    </MenuItem>
                                    <MenuItem disabled={panel.busy} onPress={close}>
                                        {strings.cancel}
                                    </MenuItem>
                                </View>
                                {panel.failed && <Note muted>{strings.removeFailed}</Note>}
                            </>
                        )}

                        {panel.kind === 'sign-in' && (
                            <Note muted>
                                {panel.to === 'report'
                                    ? strings.signInToReport
                                    : strings.signInToIgnore}{' '}
                                ·{' '}
                                <Text style={{ color: colors.primary }} onPress={onSignIn}>
                                    {strings.signIn}
                                </Text>
                            </Note>
                        )}

                        {panel.kind === 'report' && (
                            <>
                                <Note muted>{strings.reportReason}</Note>
                                {REPORT_REASONS.map((reason) => (
                                    <MenuItem
                                        key={reason}
                                        bold={panel.reason === reason}
                                        disabled={panel.busy}
                                        onPress={() => report(reason)}
                                    >
                                        {strings.reasons[reason]}
                                    </MenuItem>
                                ))}
                                {panel.busy && <Note muted>{strings.sending}</Note>}
                                {panel.failure === 'network' && panel.reason && (
                                    <Note muted>
                                        {strings.reportFailed}{' '}
                                        <Text
                                            style={styles.linkButton}
                                            onPress={() => report(chosen(panel))}
                                        >
                                            {strings.retry}
                                        </Text>
                                    </Note>
                                )}
                                {panel.failure === 'rate' && (
                                    <Note muted>{strings.tooManyReports}</Note>
                                )}
                                {panel.failure === 'removed' && (
                                    <Note muted>{strings.alreadyRemoved}</Note>
                                )}
                            </>
                        )}

                        {panel.kind === 'reported' && (
                            <>
                                <Note muted>{strings.reported}</Note>
                                {/* not offered on a comment the reader already collapsed: he ignores
                                    that author as it is */}
                                {author && !ignoring && (
                                    <MenuItem onPress={openIgnore}>{strings.ignoreAuthor}</MenuItem>
                                )}
                            </>
                        )}

                        {panel.kind === 'ignore' && author && (
                            <View
                                style={{ paddingHorizontal: 10, paddingTop: 4, paddingBottom: 8 }}
                            >
                                <Text style={{ marginBottom: 4, fontSize: 14, fontWeight: '600' }}>
                                    {ignoring
                                        ? strings.ignoringWhom(nameOf(author))
                                        : strings.ignoreWhom(nameOf(author))}
                                </Text>
                                <IgnoreModePicker
                                    initial="soft"
                                    confirmLabel={ignoring ? strings.save : strings.ignore}
                                    busy={panel.busy}
                                    failure={panel.failure}
                                    onConfirm={(mode) => ignore(author.id, mode)}
                                    onCancel={close}
                                />
                                {ignoring && (
                                    <Text
                                        style={[styles.linkButton, { marginTop: 10 }]}
                                        onPress={panel.busy ? undefined : () => unignore(author.id)}
                                    >
                                        {strings.unignore}
                                    </Text>
                                )}
                            </View>
                        )}
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    )
}

function MenuItem({
    children,
    onPress,
    disabled,
    danger,
    bold,
}: {
    children: React.ReactNode
    onPress?: () => void
    disabled?: boolean
    danger?: boolean
    bold?: boolean
}) {
    const { colors } = useTheme()
    return (
        <Pressable
            accessibilityRole="menuitem"
            disabled={disabled}
            onPress={onPress}
            style={{
                paddingVertical: 10,
                paddingHorizontal: 10,
                borderRadius: 6,
                opacity: disabled ? 0.5 : 1,
            }}
        >
            <Text
                style={{
                    fontSize: 14,
                    color: danger ? colors.live : colors.text,
                    fontWeight: bold ? '600' : '400',
                }}
            >
                {children}
            </Text>
        </Pressable>
    )
}

function Note({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
    const { colors } = useTheme()
    return (
        <Text
            style={{
                paddingVertical: 8,
                paddingHorizontal: 10,
                fontSize: 13,
                color: muted ? colors.textMuted : colors.text,
            }}
        >
            {children}
        </Text>
    )
}
