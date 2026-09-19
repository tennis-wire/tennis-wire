'use client'

import { useCallback, useEffect, useReducer, useRef, useState } from 'react'

import { DiscussionError, NetworkError } from '@/lib/discussion/api'
import {
    ancestry,
    branch,
    createComment,
    createReply,
    clearReaction,
    deleteComment,
    editComment,
    listTopLevel,
    removeBlock,
    replies,
    reportComment,
    setBlock,
    setReaction,
} from '@/lib/discussion/endpoints'
import type { BlockMode } from '@/lib/discussion/modes'
import { heldBy } from '@/lib/discussion/reactions'
import type { ReportReason } from '@/lib/discussion/reasons'
import { markReported } from '@/lib/discussion/reported'
import { initial, reduce, type Action, type State } from '@/lib/discussion/tree'

import type { Comment, ReactionSlot } from '@/lib/discussion/types'

import type { Seed } from './ComposeForm'

// The URL names the comment the block is rooted on: `#c=<id>`. A permalink and a re-root are
// the same thing, and the back button undoes either.
const HASH = /^#c=([0-9a-f-]{36})$/i

// How long a reaction waits before it goes out. Long enough to swallow a change of mind, short
// enough that leaving the page right after a tap still sends it.
const SETTLE_MS = 400

export function rootedId(hash: string): string | null {
    return HASH.exec(hash)?.[1] ?? null
}

export function hashFor(id: string): string {
    return `#c=${id}`
}

const isOffline = (error: unknown) => error instanceof NetworkError && error.reason === 'offline'

// The ids a HIDDEN_BY_BLOCK answer names; anything else in their place is not taken for an id
function blockedIdsOf(error: DiscussionError): string[] {
    const ids = error.details.blockedIds
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []
}

// A 404 while reading replies: the comment is not there for this reader any more, whether it came
// down or his own ignore, set in another tab, hides it. It leaves the tree as it does on an action
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
    // the reader's own writing; both throw for the form to explain
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
    // which of the reader's own comments has its edit form open
    editing: string | null
    openEdit: (id: string) => void
    closeEdit: () => void
    // the reader's own comment rewritten; throws for the caller to explain
    edit: (id: string, body: string) => Promise<void>
    // one of the reader's two slots on a comment, set or taken out. Drawn at once, sent once the
    // tapping stops, and put back the way it was if the service refuses.
    react: (comment: Comment, slot: ReactionSlot, to: string | null) => void
    // a comment the server no longer has, met on the way: out of the tree
    drop: (id: string) => void
    // a report on someone else's comment; throws for the caller to explain. A comment that is
    // no longer there is dropped from the tree and nothing is said
    report: (id: string, reason: ReportReason) => Promise<void>
    // the reader ignores the author of a comment, or changes how, and the page shows it at once;
    // throws for the caller to explain. An author whose account is gone takes the comment with him
    ignore: (commentId: string, authorId: string, mode: BlockMode) => Promise<void>
    // the reader stops ignoring the author; throws for the caller to explain
    unignore: (authorId: string) => Promise<void>
}

export function useDiscussion(subjectType: string, subjectId: string): Discussion {
    const [state, dispatch] = useReducer(reduce, initial)
    const [replyingTo, setReplyingTo] = useState<string | null>(null)
    const [editing, setEditing] = useState<string | null>(null)
    const [mutedUnder, setMutedUnder] = useState<string | null>(null)
    const [seed, setSeed] = useState<Seed | null>(null)
    // the generation of the last full load: an answer to an earlier one is dropped
    const generation = useRef(0)
    // what the next re-rooted view carries over from the reply that caused it: the comment to
    // light up instead of the root, and the parent whose author ignores the reader
    const pendingHighlight = useRef<string | null>(null)
    const pendingMuted = useRef<string | null>(null)

    const loadList = useCallback(async () => {
        const mine = ++generation.current
        dispatch({ type: 'loading' })
        try {
            const page = await listTopLevel(subjectType, subjectId)
            if (mine === generation.current) {
                setMutedUnder(null)
                dispatch({ type: 'list', page })
            }
        } catch (error) {
            if (mine === generation.current) dispatch({ type: 'failed', offline: isOffline(error) })
        }
    }, [subjectType, subjectId])

    const loadRooted = useCallback(async (id: string) => {
        const mine = ++generation.current
        const highlight = pendingHighlight.current ?? undefined
        const muted = pendingMuted.current
        pendingHighlight.current = null
        pendingMuted.current = null
        dispatch({ type: 'loading' })
        try {
            const [chain, root] = await Promise.all([ancestry(id), branch(id)])
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
    }, [])

    // What the URL says the block should show
    const load = useCallback(() => {
        setReplyingTo(null)
        const id = rootedId(window.location.hash)
        if (id) void loadRooted(id)
        else void loadList()
    }, [loadList, loadRooted])

    const loadMore = useCallback(async () => {
        if (state.phase !== 'ready' || state.view.kind !== 'list') return
        const { nextCursor, more } = state.view
        if (!nextCursor || more === 'loading') return
        dispatch({ type: 'more', status: 'loading' })
        try {
            const page = await listTopLevel(subjectType, subjectId, nextCursor)
            dispatch({ type: 'more-loaded', page })
        } catch {
            dispatch({ type: 'more', status: 'failed' })
        }
    }, [state, subjectType, subjectId])

    const showReplies = useCallback(async (id: string) => {
        dispatch({ type: 'replies-loading', id })
        try {
            const { root } = await branch(id)
            dispatch({ type: 'branch-loaded', id, root })
        } catch (error) {
            dispatch(vanishedOn(error, id) ?? { type: 'replies-failed', id })
        }
    }, [])

    const moreReplies = useCallback(async (id: string, cursor: string | null | undefined) => {
        dispatch({ type: 'replies-loading', id })
        try {
            const page = await replies(id, cursor)
            dispatch({ type: 'replies-loaded', id, page })
        } catch (error) {
            dispatch(vanishedOn(error, id) ?? { type: 'replies-failed', id })
        }
    }, [])

    const reveal = useCallback((id: string) => dispatch({ type: 'reveal', id }), [])

    const reroot = useCallback((id: string) => {
        // hashchange does the loading, so a permalink and a click go the same way
        window.location.hash = hashFor(id)
    }, [])

    const backToAll = useCallback(() => {
        // assigning an empty hash leaves a bare `#` behind, and fires no hashchange we could use
        window.history.pushState(null, '', window.location.pathname + window.location.search)
        load()
    }, [load])

    const post = useCallback(
        async (body: string, idempotencyKey: string) => {
            const { comment } = await createComment(subjectType, subjectId, body, idempotencyKey)
            dispatch({ type: 'posted', comment })
        },
        [subjectType, subjectId]
    )

    const reply = useCallback(
        async (parentId: string, body: string, inline: boolean, idempotencyKey: string) => {
            const { comment, mutedByRecipient } = await createReply(parentId, body, idempotencyKey)
            setReplyingTo(null)
            if (inline) {
                setMutedUnder(mutedByRecipient ? parentId : null)
                dispatch({ type: 'replied', parentId, comment })
                return
            }
            pendingHighlight.current = comment.id
            pendingMuted.current = mutedByRecipient ? parentId : null
            window.location.hash = hashFor(parentId)
        },
        []
    )

    const promote = useCallback(
        (text: string) => {
            setSeed({ text, at: Date.now() })
            setReplyingTo(null)
            // the top-level form lives on the list; a re-rooted view has none
            if (rootedId(window.location.hash)) backToAll()
        },
        [backToAll]
    )

    // Per comment and slot: the timer still to fire, and the value the service last confirmed, kept
    // from the first tap of a run so that a refusal puts back what was really there and not the
    // half-way state a later tap drew.
    const sending = useRef(
        new Map<string, { timer: ReturnType<typeof setTimeout>; confirmed: string | null }>()
    )

    const react = useCallback((comment: Comment, slot: ReactionSlot, to: string | null) => {
        const key = `${comment.id}:${slot}`
        const held = sending.current.get(key)
        const confirmed = held ? held.confirmed : heldBy(comment, slot)
        if (held) clearTimeout(held.timer)
        dispatch({ type: 'reacted', id: comment.id, slot, to })

        // A reader who taps like, thinks again and taps dislike sends one request, not three
        const timer = setTimeout(() => {
            sending.current.delete(key)
            const request =
                to === null ? clearReaction(comment.id, slot) : setReaction(comment.id, slot, to)
            request.catch(() => dispatch({ type: 'reacted', id: comment.id, slot, to: confirmed }))
        }, SETTLE_MS)
        sending.current.set(key, { timer, confirmed })
    }, [])

    const edit = useCallback(async (id: string, body: string) => {
        const edited = await editComment(id, body)
        setEditing(null)
        dispatch({ type: 'edited', id, body: edited.body, updatedAt: edited.updatedAt })
    }, [])

    const remove = useCallback(async (id: string) => {
        try {
            await deleteComment(id)
        } catch (error) {
            // already gone, by another tab or by moderation: the outcome is the one asked for
            if (!(error instanceof DiscussionError && error.status === 404)) throw error
        }
        setReplyingTo((open) => (open === id ? null : open))
        setEditing((open) => (open === id ? null : open))
        dispatch({ type: 'deleted', id })
    }, [])

    const drop = useCallback((id: string) => dispatch({ type: 'vanished', id }), [])

    const report = useCallback(async (id: string, reason: ReportReason) => {
        try {
            await reportComment(id, reason)
        } catch (error) {
            if (error instanceof DiscussionError && error.status === 404) {
                dispatch({ type: 'vanished', id })
                return
            }
            throw error
        }
        markReported(id)
    }, [])

    const ignore = useCallback(async (commentId: string, authorId: string, mode: BlockMode) => {
        try {
            await setBlock(authorId, mode)
        } catch (error) {
            if (error instanceof DiscussionError && error.status === 404) {
                dispatch({ type: 'vanished', id: commentId })
                return
            }
            throw error
        }
        dispatch({ type: 'ignored', authorId, mode })
    }, [])

    const unignore = useCallback(async (authorId: string) => {
        await removeBlock(authorId)
        dispatch({ type: 'unignored', authorId })
    }, [])

    useEffect(() => {
        const onHash = () => load()
        window.addEventListener('hashchange', onHash)
        return () => window.removeEventListener('hashchange', onHash)
    }, [load])

    // Back online: the block loads itself. Only after a failure for that reason:
    // a page that loaded fine does not reload on every network blip.
    const waitingForNetwork = state.phase === 'failed' && state.offline
    useEffect(() => {
        if (!waitingForNetwork) return
        window.addEventListener('online', load)
        return () => window.removeEventListener('online', load)
    }, [waitingForNetwork, load])

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
        editing,
        openEdit: setEditing,
        closeEdit: () => setEditing(null),
        edit,
        react,
        drop,
        report,
        ignore,
        unignore,
    }
}
