import { describe, expect, it, vi, type Mock } from 'vitest'

import { createApiFetch } from './createApiFetch'

type FetchMock = Mock<typeof fetch>
type RefreshMock = Mock<() => Promise<string | null>>

const ok = () => new Response(null, { status: 200 })

function setup(options: { fetchImpl?: FetchMock; refresh?: RefreshMock } = {}) {
    const fetchImpl = options.fetchImpl ?? vi.fn<typeof fetch>(async () => ok())
    const refresh = options.refresh ?? vi.fn(async () => 'new-token' as string | null)
    const getAccessToken = vi.fn(async () => 'old-token' as string | null)
    const onSessionExpired = vi.fn()

    const apiFetch = createApiFetch({
        baseUrl: 'http://gateway.test',
        getAccessToken,
        refresh,
        onSessionExpired,
        fetchImpl,
    })

    return { apiFetch, fetchImpl, refresh, getAccessToken, onSessionExpired }
}

function sentAuth(fetchImpl: FetchMock, call: number): string | null {
    return new Headers(fetchImpl.mock.calls[call][1]?.headers).get('Authorization')
}

describe('createApiFetch', () => {
    it('sends the current token to the gateway', async () => {
        const { apiFetch, fetchImpl } = setup()

        await apiFetch('/api/editorial/articles')

        expect(fetchImpl).toHaveBeenCalledTimes(1)
        expect(fetchImpl.mock.calls[0][0]).toBe('http://gateway.test/api/editorial/articles')
        expect(sentAuth(fetchImpl, 0)).toBe('Bearer old-token')
    })

    it('refreshes on 401 and repeats the request with the new token', async () => {
        const fetchImpl = vi
            .fn<typeof fetch>()
            .mockResolvedValueOnce(new Response(null, { status: 401 }))
            .mockResolvedValueOnce(ok())
        const { apiFetch, refresh } = setup({ fetchImpl })

        const response = await apiFetch('/api/editorial/articles')

        expect(response.status).toBe(200)
        expect(refresh).toHaveBeenCalledTimes(1)
        expect(sentAuth(fetchImpl, 1)).toBe('Bearer new-token')
    })

    it('refreshes once for requests that hit 401 in parallel', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async (_input, init) => {
            const sent = new Headers(init?.headers).get('Authorization')
            return new Response(null, { status: sent === 'Bearer new-token' ? 200 : 401 })
        })
        const { apiFetch, refresh } = setup({ fetchImpl })

        const responses = await Promise.all([
            apiFetch('/api/transcribe/one'),
            apiFetch('/api/transcribe/two'),
            apiFetch('/api/transcribe/three'),
        ])

        expect(responses.map((r) => r.status)).toEqual([200, 200, 200])
        expect(refresh).toHaveBeenCalledTimes(1)
    })

    it('reports an expired session and does not repeat the request', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 401 }))
        const refresh: RefreshMock = vi.fn(async () => null)
        const { apiFetch, onSessionExpired } = setup({ fetchImpl, refresh })

        const response = await apiFetch('/api/editorial/articles')

        expect(response.status).toBe(401)
        expect(onSessionExpired).toHaveBeenCalledTimes(1)
        expect(fetchImpl).toHaveBeenCalledTimes(1)
    })

    it('leaves 403 alone: a missing role is not an expired token', async () => {
        const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 403 }))
        const { apiFetch, refresh, onSessionExpired } = setup({ fetchImpl })

        const response = await apiFetch('/api/editorial/articles')

        expect(response.status).toBe(403)
        expect(refresh).not.toHaveBeenCalled()
        expect(onSessionExpired).not.toHaveBeenCalled()
        expect(fetchImpl).toHaveBeenCalledTimes(1)
    })
})
