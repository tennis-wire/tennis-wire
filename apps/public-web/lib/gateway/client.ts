export function gatewayOrigin(): string {
    const value = process.env.GATEWAY_ORIGIN
    if (!value) throw new Error('GATEWAY_ORIGIN is not set')
    return value.replace(/\/$/, '')
}

export type Profile = {
    userId: string
    displayName: string
    displayNameChosen: boolean
    createdAt: string
}

// The first call also creates the profile: user-service resolves the identity
// on the way in, so a reader who has just signed in for the first time gets
// his reader-xxxxxxxx placeholder here.
export async function fetchProfile(accessToken: string): Promise<Profile | null> {
    try {
        const response = await fetch(`${gatewayOrigin()}/api/users/me`, {
            headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
            cache: 'no-store',
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
