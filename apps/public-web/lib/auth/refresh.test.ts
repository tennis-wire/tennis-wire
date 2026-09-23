import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as client from 'openid-client'

import { freshSession } from './refresh'
import type { Session } from './session'

vi.mock('openid-client', () => ({ refreshTokenGrant: vi.fn() }))
vi.mock('./config', () => ({ oidcConfig: vi.fn(async () => ({})) }))

const grant = vi.mocked(client.refreshTokenGrant)

function expired(sub: string, canEdit?: boolean): Session {
    return { sub, accessToken: 'old', refreshToken: 'refresh', accessExpiresAt: 0, canEdit }
}

function answer(claims: Record<string, unknown> | undefined) {
    return {
        access_token: 'new',
        refresh_token: 'refresh',
        expiresIn: () => 300,
        claims: () => claims,
    } as unknown as Awaited<ReturnType<typeof client.refreshTokenGrant>>
}

beforeEach(() => grant.mockReset())

describe('freshSession and the edit flag', () => {
    it('picks up an author role granted since sign-in', async () => {
        grant.mockResolvedValue(answer({ sub: 's1', realm_access: { roles: ['user', 'author'] } }))

        const session = await freshSession(expired('s1', false))

        expect(session?.canEdit).toBe(true)
    })

    it('drops the flag once the role is taken away', async () => {
        grant.mockResolvedValue(answer({ sub: 's2', realm_access: { roles: ['user'] } }))

        const session = await freshSession(expired('s2', true))

        expect(session?.canEdit).toBe(false)
    })

    it('keeps what it knew when the answer carries no id token', async () => {
        grant.mockResolvedValue(answer(undefined))

        const session = await freshSession(expired('s3', true))

        expect(session?.canEdit).toBe(true)
        expect(session?.accessToken).toBe('new')
    })
})
