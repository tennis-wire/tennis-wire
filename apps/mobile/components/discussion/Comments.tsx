// Mirrors public-web/components/discussion/Comments.tsx, the screen-level piece that ties
// useDiscussion, CommentItem, ComposeForm and HiddenBranch together.
//
// Real differences:
// - rootedId lives in this component's own useState rather than a route param. web's browser
//   back button un-roots via the #c=<id> hash; on mobile that would need material-detail's
//   route to carry a `c` param and this component to read/write it through the router, which
//   is a real change to that screen's shape. Kept as local state for this pass: the device back
//   button leaves the screen entirely instead of un-rooting first. A reasonable follow-up, not
//   attempted here.
// - Load-on-scroll-near (web's IntersectionObserver) becomes load-on-mount: RN has no
//   IntersectionObserver, and comments are one screen a reader is already committed to by the
//   time they reach this component, unlike a web page where they might not scroll that far.
// - Scrolling to the highlighted comment after a reply (web's scrollIntoView) is not attempted
//   here. This component is meant to sit inside material-detail's own ScrollView, not own one
//   itself (comments scroll with the article, same as web), so doing this properly means
//   measuring a ref against a ScrollView this component does not hold. The highlight still
//   applies visually (CommentItem's tinted background); only the auto-scroll is missing.
// - "Sign in to comment" calls onSignIn() (useReaderSession().login) instead of linking to a
//   URL with a returnTo param, same reasoning as everywhere else in this port.

import { useCallback, useEffect, useState } from 'react'
import { View } from 'react-native'

import { useReaderSession } from '../auth/ReaderSessionProvider'
import { draftKey, sweepDrafts } from '../../lib/discussion/drafts'
import { useTheme } from '../../theme'
import { Text } from '../ui'
import CommentBody, { Placeholder, placeholderFor } from './CommentBody'
import CommentItem, { AuthorName, type Ctx } from './CommentItem'
import ComposeForm from './ComposeForm'
import HiddenBranch from './HiddenBranch'
import RestrictionPlate from './RestrictionPlate'
import { formatWhen } from './format'
import { strings } from './strings'
import { discussionStyles } from './styles'
import { useDiscussion } from './useDiscussion'

type Props = { subjectType: string; subjectId: string }

export default function Comments({ subjectType, subjectId }: Props) {
    const [rootedId, setRootedId] = useState<string | null>(null)
    const discussion = useDiscussion(subjectType, subjectId, rootedId, setRootedId)
    const { session, login } = useReaderSession()
    const { state, load } = discussion
    // the last write met a session that was no longer there
    const [sessionExpired, setSessionExpired] = useState(false)

    useEffect(() => {
        void sweepDrafts()
        load()
        // subjectId/rootedId are the real triggers; load's own identity also changes on every
        // accessToken refresh, which would refire this for no reason
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [subjectId, rootedId])

    const highlight = state.phase === 'ready' ? state.highlight : null
    const restriction = state.phase === 'ready' ? state.restriction : null

    const signedIn = session?.authenticated === true
    const userId = session?.authenticated ? session.userId : null
    const draftKeyFor = useCallback(
        (parentId: string | null) => (userId ? draftKey(userId, subjectId, parentId) : null),
        [userId, subjectId]
    )
    const onSessionExpired = useCallback(() => setSessionExpired(true), [])
    const onSignIn = useCallback(() => void login(), [login])

    const ctx: Ctx = {
        highlight,
        replyingTo: discussion.replyingTo,
        mutedUnder: discussion.mutedUnder,
        draftKeyFor,
        signedIn,
        restriction,
        userId,
        onShowReplies: discussion.showReplies,
        onMoreReplies: discussion.moreReplies,
        onReveal: discussion.reveal,
        onReroot: discussion.reroot,
        onOpenReply: discussion.openReply,
        onCloseReply: discussion.closeReply,
        onReply: discussion.reply,
        onPromote: discussion.promote,
        onSessionExpired,
        onRemove: discussion.remove,
        onReport: discussion.report,
        onIgnore: discussion.ignore,
        onUnignore: discussion.unignore,
        onSignIn,
    }

    return (
        <View accessibilityLiveRegion="polite">
            <Text variant="h1" style={{ marginBottom: 20 }}>
                {strings.heading}
            </Text>
            <Body
                discussion={discussion}
                ctx={ctx}
                sessionKnown={session !== null}
                sessionExpired={sessionExpired}
                draftKey={draftKeyFor(null)}
            />
        </View>
    )
}

type BodyProps = {
    discussion: ReturnType<typeof useDiscussion>
    ctx: Ctx
    sessionKnown: boolean
    sessionExpired: boolean
    draftKey: string | null
}

function Body({ discussion, ctx, sessionKnown, sessionExpired, draftKey }: BodyProps) {
    const { colors } = useTheme()
    const styles = discussionStyles(colors)
    const { state, load, loadMore, reroot, backToAll, post, seed } = discussion

    switch (state.phase) {
        case 'idle':
        case 'loading':
            return <Text style={styles.muted}>{strings.loading}</Text>
        case 'failed':
            return (
                <Text style={styles.muted}>
                    {state.offline ? strings.offline : strings.loadFailed}{' '}
                    <Text style={styles.linkButton} onPress={load}>
                        {strings.retry}
                    </Text>
                </Text>
            )
        case 'gone':
            return (
                <Text style={styles.muted}>
                    {strings.gone}{' '}
                    <Text style={styles.linkButton} onPress={backToAll}>
                        {strings.allComments}
                    </Text>
                </Text>
            )
        case 'missing':
            return (
                <Text style={styles.muted}>
                    {strings.missing}{' '}
                    <Text style={styles.linkButton} onPress={backToAll}>
                        {strings.allComments}
                    </Text>
                </Text>
            )
        case 'hidden':
            return (
                <HiddenBranch
                    blockedIds={state.blockedIds}
                    onChanged={load}
                    onBack={backToAll}
                    onSessionExpired={ctx.onSessionExpired}
                    onSignIn={ctx.onSignIn}
                />
            )
    }

    const { view } = state

    if (view.kind === 'rooted') {
        const context = view.chain.slice(0, -1)
        return (
            <View>
                <Text style={[styles.action, { marginBottom: 16 }]} onPress={backToAll}>
                    ← {strings.allComments}
                </Text>
                {/* Context only: a collapsed comment stays collapsed here, name and all */}
                {context.length > 0 && (
                    <View
                        style={{
                            borderLeftWidth: 2,
                            borderLeftColor: colors.border,
                            paddingLeft: 14,
                            marginBottom: 12,
                        }}
                    >
                        <Text style={[styles.muted, { marginBottom: 4 }]}>{strings.inReplyTo}</Text>
                        {context.map((comment) => (
                            <View key={comment.id} style={{ paddingVertical: 6 }}>
                                <View
                                    style={{
                                        flexDirection: 'row',
                                        gap: 10,
                                        alignItems: 'baseline',
                                    }}
                                >
                                    {comment.visibility === 'visible' && (
                                        <AuthorName author={comment.author} />
                                    )}
                                    <Text
                                        style={[styles.linkButton, styles.muted]}
                                        onPress={() => reroot(comment.id)}
                                    >
                                        {formatWhen(comment.createdAt)}
                                    </Text>
                                </View>
                                {comment.visibility === 'visible' && comment.body !== undefined ? (
                                    <CommentBody body={comment.body} />
                                ) : (
                                    <Placeholder>
                                        {comment.visibility === 'soft_hidden'
                                            ? strings.ignoring
                                            : placeholderFor(
                                                  comment.visibility as
                                                      'gravestone' | 'deleted' | 'removed'
                                              )}
                                    </Placeholder>
                                )}
                            </View>
                        ))}
                    </View>
                )}
                <CommentItem node={view.root} inline ctx={ctx} />
            </View>
        )
    }

    return (
        <View>
            {/* The form waits for the session to be known: a signed-in reader should not see
                the invitation to sign in flash first */}
            {sessionKnown && (
                <View style={{ marginBottom: 24 }}>
                    {ctx.signedIn && ctx.restriction ? (
                        <RestrictionPlate until={ctx.restriction.until} />
                    ) : ctx.signedIn ? (
                        <ComposeForm
                            draftKey={draftKey}
                            seed={seed}
                            placeholder={strings.yourComment}
                            onSubmit={post}
                            onSessionExpired={ctx.onSessionExpired}
                        />
                    ) : (
                        <Text
                            style={{
                                borderWidth: 1,
                                borderColor: colors.border,
                                borderRadius: 10,
                                paddingHorizontal: 16,
                                paddingVertical: 14,
                                fontSize: 14,
                                color: colors.textSecondary,
                            }}
                        >
                            {sessionExpired ? strings.sessionExpired : strings.signInToComment} ·{' '}
                            <Text style={{ color: colors.primary }} onPress={ctx.onSignIn}>
                                {strings.signIn}
                            </Text>
                        </Text>
                    )}
                </View>
            )}
            {view.items.length === 0 ? (
                <Text style={styles.muted}>{strings.none}</Text>
            ) : (
                view.items.map((node) => (
                    <CommentItem key={node.comment.id} node={node} inline ctx={ctx} />
                ))
            )}
            {view.nextCursor && (
                <Text style={{ marginTop: 12 }}>
                    {view.more === 'failed' && (
                        <Text style={styles.muted}>{strings.moreFailed} </Text>
                    )}
                    <Text
                        style={[styles.linkButton, view.more === 'loading' && { opacity: 0.5 }]}
                        onPress={view.more === 'loading' ? undefined : loadMore}
                    >
                        {view.more === 'loading'
                            ? strings.loading
                            : view.more === 'failed'
                              ? strings.retry
                              : strings.more}
                    </Text>
                </Text>
            )}
        </View>
    )
}
