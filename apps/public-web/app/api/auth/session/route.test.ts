import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { GET } from './route'

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

const fetchProfile = vi.fn()
vi.mock('@/lib/gateway/client', () => ({
    fetchProfile: (token: string) => fetchProfile(token),
}))

function request(cookie?: string) {
    const headers = new Headers()
    if (cookie) headers.set('cookie', `tw_session=${cookie}`)
    return new NextRequest('http://localhost:3000/api/auth/session', { headers })
}

beforeEach(() => {
    fetchProfile.mockReset()
})

describe('GET /api/auth/session', () => {
    it('answers a stranger with authenticated: false and asks nobody', async () => {
        const response = await GET(request())

        expect(await response.json()).toEqual({ authenticated: false })
        expect(fetchProfile).not.toHaveBeenCalled()
    })

    it('hands the reader his id and name, never a token', async () => {
        fetchProfile.mockResolvedValue({
            userId: 'user-1',
            displayName: 'reader-3fa9c2d1',
            displayNameChosen: false,
            avatarUrl: 'http://media/96/k.jpg',
            avatarLargeUrl: 'http://media/288/k.jpg',
            createdAt: '2026-09-01T10:00:00Z',
        })

        const response = await GET(request('signed-in'))
        const body = await response.json()

        expect(fetchProfile).toHaveBeenCalledWith('access-token')
        expect(body).toEqual({
            authenticated: true,
            userId: 'user-1',
            displayName: 'reader-3fa9c2d1',
            displayNameChosen: false,
            createdAt: '2026-09-01T10:00:00Z',
            avatarUrl: 'http://media/96/k.jpg',
            avatarLargeUrl: 'http://media/288/k.jpg',
        })
        expect(JSON.stringify(body)).not.toContain('token')
        expect(response.headers.get('cache-control')).toBe('no-store')
    })

    it('stays signed in without a profile and does not nag', async () => {
        fetchProfile.mockResolvedValue(null)

        const body = await (await GET(request('signed-in'))).json()

        expect(body).toEqual({
            authenticated: true,
            userId: null,
            displayName: null,
            displayNameChosen: true,
            createdAt: null,
            avatarUrl: null,
            avatarLargeUrl: null,
        })
    })
})
