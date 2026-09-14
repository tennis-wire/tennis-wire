import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { proxy } from './proxy'
import { resetBuckets } from './rateLimit'

vi.mock('@/lib/auth/config', () => ({
    appOrigin: () => 'http://localhost:3000',
    oidcConfig: vi.fn(),
}))

const session = {
    sub: 'reader-1',
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    accessExpiresAt: 9_999_999_999,
}

vi.mock('@/lib/auth/session', () => ({
    SESSION_COOKIE: 'tw_session',
    sessionCookieOptions: () => ({
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        maxAge: 1,
    }),
    readSession: vi.fn(async (seal?: string) => (seal === 'signed-in' ? session : null)),
    sealSession: vi.fn(async () => 'sealed'),
}))

vi.mock('@/lib/auth/refresh', () => ({
    freshSession: vi.fn(async (current: typeof session) => current),
}))

function upstreamReturns(body = '[]') {
    const fetchMock = vi.fn<typeof fetch>(
        async () =>
            new Response(body, {
                status: 200,
                headers: {
                    'content-type': 'application/json',
                    'set-cookie': 'gateway=leak',
                    'x-internal': 'leak',
                },
            })
    )
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
}

type RequestOptions = { method?: string; cookie?: string; headers?: Record<string, string> }

function request(url: string, options: RequestOptions = {}) {
    const headers = new Headers(options.headers)
    if (!headers.has('x-forwarded-for')) headers.set('x-forwarded-for', '10.0.0.1, 203.0.113.7')
    if (options.cookie) headers.set('cookie', `tw_session=${options.cookie}`)
    return new NextRequest(url, { method: options.method ?? 'GET', headers })
}

beforeEach(() => {
    resetBuckets()
    vi.unstubAllGlobals()
    process.env.GATEWAY_ORIGIN = 'http://gateway:8090'
})

describe('proxy', () => {
    it('sends only the allowlisted headers on, and the token from the cookie', async () => {
        const fetchMock = upstreamReturns()

        await proxy(
            request('http://localhost:3000/api/discussion/comments?subjectId=1', {
                cookie: 'signed-in',
                headers: { accept: 'application/json', 'x-forwarded-for': '1.2.3.4' },
            }),
            '/api/discussion/'
        )

        const [url, init] = fetchMock.mock.calls[0]!
        expect(url).toBe('http://gateway:8090/api/discussion/comments?subjectId=1')
        const sent = new Headers(init!.headers)
        expect(sent.get('authorization')).toBe('Bearer access-token')
        expect(sent.get('accept')).toBe('application/json')
        expect([...sent.keys()].sort()).toEqual(['accept', 'authorization'])
    })

    it('keeps gateway headers away from the browser', async () => {
        upstreamReturns()

        const response = await proxy(
            request('http://localhost:3000/api/discussion/comments', { cookie: 'signed-in' }),
            '/api/discussion/'
        )

        expect(response.headers.get('content-type')).toBe('application/json')
        expect(response.headers.get('set-cookie')).toBeNull()
        expect(response.headers.get('x-internal')).toBeNull()
    })

    it('refuses a write from another origin', async () => {
        const fetchMock = upstreamReturns()

        const response = await proxy(
            request('http://localhost:3000/api/discussion/comments', {
                method: 'POST',
                cookie: 'signed-in',
                headers: { origin: 'https://evil.example' },
            }),
            '/api/discussion/'
        )

        expect(response.status).toBe(403)
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('forwards an anonymous read without a token', async () => {
        const fetchMock = upstreamReturns()

        await proxy(request('http://localhost:3000/api/discussion/comments'), '/api/discussion/')

        const sent = new Headers(fetchMock.mock.calls[0]![1]!.headers)
        expect(sent.get('authorization')).toBeNull()
    })

    it('runs anonymous reads out of tokens, signed-in ones not', async () => {
        upstreamReturns()
        const anonymous = () =>
            proxy(request('http://localhost:3000/api/discussion/comments'), '/api/discussion/')

        for (let i = 0; i < 20; i++) expect((await anonymous()).status).toBe(200)
        expect((await anonymous()).status).toBe(429)

        const signedIn = await proxy(
            request('http://localhost:3000/api/discussion/comments', { cookie: 'signed-in' }),
            '/api/discussion/'
        )
        expect(signedIn.status).toBe(200)
    })
})
