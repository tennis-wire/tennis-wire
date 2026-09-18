import { describe, expect, it } from 'vitest'

import { DiscussionError, NetworkError } from './api'
import { EDIT_WINDOW_MS, canEdit, editFailure } from './edit'
import type { Comment, Visibility } from './types'

function comment(createdAt: string, visibility: Visibility = 'visible'): Comment {
    return {
        id: 'c1',
        subjectType: 'publication',
        subjectId: 's1',
        inReplyToId: null,
        rootId: 'c1',
        body: 'text',
        visibility,
        replyCount: 0,
        repliesTruncated: false,
        createdAt,
        updatedAt: createdAt,
        edited: false,
        replies: [],
    }
}

const published = '2026-09-18T12:00:00.000Z'
const at = new Date(published).getTime()

describe('canEdit', () => {
    it('holds until the window runs out', () => {
        expect(canEdit(comment(published), at)).toBe(true)
        expect(canEdit(comment(published), at + EDIT_WINDOW_MS - 1)).toBe(true)
        expect(canEdit(comment(published), at + EDIT_WINDOW_MS)).toBe(false)
    })

    it('never on a placeholder', () => {
        expect(canEdit(comment(published, 'deleted'), at)).toBe(false)
        expect(canEdit(comment(published, 'removed'), at)).toBe(false)
        expect(canEdit(comment(published, 'gravestone'), at)).toBe(false)
    })

    it('holds on a comment the reader collapsed by his own ignore and opened', () => {
        expect(canEdit(comment(published, 'soft_hidden'), at)).toBe(true)
    })
})

describe('editFailure', () => {
    const error = (status: number, code: string) => new DiscussionError(status, code, code)

    it('tells the ways a comment can be gone apart', () => {
        expect(editFailure(error(403, 'EDIT_WINDOW_CLOSED')).kind).toBe('late')
        expect(editFailure(error(409, 'COMMENT_DELETED')).kind).toBe('deleted')
        expect(editFailure(error(404, 'NOT_FOUND')).kind).toBe('deleted')
        expect(editFailure(error(409, 'COMMENT_ALREADY_REMOVED')).kind).toBe('removed')
    })

    it('treats what a second try could fix as the network', () => {
        expect(editFailure(new NetworkError('timeout')).kind).toBe('network')
        expect(editFailure(error(503, 'SERVICE_UNAVAILABLE')).kind).toBe('network')
        expect(editFailure(error(429, 'TOO_MANY_REQUESTS')).kind).toBe('rate')
    })
})
