import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DiscussionError } from './discussion/api'
import { fetchReader } from './readers'

const fetchMock = vi.fn()

function json(status: number, body: unknown) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
    })
}

const card = { id: 'r1', displayName: 'petya', avatarUrl: null, commentCount: 3 }

function answer(cardAnswer: Response, profileAnswer: Response) {
    fetchMock.mockImplementation(async (url: string) =>
        url.startsWith('/api/discussion/authors/') ? cardAnswer : profileAnswer
    )
}

beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
    vi.unstubAllGlobals()
})

describe('fetchReader', () => {
    it('puts the date from user-service on the card', async () => {
        answer(json(200, card), json(200, { id: 'r1', createdAt: '2026-05-03T10:00:00Z' }))

        await expect(fetchReader('r1')).resolves.toEqual({
            ...card,
            createdAt: '2026-05-03T10:00:00Z',
        })
    })

    it('has no page for someone the card does not know or will not show', async () => {
        answer(json(404, { error: 'NOT_FOUND' }), json(200, { createdAt: '2026-05-03T10:00:00Z' }))

        await expect(fetchReader('r1')).resolves.toBeNull()
    })

    it('has no page for someone user-service no longer has', async () => {
        answer(json(200, card), json(404, { error: 'NOT_FOUND' }))

        await expect(fetchReader('r1')).resolves.toBeNull()
    })

    it('passes on whatever is not a 404', async () => {
        answer(json(403, { error: 'FORBIDDEN' }), json(200, { createdAt: '2026-05-03T10:00:00Z' }))

        await expect(fetchReader('r1')).rejects.toBeInstanceOf(DiscussionError)
    })
})
