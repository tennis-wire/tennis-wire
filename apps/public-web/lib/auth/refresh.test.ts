import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as client from 'openid-client'

import { freshSession, type Freshness } from './refresh'
import type { Session } from './session'

// The error classes stay real: which one comes back is what decides a sign-out
vi.mock('openid-client', async (original) => ({
    ...(await original<typeof import('openid-client')>()),
    refreshTokenGrant: vi.fn(),
}))
vi.mock('./config', () => ({ oidcConfig: vi.fn(async () => ({})) }))

const grant = vi.mocked(client.refreshTokenGrant)

function expired(sub: string, canEdit?: boolean): Session {
    return { sub, accessToken: 'old', refreshToken: 'refresh', accessExpiresAt: 0, canEdit }
}

function answer(
    claims: Record<string, unknown> | undefined,
    tokens: { access_token?: string; refresh_token?: string } = {}
) {
    return {
        access_token: 'new',
        refresh_token: 'refresh',
        ...tokens,
        expiresIn: () => 300,
        claims: () => claims,
    } as unknown as Awaited<ReturnType<typeof client.refreshTokenGrant>>
}

function usable(freshness: Freshness): Session {
    if (freshness.status !== 'usable')
        throw new Error(`expected a usable session, got ${freshness.status}`)
    return freshness.session
}

// A block, not an arrow returning the mock: vitest runs a function returned from a hook as its
// teardown, and it would call the mock once more after every test
beforeEach(() => {
    grant.mockReset()
})

describe('freshSession and the edit flag', () => {
    it('picks up an author role granted since sign-in', async () => {
        grant.mockResolvedValue(answer({ sub: 's1', realm_access: { roles: ['user', 'author'] } }))

        const session = usable(await freshSession(expired('s1', false)))

        expect(session.canEdit).toBe(true)
    })

    it('drops the flag once the role is taken away', async () => {
        grant.mockResolvedValue(answer({ sub: 's2', realm_access: { roles: ['user'] } }))

        const session = usable(await freshSession(expired('s2', true)))

        expect(session.canEdit).toBe(false)
    })

    it('keeps what it knew when the answer carries no id token', async () => {
        grant.mockResolvedValue(answer(undefined))

        const session = usable(await freshSession(expired('s3', true)))

        expect(session.canEdit).toBe(true)
        expect(session.accessToken).toBe('new')
    })
})

describe('refreshing concurrently', () => {
    function sessionOf(refreshToken: string): Session {
        return { sub: 'same-reader', accessToken: 'old', refreshToken, accessExpiresAt: 0 }
    }

    it('spends one refresh on requests that carry the same session', async () => {
        grant.mockResolvedValue(answer(undefined))

        const [first, second] = await Promise.all([
            freshSession(sessionOf('shared')),
            freshSession(sessionOf('shared')),
        ])

        expect(grant).toHaveBeenCalledTimes(1)
        expect(first).toBe(second)
    })

    it("never hands one device of a reader the other device's tokens", async () => {
        grant.mockImplementation(async (_config, refreshToken) =>
            answer(undefined, {
                access_token: `access-of-${refreshToken}`,
                refresh_token: refreshToken,
            })
        )

        const [phone, laptop] = await Promise.all([
            freshSession(sessionOf('phone')),
            freshSession(sessionOf('laptop')),
        ])

        expect(grant).toHaveBeenCalledTimes(2)
        expect(usable(phone).refreshToken).toBe('phone')
        expect(usable(laptop).refreshToken).toBe('laptop')
        expect(usable(laptop).accessToken).toBe('access-of-laptop')
    })
})

describe('a refresh that fails', () => {
    function refused(error: string, status: number) {
        return new client.ResponseBodyError('server responded with an error in the response body', {
            cause: { error, error_description: 'from the test' },
            response: new Response(null, { status }),
        })
    }

    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
    })
    afterEach(() => {
        vi.mocked(console.error).mockRestore()
    })

    it('signs the reader out when Keycloak says the token is spent', async () => {
        grant.mockRejectedValue(refused('invalid_grant', 400))

        expect((await freshSession(expired('s6'))).status).toBe('signed-out')
    })

    it('keeps the session when Keycloak cannot be reached', async () => {
        grant.mockRejectedValue(new TypeError('fetch failed'))

        expect((await freshSession(expired('s7'))).status).toBe('unavailable')
    })

    it('keeps the session when it is this client that Keycloak refuses', async () => {
        grant.mockRejectedValue(refused('unauthorized_client', 401))

        expect((await freshSession(expired('s8'))).status).toBe('unavailable')
    })
})
