// Mirrors public-web/lib/gateway/client.ts, but calls the gateway directly
// with a bearer token instead of going through a BFF proxy: that proxy
// exists on web to keep tokens out of the browser, and mobile has no
// browser to keep them out of.

import { gatewayOrigin } from '../auth/config'

export type Profile = {
    userId: string
    displayName: string
    displayNameChosen: boolean
    createdAt: string
}

function authHeaders(accessToken: string): Record<string, string> {
    return { authorization: `Bearer ${accessToken}`, accept: 'application/json' }
}

// The first call also creates the profile: user-service resolves the
// identity on the way in, so a reader who has just signed in for the first
// time gets his reader-xxxxxxxx placeholder here.
export async function fetchProfile(accessToken: string): Promise<Profile | null> {
    try {
        const response = await fetch(`${gatewayOrigin()}/api/users/me`, {
            headers: authHeaders(accessToken),
        })
        if (!response.ok) {
            console.error('profile lookup answered %d', response.status)
            return null
        }
        return (await response.json()) as Profile
    } catch (error) {
        console.error('profile lookup failed', error)
        return null
    }
}

export type UpdateDisplayNameResult =
    { ok: true; profile: Profile } | { ok: false; conflict: boolean }

export async function updateDisplayName(
    accessToken: string,
    displayName: string
): Promise<UpdateDisplayNameResult> {
    let response: Response
    try {
        response = await fetch(`${gatewayOrigin()}/api/users/me`, {
            method: 'PATCH',
            headers: { ...authHeaders(accessToken), 'content-type': 'application/json' },
            body: JSON.stringify({ displayName }),
        })
    } catch (error) {
        console.error('display name update failed', error)
        return { ok: false, conflict: false }
    }
    if (response.status === 409) return { ok: false, conflict: true }
    if (!response.ok) return { ok: false, conflict: false }
    return { ok: true, profile: (await response.json()) as Profile }
}
