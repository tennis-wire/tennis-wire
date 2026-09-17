// Mirrors public-web/components/discussion/useDiscussion.ts. Two real differences, both forced
// by there being no window here:
//
// - Re-rooting (public-web's `#c=<id>` hash) becomes an explicit rootedId/setRootedId pair the
//   caller owns instead of something this hook reads off the URL. The natural mobile home for
//   that state is a route param, so the OS back gesture un-roots the same way the browser back
//   button does on web -- but that is the screen's call, not this hook's, so it just takes
//   whatever setRootedId the screen hands it.
// - accessToken comes from useReaderSession() directly rather than a proxy route reading a
//   cookie. Reads pass it through as optional (an anonymous reader can still read); every write
//   throws up front if there is none, rather than letting the server's 401 explain it.
//
// Not carried over: the 'online' listener that reloads a failed-offline block on reconnect.
// web uses `window.addEventListener('online', ...)`; the RN equivalent needs
// @react-native-community/netinfo, a new dependency this pass does not add. waitingForNetwork
// is still computed, so a screen can show its own retry affordance meanwhile.

import { useCallback, useReducer, useRef, useState } from 'react'

import { useReaderSession } from '../auth/ReaderSessionProvider'
import { DiscussionError, NetworkError } from '../../lib/discussion/api'
import {
    ancestry,
    branch,
    createComment,
    createReply,
    deleteComment,
    listTopLevel,
    removeBlock,
    replies,
    reportComment,
    setBlock,
} from '../../lib/discussion/endpoints'
import type { BlockMode } from '../../lib/discussion/modes'
import type { ReportReason } from '../../lib/discussion/reasons'
import { markReported } from '../../lib/discussion/reported'
import { initial, reduce, type Action, type State } from '../../lib/discussion/tree'

export type Seed = { text: string; at: number }

const isOffline = (error: unknown) => error instanceof NetworkError && error.reason === 'offline'

// The ids a HIDDEN_BY_BLOCK answer names; anything else in their place is not taken for an id
function blockedIdsOf(error: DiscussionError): string[] {
    const ids = error.details.blockedIds
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []
}

// A 404 while reading replies: the comment is not there for this reader any more, whether it came
// down or his own ignore, set on another device, hides it. It leaves the tree as it does on an action
function vanishedOn(error: unknown, id: string): Action | null {
    if (!(error instanceof DiscussionError) || error.status !== 404) return null
    if (error.code === 'HIDDEN_BY_BLOCK')
        return { type: 'vanished', id, blockedIds: blockedIdsOf(error) }
    return { type: 'vanished', id }
}

export type Discussion = {
    state: State
    load: () => void
    loadMore: () => void
    showReplies: (id: string) => void
    moreReplies: (id: string, cursor: string | null | undefined) => void
    reveal: (id: string) => void
    reroot: (id: string) => void
    backToAll: () => void

    // one reply form open at a time
    replyingTo: string | null
    openReply: (id: string) => void
    closeReply: () => void
    // the reader's own writing; both throw for the form to explain (not signed in included)
    post: (body: string, idempotencyKey: string) => Promise<void>
    // inline: the parent's replies are drawn where it stands. Otherwise the block re-roots on the
    // parent, so the reader sees the reply in its place
    reply: (
        parentId: string,
        body: string,
        inline: boolean,
        idempotencyKey: string
    ) => Promise<void>
    // the parent whose author ignores the reader, told once after the reply went up
    mutedUnder: string | null
    // text taken from a reply whose parent is gone, for the top-level form
    seed: Seed | null
    promote: (text: string) => void
    // the reader's own comment taken down; throws for the caller to explain
    remove: (id: string) => Promise<void>
    // a comment the server no longer has, met on the way: out of the tree
    drop: (id: string) => void
    // a report on someone else's comment; throws for the caller to explain. A comment that is
    // no longer there is dropped from the tree and nothing is said
    report: (id: string, reason: ReportReason) => Promise<void>
    // the reader ignores the author of a comment, or changes how, and the screen shows it at once;
    // throws for the caller to explain. An author whose account is gone takes the comment with him
    ignore: (commentId: string, authorId: string, mode: BlockMode) => Promise<void>
    // the reader stops ignoring the author; throws for the caller to explain
    unignore: (authorId: string) => Promise<void>
}

export function useDiscussion(
    subjectType: string,
    subjectId: string,
    rootedId: string | null,
    setRootedId: (id: string | null) => void
): Discussion {
    const { accessToken } = useReaderSession()
    const [state, dispatch] = useReducer(reduce, initial)
    const [replyingTo, setReplyingTo] = useState<string | null>(null)
    const [mutedUnder, setMutedUnder] = useState<string | null>(null)
    const [seed, setSeed] = useState<Seed | null>(null)
    // the generation of the last full load: an answer to an earlier one is dropped
    const generation = useRef(0)
    // what the next re-rooted view carries over from the reply that caused it: the comment to
    // light up instead of the root, and the parent whose author ignores the reader
    const pendingHighlight = useRef<string | null>(null)
    const pendingMuted = useRef<string | null>(null)

    const requireToken = useCallback((): string => {
        if (!accessToken) throw new Error('not signed in')
        return accessToken
    }, [accessToken])

    const loadList = useCallback(async () => {
        const mine = ++generation.current
        dispatch({ type: 'loading' })
        try {
            const page = await listTopLevel(
                subjectType,
                subjectId,
                undefined,
                accessToken ?? undefined
            )
            if (mine === generation.current) {
                setMutedUnder(null)
                dispatch({ type: 'list', page })
            }
        } catch (error) {
            if (mine === generation.current) dispatch({ type: 'failed', offline: isOffline(error) })
        }
    }, [subjectType, subjectId, accessToken])

    const loadRooted = useCallback(
        async (id: string) => {
            const mine = ++generation.current
            const highlight = pendingHighlight.current ?? undefined
            const muted = pendingMuted.current
            pendingHighlight.current = null
            pendingMuted.current = null
            dispatch({ type: 'loading' })
            try {
                const token = accessToken ?? undefined
                const [chain, root] = await Promise.all([ancestry(id, token), branch(id, token)])
                if (mine === generation.current) {
                    setMutedUnder(muted)
                    dispatch({
                        type: 'rooted',
                        chain: chain.chain,
                        root: root.root,
                        highlight,
                        restriction: chain.viewer?.restriction ?? null,
                    })
                }
            } catch (error) {
                if (mine !== generation.current) return
                if (error instanceof DiscussionError && error.code === 'HIDDEN_BY_BLOCK') {
                    dispatch({ type: 'hidden', blockedIds: blockedIdsOf(error) })
                    return
                }
                if (error instanceof DiscussionError && error.status === 404) {
                    dispatch({ type: 'missing' })
                    return
                }
                dispatch({ type: 'failed', offline: isOffline(error) })
            }
        },
        [accessToken]
    )

    // What rootedId says the block should show
    const load = useCallback(() => {
        setReplyingTo(null)
        if (rootedId) void loadRooted(rootedId)
        else void loadList()
    }, [rootedId, loadList, loadRooted])

    const loadMore = useCallback(async () => {
        if (state.phase !== 'ready' || state.view.kind !== 'list') return
        const { nextCursor, more } = state.view
        if (!nextCursor || more === 'loading') return
        dispatch({ type: 'more', status: 'loading' })
        try {
            const page = await listTopLevel(
                subjectType,
                subjectId,
                nextCursor,
                accessToken ?? undefined
            )
            dispatch({ type: 'more-loaded', page })
        } catch {
            dispatch({ type: 'more', status: 'failed' })
        }
    }, [state, subjectType, subjectId, accessToken])

    const showReplies = useCallback(
        async (id: string) => {
            dispatch({ type: 'replies-loading', id })
            try {
                const { root } = await branch(id, accessToken ?? undefined)
                dispatch({ type: 'branch-loaded', id, root })
            } catch (error) {
                dispatch(vanishedOn(error, id) ?? { type: 'replies-failed', id })
            }
        },
        [accessToken]
    )

    const moreReplies = useCallback(
        async (id: string, cursor: string | null | undefined) => {
            dispatch({ type: 'replies-loading', id })
            try {
                const page = await replies(id, cursor, accessToken ?? undefined)
                dispatch({ type: 'replies-loaded', id, page })
            } catch (error) {
                dispatch(vanishedOn(error, id) ?? { type: 'replies-failed', id })
            }
        },
        [accessToken]
    )

    const reveal = useCallback((id: string) => dispatch({ type: 'reveal', id }), [])

    // setRootedId is whatever the screen backs with -- a route param, typically, so the OS back
    // gesture leaves it the way the browser back button leaves a hashchange on web
    const reroot = useCallback((id: string) => setRootedId(id), [setRootedId])

    const backToAll = useCallback(() => {
        setRootedId(null)
        load()
    }, [setRootedId, load])

    const post = useCallback(
        async (body: string, idempotencyKey: string) => {
            const { comment } = await createComment(
                subjectType,
                subjectId,
                body,
                idempotencyKey,
                requireToken()
            )
            dispatch({ type: 'posted', comment })
        },
        [subjectType, subjectId, requireToken]
    )

    const reply = useCallback(
        async (parentId: string, body: string, inline: boolean, idempotencyKey: string) => {
            const { comment, mutedByRecipient } = await createReply(
                parentId,
                body,
                idempotencyKey,
                requireToken()
            )
            setReplyingTo(null)
            if (inline) {
                setMutedUnder(mutedByRecipient ? parentId : null)
                dispatch({ type: 'replied', parentId, comment })
                return
            }
            pendingHighlight.current = comment.id
            pendingMuted.current = mutedByRecipient ? parentId : null
            setRootedId(parentId)
        },
        [requireToken, setRootedId]
    )

    const promote = useCallback(
        (text: string) => {
            setSeed({ text, at: Date.now() })
            setReplyingTo(null)
            // the top-level form lives on the list; a re-rooted view has none
            if (rootedId) backToAll()
        },
        [rootedId, backToAll]
    )

    const remove = useCallback(
        async (id: string) => {
            try {
                await deleteComment(id, requireToken())
            } catch (error) {
                // already gone, by another device or by moderation: the outcome is the one asked for
                if (!(error instanceof DiscussionError && error.status === 404)) throw error
            }
            setReplyingTo((open) => (open === id ? null : open))
            dispatch({ type: 'deleted', id })
        },
        [requireToken]
    )

    const drop = useCallback((id: string) => dispatch({ type: 'vanished', id }), [])

    const report = useCallback(
        async (id: string, reason: ReportReason) => {
            try {
                await reportComment(id, reason, requireToken())
            } catch (error) {
                if (error instanceof DiscussionError && error.status === 404) {
                    dispatch({ type: 'vanished', id })
                    return
                }
                throw error
            }
            void markReported(id)
        },
        [requireToken]
    )

    const ignore = useCallback(
        async (commentId: string, authorId: string, mode: BlockMode) => {
            try {
                await setBlock(authorId, mode, requireToken())
            } catch (error) {
                if (error instanceof DiscussionError && error.status === 404) {
                    dispatch({ type: 'vanished', id: commentId })
                    return
                }
                throw error
            }
            dispatch({ type: 'ignored', authorId, mode })
        },
        [requireToken]
    )

    const unignore = useCallback(
        async (authorId: string) => {
            await removeBlock(authorId, requireToken())
            dispatch({ type: 'unignored', authorId })
        },
        [requireToken]
    )

    return {
        state,
        load,
        loadMore: () => void loadMore(),
        showReplies: (id) => void showReplies(id),
        moreReplies: (id, cursor) => void moreReplies(id, cursor),
        reveal,
        reroot,
        backToAll,
        replyingTo,
        openReply: setReplyingTo,
        closeReply: () => setReplyingTo(null),
        post,
        reply,
        mutedUnder,
        seed,
        promote,
        remove,
        drop,
        report,
        ignore,
        unignore,
    }
}
