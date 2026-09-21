import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiFetch } from '../../../api/apiFetch'
import { moderationApi, ModerationApiError } from './moderationApi'

// the real one pulls in the UserManager, which wants a browser
vi.mock('../../../api/apiFetch', () => ({ apiFetch: vi.fn() }))

const apiFetchMock = vi.mocked(apiFetch)

const USER = '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b'
const KEY = `${USER}/00112233445566778899aabbccddeeff.jpg`

beforeEach(() => {
    apiFetchMock.mockReset()
})

describe('avatar queue', () => {
    it('asks user-service for one batch', async () => {
        apiFetchMock.mockResolvedValue(Response.json({ items: [] }))

        await expect(moderationApi.avatarQueue(60)).resolves.toEqual({ items: [] })

        expect(apiFetchMock.mock.calls[0][0]).toBe('/api/users/moderation/avatars?size=60')
    })

    it('passes an avatar by the key that was on screen', async () => {
        apiFetchMock.mockResolvedValue(new Response(null, { status: 204 }))

        await moderationApi.approveAvatar(USER, KEY)

        const [path, init] = apiFetchMock.mock.calls[0]
        expect(path).toBe(`/api/users/${USER}/avatar/review`)
        expect(init?.method).toBe('PUT')
        expect(JSON.parse(init?.body as string)).toEqual({ avatarKey: KEY })
    })

    it('takes one down by the same key, slash and all', async () => {
        apiFetchMock.mockResolvedValue(new Response(null, { status: 204 }))

        await moderationApi.takeDownAvatar(USER, KEY)

        const [path, init] = apiFetchMock.mock.calls[0]
        expect(init?.method).toBe('DELETE')
        const url = new URL(path as string, 'http://gateway.test')
        expect(url.pathname).toBe(`/api/users/${USER}/avatar`)
        expect(url.searchParams.get('avatarKey')).toBe(KEY)
    })

    it('says so when the avatar changed under the moderator', async () => {
        apiFetchMock.mockResolvedValue(
            Response.json({ error: 'AVATAR_CHANGED', message: 'changed' }, { status: 409 })
        )

        const failure = await moderationApi.approveAvatar(USER, KEY).catch((e: unknown) => e)

        expect(failure).toBeInstanceOf(ModerationApiError)
        expect((failure as ModerationApiError).status).toBe(409)
        expect((failure as ModerationApiError).errorCode).toBe('AVATAR_CHANGED')
    })
})
