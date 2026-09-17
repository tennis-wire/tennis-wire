import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DiscussionError, NetworkError, RETRY_AFTER_MS, TIMEOUT_MS, isRetryable, read } from './api'

const fetchMock = vi.fn()

function json(status: number, body: unknown) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
    })
}

beforeEach(() => {
    vi.useFakeTimers()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
})

describe('read', () => {
    it('returns the body of a good answer with one request', async () => {
        fetchMock.mockResolvedValueOnce(json(200, { items: [] }))

        await expect(read('/api/discussion/comments')).resolves.toEqual({ items: [] })
        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(fetchMock.mock.calls[0][1]).toMatchObject({
            method: 'GET',
            headers: { accept: 'application/json' },
        })
    })

    it('retries once, after a pause, when the service is down', async () => {
        fetchMock.mockResolvedValueOnce(
            json(503, { error: 'SERVICE_UNAVAILABLE', message: 'down' })
        )
        fetchMock.mockResolvedValueOnce(json(200, { ok: true }))

        const pending = read('/x')
        await vi.advanceTimersByTimeAsync(RETRY_AFTER_MS - 1)
        expect(fetchMock).toHaveBeenCalledTimes(1)
        await vi.advanceTimersByTimeAsync(1)

        await expect(pending).resolves.toEqual({ ok: true })
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('retries the proxy rate limit and nothing else under 500', async () => {
        fetchMock.mockResolvedValueOnce(json(429, { code: 'TOO_MANY_REQUESTS' }))
        fetchMock.mockResolvedValueOnce(
            json(404, { error: 'NOT_FOUND', message: 'no such comment' })
        )

        const pending = read('/x')
        const outcome = expect(pending).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' })
        await vi.advanceTimersByTimeAsync(RETRY_AFTER_MS)
        await outcome
        expect(fetchMock).toHaveBeenCalledTimes(2)

        fetchMock.mockResolvedValueOnce(json(403, { code: 'BAD_ORIGIN' }))
        await expect(read('/y')).rejects.toMatchObject({ status: 403, code: 'BAD_ORIGIN' })
        expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    it('gives up after the second failure', async () => {
        fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
        fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))

        const pending = read('/x')
        const outcome = expect(pending).rejects.toBeInstanceOf(NetworkError)
        await vi.advanceTimersByTimeAsync(RETRY_AFTER_MS)
        await outcome
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('gives a request the timeout and reports it as such', async () => {
        fetchMock.mockImplementation(
            (_url: string, init: RequestInit) =>
                new Promise((_resolve, reject) => {
                    init.signal?.addEventListener('abort', () =>
                        reject(new DOMException('aborted', 'AbortError'))
                    )
                })
        )

        const pending = read('/x')
        const outcome = expect(pending).rejects.toMatchObject({ reason: 'timeout' })
        await vi.advanceTimersByTimeAsync(TIMEOUT_MS + RETRY_AFTER_MS + TIMEOUT_MS)
        await outcome
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('carries the service error through', async () => {
        fetchMock.mockResolvedValueOnce(
            json(403, {
                error: 'COMMENTING_RESTRICTED',
                message: 'restricted',
                details: { restrictedUntil: '2026-10-01T00:00:00Z' },
            })
        )

        const error = await read('/x').catch((e: unknown) => e)
        expect(error).toBeInstanceOf(DiscussionError)
        expect(error).toMatchObject({
            status: 403,
            code: 'COMMENTING_RESTRICTED',
            details: { restrictedUntil: '2026-10-01T00:00:00Z' },
        })
        expect(isRetryable(error)).toBe(false)
    })
})
