import type { BlockMode } from './modes'
import { shifted } from './reactions'
import type { Comment, CommentPage, ReactionSlot, Restriction } from './types'

// What the island holds and how it changes. Pure: the loaders in useDiscussion feed it, the
// components draw it. Two views share one tree shape: the page's top-level list, and one
// comment re-rooted with its context chain above it.

export type Node = {
    comment: Comment
    // null until the reader asked to see them; then the direct replies as far as they are loaded
    replies: Node[] | null
    // more direct replies exist than `replies` holds
    hasMore: boolean
    // where the next page of /replies starts. undefined while `replies` is still the prefix a
    // branch handed out; /replies is then read from its first page, not resumed
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
    // offline: no connection at all, as against no usable answer
    | { phase: 'failed'; offline: boolean }
    // the comment the URL points at is not there for this viewer
    | { phase: 'missing' }
    // it is there, in a branch the reader's own "remove with branches" takes out
    // blockedIds: whose blocks, nearest the root first; empty when a placeholder is what hides it
    | { phase: 'hidden'; blockedIds: string[] }
    // the comment the view was rooted on is gone, and the reader saw it go
    | { phase: 'gone' }
    // highlight: the comment the reader was brought to, by a link or by posting it
    // restriction: what stops the reader writing, as the load that drew the view found it. A later
    // page leaves it be: a ban given meanwhile is met on sending, with the text still in the field.
    | { phase: 'ready'; view: View; highlight: string | null; restriction: Restriction | null }

export type Action =
    | { type: 'loading' }
    | { type: 'failed'; offline: boolean }
    | { type: 'missing' }
    | { type: 'hidden'; blockedIds: string[] }
    | { type: 'list'; page: CommentPage }
    | { type: 'more'; status: Status }
    | { type: 'more-loaded'; page: CommentPage }
    | {
          type: 'rooted'
          chain: Comment[]
          root: Comment
          highlight?: string
          restriction?: Restriction | null
      }
    | { type: 'replies-loading'; id: string }
    | { type: 'replies-failed'; id: string }
    | { type: 'branch-loaded'; id: string; root: Comment }
    | { type: 'replies-loaded'; id: string; page: CommentPage }
    | { type: 'reveal'; id: string }
    // the reader's own top-level comment, just accepted: first, whatever the order
    | { type: 'posted'; comment: Comment }
    // the reader's own reply, just accepted, under a comment whose replies are drawn here
    | { type: 'replied'; parentId: string; comment: Comment }
    // the reader put something in one of his two slots on this comment, or took it out. Applied
    // before the request goes out and applied again in reverse if it fails.
    | { type: 'reacted'; id: string; slot: ReactionSlot; to: string | null }
    // the reader's own comment, just rewritten: only the text and the two marks on it move
    | { type: 'edited'; id: string; body: string; updatedAt: string }
    // the reader's own comment, just taken down: a placeholder while replies stand under it,
    // gone otherwise
    | { type: 'deleted'; id: string }
    // a comment the server no longer has: out of the tree, no word said. With blockedIds it is
    // there but hidden by the reader's own ignore, and a view rooted on it says so
    | { type: 'vanished'; id: string; blockedIds?: string[] }
    // the reader has just ignored an author, or changed how, and it shows at once. Only comments
    // that carry their author can be matched: a placeholder of his stays until the next load, and
    // so does a count under replies not on show yet
    | { type: 'ignored'; authorId: string; mode: BlockMode }
    // the reader has just stopped ignoring an author: what was collapsed opens
    | { type: 'unignored'; authorId: string }

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

const byAuthor = (comment: Comment, authorId: string) => comment.author?.id === authorId

const isPlaceholder = (comment: Comment) =>
    comment.visibility === 'deleted' || comment.visibility === 'removed'

// A comment of the ignored author drawn the way the mode draws it. Removal is not drawn: the
// comment goes, and that is the caller's to do
function ignoredComment(comment: Comment, mode: 'soft' | 'gravestone'): Comment {
    if (comment.visibility !== 'visible' && comment.visibility !== 'soft_hidden') return comment
    if (mode === 'soft') return { ...comment, visibility: 'soft_hidden' }
    const { body: _body, author: _author, ...rest } = comment
    return { ...rest, visibility: 'gravestone' }
}

// Nodes on show after an ignore, as the server would send them: the author's comments collapse,
// turn into hidden ones, or go with everything under them. A parent is counted down by what went
// from under it, and a placeholder left with nothing under it goes as well
function ignoreNodes(nodes: Node[], authorId: string, mode: BlockMode): Node[] {
    const kept: Node[] = []
    for (const node of nodes) {
        if (mode === 'subtree_removal' && byAuthor(node.comment, authorId)) continue
        const next = ignoreNode(node, authorId, mode)
        if (isPlaceholder(next.comment) && next.comment.replyCount === 0) continue
        kept.push(next)
    }
    return kept
}

function ignoreNode(node: Node, authorId: string, mode: BlockMode): Node {
    const comment =
        mode !== 'subtree_removal' && byAuthor(node.comment, authorId)
            ? ignoredComment(node.comment, mode)
            : node.comment
    const revealed = comment === node.comment && node.revealed
    if (node.replies === null) return { ...node, comment, revealed }
    const replies = ignoreNodes(node.replies, authorId, mode)
    const gone = node.replies.length - replies.length
    return {
        ...node,
        revealed,
        replies,
        comment:
            gone === 0
                ? comment
                : { ...comment, replyCount: Math.max(0, comment.replyCount - gone) },
    }
}

function openComment(comment: Comment, authorId: string): Comment {
    return comment.visibility === 'soft_hidden' && byAuthor(comment, authorId)
        ? { ...comment, visibility: 'visible' }
        : comment
}

function unignoreNodes(nodes: Node[], authorId: string): Node[] {
    return nodes.map((node) => {
        const comment = openComment(node.comment, authorId)
        return {
            ...node,
            comment,
            revealed: comment === node.comment && node.revealed,
            replies: node.replies === null ? null : unignoreNodes(node.replies, authorId),
        }
    })
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

function withoutSeen(shown: Node[], arriving: Comment[]): Node[] {
    const seen = new Set(shown.map((node) => node.comment.id))
    return arriving.filter((comment) => !seen.has(comment.id)).map(leaf)
}

export function reduce(state: State, action: Action): State {
    switch (action.type) {
        case 'loading':
            return { phase: 'loading' }
        case 'failed':
            return { phase: 'failed', offline: action.offline }
        case 'missing':
            return { phase: 'missing' }
        case 'hidden':
            return { phase: 'hidden', blockedIds: action.blockedIds }
        case 'list':
            return {
                phase: 'ready',
                highlight: null,
                restriction: action.page.viewer?.restriction ?? null,
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
                    // Dropped by id: under a sort by score a comment whose count moved between two
                    // requests can be handed out twice, and the reader would see it twice.
                    items: [
                        ...state.view.items,
                        ...withoutSeen(state.view.items, action.page.items),
                    ],
                    nextCursor: action.page.nextCursor,
                    more: 'idle',
                },
            }
        case 'rooted':
            return {
                phase: 'ready',
                highlight: action.highlight ?? action.root.id,
                restriction: action.restriction ?? null,
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
            // Sent again under its key, a comment can come back that the page has read meanwhile
            if (findNode(state.view, action.comment.id))
                return { ...state, highlight: action.comment.id }
            return {
                ...state,
                highlight: action.comment.id,
                view: { ...state.view, items: [leaf(action.comment), ...state.view.items] },
            }
        case 'replied': {
            if (state.phase !== 'ready') return state
            if (findNode(state.view, action.comment.id))
                return { ...state, highlight: action.comment.id }
            const next = inView(state, action.parentId, (node) => ({
                ...node,
                comment: { ...node.comment, replyCount: node.comment.replyCount + 1 },
                // Replies not on show yet: the reader's own goes up alone, the older ones stay
                // behind "show more", which reads them from the first page
                replies:
                    node.replies === null
                        ? [leaf(action.comment)]
                        : [...node.replies, leaf(action.comment)],
                hasMore: node.replies === null ? node.comment.replyCount > 0 : node.hasMore,
            }))
            return next.phase === 'ready' ? { ...next, highlight: action.comment.id } : next
        }
        case 'reacted':
            return inView(state, action.id, (node) => ({
                ...node,
                comment: shifted(node.comment, action.slot, action.to),
            }))
        case 'edited':
            return inView(state, action.id, (node) => ({
                ...node,
                comment: {
                    ...node.comment,
                    body: action.body,
                    updatedAt: action.updatedAt,
                    edited: true,
                },
            }))
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
                return action.blockedIds
                    ? { phase: 'hidden', blockedIds: action.blockedIds }
                    : { phase: 'gone' }
            return { ...state, view: dropFromView(state.view, action.id) }
        case 'ignored': {
            if (state.phase !== 'ready') return state
            const { view } = state
            const { authorId, mode } = action
            if (view.kind === 'list')
                return {
                    ...state,
                    view: { ...view, items: ignoreNodes(view.items, authorId, mode) },
                }
            // the rooted comment or one above it goes with its branch: the view becomes what a link
            // into that branch shows
            if (mode === 'subtree_removal' && view.chain.some((c) => byAuthor(c, authorId)))
                return { phase: 'hidden', blockedIds: [authorId] }
            const [root] = ignoreNodes([view.root], authorId, mode)
            // a placeholder with nothing left under it is not there for this reader
            if (!root) return { phase: 'missing' }
            const chain =
                mode === 'subtree_removal'
                    ? view.chain
                    : view.chain.map((c) => (byAuthor(c, authorId) ? ignoredComment(c, mode) : c))
            return { ...state, view: { ...view, chain, root } }
        }
        case 'unignored': {
            if (state.phase !== 'ready') return state
            const { view } = state
            const { authorId } = action
            if (view.kind === 'list')
                return { ...state, view: { ...view, items: unignoreNodes(view.items, authorId) } }
            return {
                ...state,
                view: {
                    ...view,
                    chain: view.chain.map((c) => openComment(c, authorId)),
                    root: unignoreNodes([view.root], authorId)[0],
                },
            }
        }
    }
}
