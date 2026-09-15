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
    // the comment the view was rooted on is gone, and the reader saw it go (§8.19)
    | { phase: 'gone' }
    // highlight: the comment the reader was brought to — by a link, or by posting it (§3.29, §4.11)
    | { phase: 'ready'; view: View; highlight: string | null }

export type Action =
    | { type: 'loading' }
    | { type: 'failed'; offline: boolean }
    | { type: 'missing' }
    | { type: 'list'; page: CommentPage }
    | { type: 'more'; status: Status }
    | { type: 'more-loaded'; page: CommentPage }
    | { type: 'rooted'; chain: Comment[]; root: Comment; highlight?: string }
    | { type: 'replies-loading'; id: string }
    | { type: 'replies-failed'; id: string }
    | { type: 'branch-loaded'; id: string; root: Comment }
    | { type: 'replies-loaded'; id: string; page: CommentPage }
    | { type: 'reveal'; id: string }
    // the reader's own top-level comment, just accepted: first, whatever the order (§3.15)
    | { type: 'posted'; comment: Comment }
    // the reader's own reply, just accepted, under a comment whose replies are drawn here
    | { type: 'replied'; parentId: string; comment: Comment }
    // the reader's own comment, just taken down: a placeholder while replies stand under it,
    // gone otherwise (§8.5–6)
    | { type: 'deleted'; id: string }
    // a comment the server no longer has: out of the tree, no word said (§8.17)
    | { type: 'vanished'; id: string }

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

// A comment taken down with replies still under it: what everyone is shown from then on
function placeholder(node: Node): Node {
    const { body: _body, author: _author, ...rest } = node.comment
    return { ...node, comment: { ...rest, visibility: 'deleted' } }
}

// A reply counted off a comment
function lessOne(node: Node, kept: Node[]): Node {
    const counted = node.replies !== null && kept.length < node.replies.length
    return {
        ...node,
        replies: kept,
        comment: counted
            ? { ...node.comment, replyCount: Math.max(0, node.comment.replyCount - 1) }
            : node.comment,
    }
}

// The node out of the forest
function dropNode(nodes: Node[], id: string): Node[] {
    if (nodes.some((node) => node.comment.id === id))
        return nodes.filter((node) => node.comment.id !== id)
    return nodes.map((node) => {
        if (node.replies === null) return node
        const kept = dropNode(node.replies, id)
        return kept === node.replies ? node : lessOne(node, kept)
    })
}

function dropFromView(view: View, id: string): View {
    if (view.kind === 'list') return { ...view, items: dropNode(view.items, id) }
    if (view.root.replies === null) return view
    const kept = dropNode(view.root.replies, id)
    return kept === view.root.replies ? view : { ...view, root: lessOne(view.root, kept) }
}

function findNode(view: View, id: string): Node | null {
    const walk = (nodes: Node[]): Node | null => {
        for (const node of nodes) {
            if (node.comment.id === id) return node
            const below = node.replies === null ? null : walk(node.replies)
            if (below) return below
        }
        return null
    }
    if (view.kind === 'list') return walk(view.items)
    return view.root.comment.id === id ? view.root : walk(view.root.replies ?? [])
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
                highlight: null,
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
                highlight: action.highlight ?? action.root.id,
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
        case 'posted':
            if (state.phase !== 'ready' || state.view.kind !== 'list') return state
            return {
                ...state,
                highlight: action.comment.id,
                view: { ...state.view, items: [leaf(action.comment), ...state.view.items] },
            }
        case 'replied': {
            if (state.phase !== 'ready') return state
            const next = inView(state, action.parentId, (node) => ({
                ...node,
                comment: { ...node.comment, replyCount: node.comment.replyCount + 1 },
                // Replies not on show yet: the reader's own goes up alone, the older ones stay
                // behind "show more", which reads them from the first page (§3.15 for replies)
                replies:
                    node.replies === null
                        ? [leaf(action.comment)]
                        : [...node.replies, leaf(action.comment)],
                hasMore: node.replies === null ? node.comment.replyCount > 0 : node.hasMore,
            }))
            return next.phase === 'ready' ? { ...next, highlight: action.comment.id } : next
        }
        case 'deleted': {
            if (state.phase !== 'ready') return state
            const node = findNode(state.view, action.id)
            if (!node) return state
            if (node.comment.replyCount > 0) return inView(state, action.id, placeholder)
            if (state.view.kind === 'rooted' && state.view.root.comment.id === action.id)
                return { phase: 'gone' }
            return { ...state, view: dropFromView(state.view, action.id) }
        }
        case 'vanished':
            if (state.phase !== 'ready') return state
            if (state.view.kind === 'rooted' && state.view.root.comment.id === action.id)
                return { phase: 'gone' }
            return { ...state, view: dropFromView(state.view, action.id) }
    }
}
