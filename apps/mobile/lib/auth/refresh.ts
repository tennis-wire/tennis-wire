// Mirrors public-web/lib/auth/refresh.ts. No in-flight dedup map here: that
// exists on web because one server handles many concurrent browser
// requests: mobile has one reader per app instance, so there is nothing to
// race against.

import * as AuthSession from 'expo-auth-session'
import type { DiscoveryDocument } from 'expo-auth-session'

import { CLIENT_ID } from './config'
import { isFresh } from './freshness'
import type { Session } from './session'

export { isFresh } from './freshness'

// Returns the session to use, or null when the refresh token is spent and
// the reader has to sign in again.
export async function freshSession(
    session: Session,
    discovery: Pick<DiscoveryDocument, 'tokenEndpoint'>
): Promise<Session | null> {
    if (isFresh(session.accessExpiresAt)) return session

    try {
        const tokens = await AuthSession.refreshAsync(
            { clientId: CLIENT_ID, refreshToken: session.refreshToken },
            discovery
        )
        return {
            accessToken: tokens.accessToken,
            // Keycloak does not rotate refresh tokens by default, but it may.
            refreshToken: tokens.refreshToken ?? session.refreshToken,
            idToken: tokens.idToken ?? session.idToken,
            accessExpiresAt: Math.floor(Date.now() / 1000) + (tokens.expiresIn ?? 0),
        }
    } catch (error) {
        console.error('token refresh failed', error)
        return null
    }
}
