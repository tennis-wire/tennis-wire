// The reader's own comments in the cabinet: pages of them, and the articles they stand under

import type { Refs } from '@/lib/content/refs'

import type { Comment } from './types'

export type Loaded = { items: Comment[]; cursor: string | null; refs: Refs }

export type State =
    | { phase: 'loading' }
    | { phase: 'failed'; offline: boolean }
    | {
          phase: 'ready'
          items: Comment[]
          cursor: string | null
          refs: Refs
          more: 'idle' | 'loading' | 'failed'
      }

export type Action =
    | { type: 'loading' }
    | { type: 'loaded'; page: Loaded }
    | { type: 'load-failed'; offline: boolean }
    | { type: 'more-loading' }
    | { type: 'more-loaded'; page: Loaded }
    | { type: 'more-failed' }

export const initial: State = { phase: 'loading' }

export function reduce(state: State, action: Action): State {
    switch (action.type) {
        case 'loading':
            return { phase: 'loading' }
        case 'loaded':
            return { phase: 'ready', ...action.page, more: 'idle' }
        case 'load-failed':
            return { phase: 'failed', offline: action.offline }
        case 'more-loading':
            return state.phase === 'ready' ? { ...state, more: 'loading' } : state
        case 'more-loaded':
            if (state.phase !== 'ready') return state
            return {
                ...state,
                items: [...state.items, ...action.page.items],
                cursor: action.page.cursor,
                // the page was resolved against these refs, so its map holds them all
                refs: action.page.refs,
                more: 'idle',
            }
        case 'more-failed':
            return state.phase === 'ready' ? { ...state, more: 'failed' } : state
    }
}
