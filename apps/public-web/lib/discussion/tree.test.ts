import { describe, expect, it } from 'vitest'

import { initial, reduce, type State } from './tree'
import type { Comment } from './types'

let seq = 0
function comment(over: Partial<Comment> = {}): Comment {
    seq += 1
    return {
        id: `c${seq}`,
        subjectType: 'publication',
        subjectId: 'p1',
        inReplyToId: null,
        rootId: `c${seq}`,
        author: { id: 'a1', displayName: 'alice', avatarUrl: null },
        body: `body ${seq}`,
        visibility: 'visible',
        replyCount: 0,
        repliesTruncated: false,
        createdAt: '2026-09-15T10:00:00Z',
        updatedAt: '2026-09-15T10:00:00Z',
        replies: [],
        ...over,
    }
}

function listed(items: Comment[], nextCursor: string | null = null): State {
    return reduce(initial, { type: 'list', page: { items, nextCursor } })
}

function items(state: State) {
    if (state.phase !== 'ready' || state.view.kind !== 'list') throw new Error('not a list')
    return state.view.items
}

describe('reduce', () => {
    it('lists top-level comments with their replies not yet on show', () => {
        const state = listed([comment({ replyCount: 3 })], 'next')

        expect(items(state)[0].replies).toBeNull()
        expect(items(state)[0].hasMore).toBe(false)
        if (state.phase === 'ready' && state.view.kind === 'list')
            expect(state.view.nextCursor).toBe('next')
    })

    it('appends the next page and keeps its cursor', () => {
        const first = comment()
        const second = comment()
        let state = listed([first], 'next')
        state = reduce(state, { type: 'more', status: 'loading' })
        state = reduce(state, { type: 'more-loaded', page: { items: [second], nextCursor: null } })

        expect(items(state).map((node) => node.comment.id)).toEqual([first.id, second.id])
        if (state.phase === 'ready' && state.view.kind === 'list') {
            expect(state.view.nextCursor).toBeNull()
            expect(state.view.more).toBe('idle')
        }
    })

    it('draws only the first level of a branch and marks a cut prefix', () => {
        const top = comment({ replyCount: 2 })
        const deep = comment({ inReplyToId: 'r', rootId: top.id })
        const reply = comment({
            inReplyToId: top.id,
            rootId: top.id,
            replyCount: 1,
            replies: [deep],
        })
        let state = listed([top])
        state = reduce(state, { type: 'replies-loading', id: top.id })
        expect(items(state)[0].loading).toBe(true)

        state = reduce(state, {
            type: 'branch-loaded',
            id: top.id,
            root: { ...top, repliesTruncated: true, replies: [reply] },
        })

        const node = items(state)[0]
        expect(node.loading).toBe(false)
        expect(node.hasMore).toBe(true)
        expect(node.cursor).toBeUndefined()
        expect(node.replies?.map((child) => child.comment.id)).toEqual([reply.id])
        // the grandchild is not drawn here: it waits for a re-root on the reply
        expect(node.replies?.[0].replies).toBeNull()
    })

    it('reads the first /replies page in place of the prefix and follows the cursor after', () => {
        const top = comment({ replyCount: 40 })
        const a = comment({ inReplyToId: top.id })
        const b = comment({ inReplyToId: top.id })
        const c = comment({ inReplyToId: top.id })
        let state = listed([top])
        state = reduce(state, {
            type: 'branch-loaded',
            id: top.id,
            root: { ...top, repliesTruncated: true, replies: [a] },
        })

        state = reduce(state, {
            type: 'replies-loaded',
            id: top.id,
            page: { items: [a, b], nextCursor: 'k' },
        })
        expect(items(state)[0].replies?.map((node) => node.comment.id)).toEqual([a.id, b.id])
        expect(items(state)[0].cursor).toBe('k')

        state = reduce(state, {
            type: 'replies-loaded',
            id: top.id,
            page: { items: [c], nextCursor: null },
        })
        expect(items(state)[0].replies?.map((node) => node.comment.id)).toEqual([a.id, b.id, c.id])
        expect(items(state)[0].hasMore).toBe(false)
    })

    it('re-roots on a comment with its chain above and its first level below', () => {
        const top = comment()
        const target = comment({ inReplyToId: top.id, rootId: top.id, replyCount: 1 })
        const under = comment({ inReplyToId: target.id, rootId: top.id })

        const state = reduce(listed([top]), {
            type: 'rooted',
            chain: [top, target],
            root: { ...target, replies: [under] },
        })

        if (state.phase !== 'ready' || state.view.kind !== 'rooted') throw new Error('not rooted')
        expect(state.view.chain.map((node) => node.id)).toEqual([top.id, target.id])
        expect(state.view.root.comment.id).toBe(target.id)
        expect(state.view.root.replies?.map((node) => node.comment.id)).toEqual([under.id])
    })

    it('marks a failed load on the node alone', () => {
        const first = comment({ replyCount: 1 })
        const second = comment({ replyCount: 1 })
        let state = listed([first, second])
        state = reduce(state, { type: 'replies-failed', id: second.id })

        expect(items(state)[0].failed).toBe(false)
        expect(items(state)[1].failed).toBe(true)
    })

    it("puts the reader's own comment first and lights it up", () => {
        const older = comment()
        const mine = comment()
        const state = reduce(listed([older]), { type: 'posted', comment: mine })

        expect(items(state).map((node) => node.comment.id)).toEqual([mine.id, older.id])
        if (state.phase === 'ready') expect(state.highlight).toBe(mine.id)
    })

    it("adds the reader's own reply and counts it", () => {
        const top = comment({ replyCount: 2 })
        const mine = comment({ inReplyToId: top.id, rootId: top.id })
        const state = reduce(listed([top]), { type: 'replied', parentId: top.id, comment: mine })

        const node = items(state)[0]
        expect(node.comment.replyCount).toBe(3)
        expect(node.replies?.map((reply) => reply.comment.id)).toEqual([mine.id])
        // the two older ones are still to be read
        expect(node.hasMore).toBe(true)
        expect(node.cursor).toBeUndefined()
        if (state.phase === 'ready') expect(state.highlight).toBe(mine.id)
    })

    it("appends the reader's own reply to replies already on show", () => {
        const top = comment({ replyCount: 1 })
        const older = comment({ inReplyToId: top.id, rootId: top.id })
        const mine = comment({ inReplyToId: top.id, rootId: top.id })
        let state = reduce(listed([top]), {
            type: 'branch-loaded',
            id: top.id,
            root: { ...top, replies: [older] },
        })
        state = reduce(state, { type: 'replied', parentId: top.id, comment: mine })

        expect(items(state)[0].replies?.map((reply) => reply.comment.id)).toEqual([
            older.id,
            mine.id,
        ])
        expect(items(state)[0].hasMore).toBe(false)
    })

    it('lights up the root of a re-rooted view, or the comment it was asked to', () => {
        const top = comment()
        const target = comment({ inReplyToId: top.id, rootId: top.id })
        const byLink = reduce(initial, { type: 'rooted', chain: [top, target], root: target })
        const byPost = reduce(initial, {
            type: 'rooted',
            chain: [top, target],
            root: target,
            highlight: 'new',
        })

        if (byLink.phase === 'ready') expect(byLink.highlight).toBe(target.id)
        if (byPost.phase === 'ready') expect(byPost.highlight).toBe('new')
    })

    it('takes a deleted comment out when nothing stands under it, and counts it off the parent', () => {
        const top = comment({ replyCount: 2 })
        const a = comment({ inReplyToId: top.id, rootId: top.id })
        const b = comment({ inReplyToId: top.id, rootId: top.id })
        let state = reduce(listed([top]), {
            type: 'branch-loaded',
            id: top.id,
            root: { ...top, replies: [a, b] },
        })

        state = reduce(state, { type: 'deleted', id: a.id })

        expect(items(state)[0].replies?.map((node) => node.comment.id)).toEqual([b.id])
        expect(items(state)[0].comment.replyCount).toBe(1)
    })

    it('leaves a placeholder where a deleted comment still has replies', () => {
        const top = comment({ replyCount: 1 })
        const state = reduce(listed([top]), { type: 'deleted', id: top.id })

        const node = items(state)[0]
        expect(node.comment.visibility).toBe('deleted')
        expect(node.comment.body).toBeUndefined()
        expect(node.comment.author).toBeUndefined()
        expect(node.comment.replyCount).toBe(1)
    })

    it('says a re-rooted comment is gone when the reader deleted it childless', () => {
        const top = comment()
        const state = reduce(reduce(initial, { type: 'rooted', chain: [top], root: top }), {
            type: 'deleted',
            id: top.id,
        })

        expect(state.phase).toBe('gone')
    })

    it('drops a vanished comment without a word', () => {
        const first = comment({ replyCount: 3 })
        const second = comment()
        const state = reduce(listed([first, second]), { type: 'vanished', id: first.id })

        expect(items(state).map((node) => node.comment.id)).toEqual([second.id])
    })

    it('says whose blocks hide a branch a link leads into, and lets the view go', () => {
        const state = reduce(listed([comment()]), { type: 'hidden', blockedIds: ['u1', 'u2'] })

        expect(state).toEqual({ phase: 'hidden', blockedIds: ['u1', 'u2'] })
    })

    describe('an ignore made on the page', () => {
        const bob = { id: 'b1', displayName: 'bob', avatarUrl: null }

        // a top-level comment with its first level of replies on show
        function withReplies(top: Comment, replies: Comment[]): State {
            return reduce(listed([top]), {
                type: 'branch-loaded',
                id: top.id,
                root: { ...top, replies },
            })
        }

        it('collapses every comment of the author on show, keeping text and name', () => {
            const top = comment({ author: bob, replyCount: 1 })
            const reply = comment({ inReplyToId: top.id, author: bob })
            let state = withReplies(top, [reply])
            state = reduce(state, { type: 'reveal', id: top.id })

            state = reduce(state, { type: 'ignored', authorId: 'b1', mode: 'soft' })

            const [node] = items(state)
            expect(node.comment).toMatchObject({ visibility: 'soft_hidden', body: top.body })
            expect(node.revealed).toBe(false)
            expect(node.replies?.[0].comment.visibility).toBe('soft_hidden')
        })

        it('hides the text and the name under gravestone, and leaves other authors alone', () => {
            const mine = comment()
            const his = comment({ author: bob })

            const state = reduce(listed([mine, his]), {
                type: 'ignored',
                authorId: 'b1',
                mode: 'gravestone',
            })

            expect(items(state)[0].comment.visibility).toBe('visible')
            expect(items(state)[1].comment.visibility).toBe('gravestone')
            expect(items(state)[1].comment.body).toBeUndefined()
            expect(items(state)[1].comment.author).toBeUndefined()
        })

        it('takes his comments out with their replies and counts them off the parent', () => {
            const top = comment({ replyCount: 3 })
            const his = comment({ inReplyToId: top.id, author: bob, replyCount: 2 })
            const other = comment({ inReplyToId: top.id })
            const hisTop = comment({ author: bob })
            let state = reduce(withReplies(top, [his, other]), {
                type: 'more-loaded',
                page: { items: [hisTop], nextCursor: null },
            })

            state = reduce(state, { type: 'ignored', authorId: 'b1', mode: 'subtree_removal' })

            expect(items(state).map((node) => node.comment.id)).toEqual([top.id])
            expect(items(state)[0].replies?.map((node) => node.comment.id)).toEqual([other.id])
            // three by the count and one of them his: the other two stay counted, on show or not
            expect(items(state)[0].comment.replyCount).toBe(2)
        })

        it('lets a placeholder go once nothing is left under it', () => {
            const top = comment({ visibility: 'deleted', author: undefined, body: undefined })
            const counted = { ...top, replyCount: 1 }
            const his = comment({ inReplyToId: top.id, author: bob })

            const state = reduce(withReplies(counted, [his]), {
                type: 'ignored',
                authorId: 'b1',
                mode: 'subtree_removal',
            })

            expect(items(state)).toEqual([])
        })

        it('turns a view rooted inside his branch into the message about it', () => {
            const top = comment({ author: bob, replyCount: 1 })
            const target = comment({ inReplyToId: top.id, rootId: top.id })
            let state = reduce(listed([top]), {
                type: 'rooted',
                chain: [top, target],
                root: target,
            })

            state = reduce(state, { type: 'ignored', authorId: 'b1', mode: 'subtree_removal' })

            expect(state).toEqual({ phase: 'hidden', blockedIds: ['b1'] })
        })

        it('opens what was collapsed once the ignore is lifted', () => {
            const his = comment({ author: bob })
            let state = reduce(listed([his]), { type: 'ignored', authorId: 'b1', mode: 'soft' })

            state = reduce(state, { type: 'unignored', authorId: 'b1' })

            expect(items(state)[0].comment.visibility).toBe('visible')
        })
    })

    it('reveals a collapsed comment', () => {
        const hidden = comment({ visibility: 'soft_hidden' })
        const state = reduce(listed([hidden]), { type: 'reveal', id: hidden.id })

        expect(items(state)[0].revealed).toBe(true)
    })
})
