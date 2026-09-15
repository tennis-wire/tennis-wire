'use client'

import { useCallback, useEffect, useReducer, useRef } from 'react'

import { DiscussionError, NetworkError } from '@/lib/discussion/api'
import { ancestry, branch, listTopLevel, replies } from '@/lib/discussion/endpoints'
import { initial, reduce, type State } from '@/lib/discussion/tree'

// The URL names the comment the block is rooted on: `#c=<id>`. A permalink and a re-root are
// the same thing, and the back button undoes either.
const HASH = /^#c=([0-9a-f-]{36})$/i

export function rootedId(hash: string): string | null {
    return HASH.exec(hash)?.[1] ?? null
}

export function hashFor(id: string): string {
    return `#c=${id}`
}

const isOffline = (error: unknown) => error instanceof NetworkError && error.reason === 'offline'

export type Discussion = {
    state: State
    load: () => void
    loadMore: () => void
    showReplies: (id: string) => void
    moreReplies: (id: string, cursor: string | null | undefined) => void
    reveal: (id: string) => void
    reroot: (id: string) => void
    backToAll: () => void
}

export function useDiscussion(subjectType: string, subjectId: string): Discussion {
    const [state, dispatch] = useReducer(reduce, initial)
    // the generation of the last full load: an answer to an earlier one is dropped
    const generation = useRef(0)

    const loadList = useCallback(async () => {
        const mine = ++generation.current
        dispatch({ type: 'loading' })
        try {
            const page = await listTopLevel(subjectType, subjectId)
            if (mine === generation.current) dispatch({ type: 'list', page })
        } catch (error) {
            if (mine === generation.current) dispatch({ type: 'failed', offline: isOffline(error) })
        }
    }, [subjectType, subjectId])

    const loadRooted = useCallback(async (id: string) => {
        const mine = ++generation.current
        dispatch({ type: 'loading' })
        try {
            const [chain, root] = await Promise.all([ancestry(id), branch(id)])
            if (mine === generation.current)
                dispatch({ type: 'rooted', chain: chain.chain, root: root.root })
        } catch (error) {
            if (mine !== generation.current) return
            if (error instanceof DiscussionError && error.status === 404) {
                dispatch({ type: 'missing' })
                return
            }
            dispatch({ type: 'failed', offline: isOffline(error) })
        }
    }, [])

    // What the URL says the block should show
    const load = useCallback(() => {
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
        } catch {
            dispatch({ type: 'replies-failed', id })
        }
    }, [])

    const moreReplies = useCallback(async (id: string, cursor: string | null | undefined) => {
        dispatch({ type: 'replies-loading', id })
        try {
            const page = await replies(id, cursor)
            dispatch({ type: 'replies-loaded', id, page })
        } catch {
            dispatch({ type: 'replies-failed', id })
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
        void loadList()
    }, [loadList])

    useEffect(() => {
        const onHash = () => load()
        window.addEventListener('hashchange', onHash)
        return () => window.removeEventListener('hashchange', onHash)
    }, [load])

    // Back online: the block loads itself (§3.20). Only after a failure for that reason —
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
    }
}
