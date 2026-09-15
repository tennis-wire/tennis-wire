import type { Comment, CommentPage } from './types'

// What the island holds and how it changes. Pure: the loaders in useDiscussion feed it, the
// components draw it. Two views share one tree shape — the page's top-level list, and one
// comment re-rooted with its context chain above it (readers.md, the X-style layout).

export type Node = {
    comment: Comment
    // null until the reader asked to see them; then the direct replies as far as they are loaded
    replies: Node[] | null
    // more direct replies exist than `replies` holds
    hasMore: boolean
    // where the next page of /replies starts. undefined while `replies` is still the prefix a
    // branch handed out — /replies is then read from its first page, not resumed
    cursor: string | null | undefined
    // a soft_hidden comment the reader chose to see
    revealed: boolean
    loading: boolean
    failed: boolean
}

export type Status = 'idle' | 'loading' | 'failed'

export type ListView = { kind: 'list'; items: Node[]; nextCursor: string | null; more: Status }
export type RootedView = { kind: 'rooted'; chain: Comment[]; root: Node }
export type View = ListView | RootedView

export type State =
    | { phase: 'idle' }
    | { phase: 'loading' }
    // offline: no connection at all, as against no usable answer (§3.20 vs §3.19)
    | { phase: 'failed'; offline: boolean }
    // the comment the URL points at is not there for this viewer
    | { phase: 'missing' }
    | { phase: 'ready'; view: View }

export type Action =
    | { type: 'loading' }
    | { type: 'failed'; offline: boolean }
    | { type: 'missing' }
    | { type: 'list'; page: CommentPage }
    | { type: 'more'; status: Status }
    | { type: 'more-loaded'; page: CommentPage }
    | { type: 'rooted'; chain: Comment[]; root: Comment }
    | { type: 'replies-loading'; id: string }
    | { type: 'replies-failed'; id: string }
    | { type: 'branch-loaded'; id: string; root: Comment }
    | { type: 'replies-loaded'; id: string; page: CommentPage }
    | { type: 'reveal'; id: string }

export const initial: State = { phase: 'idle' }

// A node whose replies are not on show yet. A branch nests five levels, but only the first is
// drawn where it lands; the rest wait for a re-root, which reads its own branch.
export function leaf(comment: Comment): Node {
    return {
        comment,
        replies: null,
        hasMore: false,
        cursor: undefined,
        revealed: false,
        loading: false,
        failed: false,
    }
}

// A node drawn with the direct replies a branch carried
function withBranch(node: Node, root: Comment): Node {
    return {
        ...node,
        comment: { ...root, replies: [] },
        replies: root.replies.map(leaf),
        hasMore: root.repliesTruncated,
        cursor: undefined,
        loading: false,
        failed: false,
    }
}

function mapNodes(nodes: Node[], id: string, change: (node: Node) => Node): Node[] {
    return nodes.map((node) => {
        if (node.comment.id === id) return change(node)
        if (node.replies === null) return node
        return { ...node, replies: mapNodes(node.replies, id, change) }
    })
}

function mapView(view: View, id: string, change: (node: Node) => Node): View {
    if (view.kind === 'list') return { ...view, items: mapNodes(view.items, id, change) }
    if (view.root.comment.id === id) return { ...view, root: change(view.root) }
    return {
        ...view,
        root: { ...view.root, replies: mapNodes(view.root.replies ?? [], id, change) },
    }
}

function inView(state: State, id: string, change: (node: Node) => Node): State {
    if (state.phase !== 'ready') return state
    return { ...state, view: mapView(state.view, id, change) }
}

export function reduce(state: State, action: Action): State {
    switch (action.type) {
        case 'loading':
            return { phase: 'loading' }
        case 'failed':
            return { phase: 'failed', offline: action.offline }
        case 'missing':
            return { phase: 'missing' }
        case 'list':
            return {
                phase: 'ready',
                view: {
                    kind: 'list',
                    items: action.page.items.map(leaf),
                    nextCursor: action.page.nextCursor,
                    more: 'idle',
                },
            }
        case 'more':
            if (state.phase !== 'ready' || state.view.kind !== 'list') return state
            return { ...state, view: { ...state.view, more: action.status } }
        case 'more-loaded':
            if (state.phase !== 'ready' || state.view.kind !== 'list') return state
            return {
                ...state,
                view: {
                    ...state.view,
                    items: [...state.view.items, ...action.page.items.map(leaf)],
                    nextCursor: action.page.nextCursor,
                    more: 'idle',
                },
            }
        case 'rooted':
            return {
                phase: 'ready',
                view: {
                    kind: 'rooted',
                    chain: action.chain,
                    root: withBranch(leaf(action.root), action.root),
                },
            }
        case 'replies-loading':
            return inView(state, action.id, (node) => ({ ...node, loading: true, failed: false }))
        case 'replies-failed':
            return inView(state, action.id, (node) => ({ ...node, loading: false, failed: true }))
        case 'branch-loaded':
            return inView(state, action.id, (node) => withBranch(node, action.root))
        case 'replies-loaded':
            return inView(state, action.id, (node) => ({
                ...node,
                // the first /replies page replaces the branch's prefix rather than following it
                replies: [
                    ...(node.cursor === undefined ? [] : (node.replies ?? [])),
                    ...action.page.items.map(leaf),
                ],
                hasMore: action.page.nextCursor !== null,
                cursor: action.page.nextCursor,
                loading: false,
                failed: false,
            }))
        case 'reveal':
            return inView(state, action.id, (node) => ({ ...node, revealed: true }))
    }
}
