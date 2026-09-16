// The ignore list in the cabinet: pages of rows, and what is happening to each row

import type { Block, BlockPage } from './types'

// Why a change to a row did not go through
export type Reason = 'failed' | 'rate' | 'full'

// A save is a PUT: a new mode, or a lifted row put back. A lift is the DELETE.
export type Failure = { of: 'save' | 'lift'; reason: Reason }

export type Row = {
    block: Block
    // taken off the list here, and left standing so it can be put back
    lifted: boolean
    // a change on its way: the row takes no other until it lands
    busy: boolean
    failure: Failure | null
}

export type State =
    | { phase: 'loading' }
    | { phase: 'failed' }
    | { phase: 'ready'; rows: Row[]; cursor: string | null; more: 'idle' | 'loading' | 'failed' }

export type Action =
    | { type: 'loading' }
    | { type: 'loaded'; page: BlockPage }
    | { type: 'load-failed' }
    | { type: 'more-loading' }
    | { type: 'more-loaded'; page: BlockPage }
    | { type: 'more-failed' }
    | { type: 'busy'; blockedId: string }
    | { type: 'saved'; block: Block }
    | { type: 'lifted'; blockedId: string }
    | { type: 'failed'; blockedId: string; failure: Failure }
    // user-service no longer knows the person: nothing on the row can be done
    | { type: 'gone'; blockedId: string }

export const initial: State = { phase: 'loading' }

function row(block: Block): Row {
    return { block, lifted: false, busy: false, failure: null }
}

function change(state: State, blockedId: string, next: (current: Row) => Row): State {
    if (state.phase !== 'ready') return state
    return {
        ...state,
        rows: state.rows.map((current) =>
            current.block.blockedId === blockedId ? next(current) : current
        ),
    }
}

export function reduce(state: State, action: Action): State {
    switch (action.type) {
        case 'loading':
            return { phase: 'loading' }
        case 'loaded':
            return {
                phase: 'ready',
                rows: action.page.items.map(row),
                cursor: action.page.nextCursor,
                more: 'idle',
            }
        case 'load-failed':
            return { phase: 'failed' }
        case 'more-loading':
            return state.phase === 'ready' ? { ...state, more: 'loading' } : state
        case 'more-loaded':
            if (state.phase !== 'ready') return state
            return {
                ...state,
                rows: [...state.rows, ...action.page.items.map(row)],
                cursor: action.page.nextCursor,
                more: 'idle',
            }
        case 'more-failed':
            return state.phase === 'ready' ? { ...state, more: 'failed' } : state
        case 'busy':
            return change(state, action.blockedId, (current) => ({
                ...current,
                busy: true,
                failure: null,
            }))
        case 'saved':
            return change(state, action.block.blockedId, () => row(action.block))
        case 'lifted':
            return change(state, action.blockedId, (current) => ({
                ...current,
                lifted: true,
                busy: false,
            }))
        case 'failed':
            return change(state, action.blockedId, (current) => ({
                ...current,
                busy: false,
                failure: action.failure,
            }))
        case 'gone':
            if (state.phase !== 'ready') return state
            return {
                ...state,
                rows: state.rows.filter((current) => current.block.blockedId !== action.blockedId),
            }
    }
}
