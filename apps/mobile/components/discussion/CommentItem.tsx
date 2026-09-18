// Mirrors public-web/components/discussion/CommentItem.tsx.
//
// Real differences:
// - No DOM ids: web sets id={comment-<id>} for Comments.tsx's scrollIntoView(highlight). The
//   mobile Comments screen will need its own way to scroll to a highlighted comment (measuring
//   a ref, most likely); wired when that screen is built, not here.
// - color-mix() backgrounds become #RRGGBBAA hex, same trick as RestrictionPlate.
// - ctx gains onSignIn: () => void, wired to CommentMenu's own onSignIn and used in the
//   "sign in to reply" line below, in place of web's link to a return-to URL.
// - Nested-Text onPress has no tap feedback in RN; accepted throughout, as in every other file
//   in this port that uses inline text actions.

import { View } from 'react-native'

import type { BlockMode } from '../../lib/discussion/modes'
import type { ReportReason } from '../../lib/discussion/reasons'
import type { Node } from '../../lib/discussion/tree'
import type { Author, Restriction } from '../../lib/discussion/types'
import { useTheme } from '../../theme'
import { Text } from '../ui'
import Avatar from '../Avatar'
import CommentBody, { Placeholder, placeholderFor } from './CommentBody'
import CommentMenu from './CommentMenu'
import ComposeForm from './ComposeForm'
import RestrictionPlate from './RestrictionPlate'
import { formatWhen } from './format'
import { strings } from './strings'
import { discussionStyles } from './styles'

// What every comment on the screen shares: who is reading, what is open, and the handlers
export type Ctx = {
    highlight: string | null
    replyingTo: string | null
    mutedUnder: string | null
    // the reader's draft key for a form under this comment, or null when none can be kept
    draftKeyFor: (parentId: string) => string | null
    signedIn: boolean
    // what stops the reader writing, known with the screen: "Reply" opens the plate instead of a form
    restriction: Restriction | null
    // the reader's own id, to tell his comments from the rest; null while unknown
    userId: string | null
    onShowReplies: (id: string) => void
    onMoreReplies: (id: string, cursor: string | null | undefined) => void
    onReveal: (id: string) => void
    onReroot: (id: string) => void
    onOpenReply: (id: string) => void
    onCloseReply: () => void
    onReply: (
        parentId: string,
        body: string,
        inline: boolean,
        idempotencyKey: string
    ) => Promise<void>
    onPromote: (text: string) => void
    onSessionExpired: () => void
    onRemove: (id: string) => Promise<void>
    onReport: (id: string, reason: ReportReason) => Promise<void>
    onIgnore: (commentId: string, authorId: string, mode: BlockMode) => Promise<void>
    onUnignore: (authorId: string) => Promise<void>
    // opens the sign-in flow directly; web links to a return-to URL instead
    onSignIn: () => void
}

type Props = {
    node: Node
    // whether the direct replies are drawn under this comment. Where they are not, the reader
    // gets there by re-rooting on it: the first level inline, deeper by re-root
    inline: boolean
    ctx: Ctx
}

export function AuthorName({ author }: { author?: Author }) {
    const { colors } = useTheme()
    if (!author) return <Text style={{ fontWeight: '600', fontSize: 15 }}>{strings.nobody}</Text>
    // the label stands instead of the name, and the server sends no name at all
    if ('restricted' in author)
        return (
            <Text style={{ fontWeight: '600', fontSize: 15, color: colors.textMuted }}>
                {strings.restricted}
            </Text>
        )
    return <Text style={{ fontWeight: '600', fontSize: 15 }}>{author.displayName}</Text>
}

// The same circle the header draws, and the same emptiness where there is no author
function authorFace(author?: Author) {
    if (!author || 'restricted' in author) return <Avatar size={36} />
    return <Avatar name={author.displayName} size={36} />
}

export default function CommentItem({ node, inline, ctx }: Props) {
    const { colors } = useTheme()
    const styles = discussionStyles(colors)
    const { comment } = node
    const collapsed = comment.visibility === 'soft_hidden' && !node.revealed
    // a live comment: the one kind that takes a reply
    const readable =
        comment.visibility === 'visible' || (comment.visibility === 'soft_hidden' && node.revealed)
    const replying = ctx.replyingTo === comment.id
    const own = ctx.userId !== null && comment.author?.id === ctx.userId
    // a line down to a button would say there is a thread where there is only an offer to load one
    const threaded = (replying && readable) || (node.replies?.length ?? 0) > 0
    const isHighlighted = ctx.highlight === comment.id

    return (
        <View
            style={[
                { paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.border },
                isHighlighted && {
                    backgroundColor: `${colors.accentSoft}59`,
                    marginHorizontal: -12,
                    paddingHorizontal: 12,
                    borderRadius: 6,
                },
            ]}
        >
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'stretch' }}>
                <View style={{ alignItems: 'center', flexShrink: 0 }}>
                    {collapsed || !readable ? (
                        <View
                            style={{
                                width: 36,
                                height: 36,
                                borderRadius: 18,
                                borderWidth: 1,
                                borderStyle: 'dashed',
                                borderColor: colors.border,
                            }}
                        />
                    ) : (
                        authorFace(comment.author)
                    )}
                    {threaded && (
                        <View
                            style={{
                                flex: 1,
                                width: 2,
                                marginTop: 8,
                                borderRadius: 1,
                                backgroundColor: colors.border,
                            }}
                        />
                    )}
                </View>
                <View style={{ flex: 1 }}>
                    {collapsed ? (
                        <Text style={{ ...styles.muted, fontSize: 14, minHeight: 36 }}>
                            {strings.ignoring} ·{' '}
                            <Text style={styles.action} onPress={() => ctx.onReveal(comment.id)}>
                                {strings.reveal}
                            </Text>
                        </Text>
                    ) : readable ? (
                        <>
                            <View
                                style={{
                                    flexDirection: 'row',
                                    gap: 10,
                                    alignItems: 'center',
                                    minHeight: 24,
                                }}
                            >
                                <AuthorName author={comment.author} />
                                <Text style={styles.muted}>{formatWhen(comment.createdAt)}</Text>
                                <CommentMenu
                                    comment={comment}
                                    own={own}
                                    signedIn={ctx.signedIn}
                                    onRemove={() => ctx.onRemove(comment.id)}
                                    onReport={(reason) => ctx.onReport(comment.id, reason)}
                                    onIgnore={(authorId, mode) =>
                                        ctx.onIgnore(comment.id, authorId, mode)
                                    }
                                    onUnignore={ctx.onUnignore}
                                    onSessionExpired={ctx.onSessionExpired}
                                    onSignIn={ctx.onSignIn}
                                />
                            </View>
                            {comment.body !== undefined && <CommentBody body={comment.body} />}
                            <Text
                                style={[styles.action, { marginTop: 10 }]}
                                onPress={() => ctx.onOpenReply(comment.id)}
                            >
                                {strings.reply}
                            </Text>
                        </>
                    ) : (
                        <>
                            <View
                                style={{
                                    flexDirection: 'row',
                                    gap: 10,
                                    alignItems: 'center',
                                    minHeight: 24,
                                }}
                            >
                                <Text style={styles.muted}>{formatWhen(comment.createdAt)}</Text>
                            </View>
                            <Placeholder>
                                {placeholderFor(
                                    comment.visibility as 'gravestone' | 'deleted' | 'removed'
                                )}
                            </Placeholder>
                        </>
                    )}
                    {replying && readable && (
                        <View style={{ marginTop: 8 }}>
                            {ctx.signedIn && ctx.restriction ? (
                                <RestrictionPlate until={ctx.restriction.until} />
                            ) : ctx.signedIn ? (
                                <ComposeForm
                                    draftKey={ctx.draftKeyFor(comment.id)}
                                    placeholder={strings.yourReply}
                                    autoFocus
                                    onSubmit={(body, idempotencyKey) =>
                                        ctx.onReply(comment.id, body, inline, idempotencyKey)
                                    }
                                    onCancel={ctx.onCloseReply}
                                    onParentDeleted={ctx.onPromote}
                                    onSessionExpired={ctx.onSessionExpired}
                                />
                            ) : (
                                <Text style={styles.muted}>
                                    {strings.signInToReply} ·{' '}
                                    <Text style={{ color: colors.primary }} onPress={ctx.onSignIn}>
                                        {strings.signIn}
                                    </Text>
                                </Text>
                            )}
                        </View>
                    )}

                    {ctx.mutedUnder === comment.id && (
                        <Text
                            style={{
                                marginTop: 8,
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                borderRadius: 6,
                                backgroundColor: colors.bgAlt,
                                fontSize: 13,
                            }}
                        >
                            {strings.mutedByRecipient}
                        </Text>
                    )}

                    <Replies node={node} inline={inline} ctx={ctx} />
                </View>
            </View>
        </View>
    )
}

function Replies({ node, inline, ctx }: Props) {
    const { colors } = useTheme()
    const styles = discussionStyles(colors)
    const { comment } = node
    if (comment.replyCount === 0 && node.replies === null) return null

    // Not drawn here: one control, and it re-roots
    if (!inline) {
        return (
            <Text
                style={[styles.linkButton, { marginTop: 8 }]}
                onPress={() => ctx.onReroot(comment.id)}
            >
                {strings.showReplies(comment.replyCount)}
            </Text>
        )
    }

    if (node.replies === null) {
        return (
            <View style={{ marginTop: 8 }}>
                {node.failed ? (
                    <Text>
                        <Text style={styles.muted}>{strings.repliesFailed} </Text>
                        <Text style={styles.action} onPress={() => ctx.onShowReplies(comment.id)}>
                            {strings.retry}
                        </Text>
                    </Text>
                ) : (
                    <Text
                        style={[styles.linkButton, node.loading && { opacity: 0.5 }]}
                        onPress={node.loading ? undefined : () => ctx.onShowReplies(comment.id)}
                    >
                        {node.loading ? strings.loading : strings.showReplies(comment.replyCount)}
                    </Text>
                )}
            </View>
        )
    }

    return (
        <View style={{ marginTop: 4 }}>
            {node.replies.length === 0 && comment.replyCount > 0 && (
                <Text style={[styles.muted, { marginTop: 8 }]}>{strings.noRepliesLeft}</Text>
            )}
            {node.replies.map((reply) => (
                <CommentItem key={reply.comment.id} node={reply} inline={false} ctx={ctx} />
            ))}
            {node.hasMore && (
                <Text style={{ marginTop: 8 }}>
                    {node.failed && <Text style={styles.muted}>{strings.repliesFailed} </Text>}
                    <Text
                        style={[
                            node.failed ? styles.action : styles.linkButton,
                            node.loading && { opacity: 0.5 },
                        ]}
                        onPress={
                            node.loading
                                ? undefined
                                : () => ctx.onMoreReplies(comment.id, node.cursor)
                        }
                    >
                        {node.loading
                            ? strings.loading
                            : node.failed
                              ? strings.retry
                              : strings.moreReplies}
                    </Text>
                </Text>
            )}
        </View>
    )
}
