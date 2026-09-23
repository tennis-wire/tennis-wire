import * as client from 'openid-client'

import { oidcConfig } from './config'
import { mayEdit } from './roles'
import type { Session } from './session'

// A page fires several requests at once; without this each one would spend its own refresh, and
// with rotation turned on later they would race. Keyed by the refresh token rather than by the
// reader: two devices of one reader are two sessions, and one must never get the other's tokens.
const inFlight = new Map<string, Promise<Session | null>>()

const EARLY_SECONDS = 30

export function isFresh(session: Session, now: number = Date.now()): boolean {
    return session.accessExpiresAt - EARLY_SECONDS > Math.floor(now / 1000)
}

// Returns the session to use, or null when the refresh token is spent and the
// reader has to sign in again.
export async function freshSession(session: Session): Promise<Session | null> {
    if (isFresh(session)) return session

    const running = inFlight.get(session.refreshToken)
    if (running) return running

    const attempt = refresh(session).finally(() => inFlight.delete(session.refreshToken))
    inFlight.set(session.refreshToken, attempt)
    return attempt
}

async function refresh(session: Session): Promise<Session | null> {
    try {
        const tokens = await client.refreshTokenGrant(await oidcConfig(), session.refreshToken)
        // Keycloak answers a refresh with a new id token, roles as they are now; without
        // one the flag stays what it was
        const claims = tokens.claims()
        return {
            sub: session.sub,
            accessToken: tokens.access_token,
            // Keycloak does not rotate refresh tokens by default, but it may.
            refreshToken: tokens.refresh_token ?? session.refreshToken,
            accessExpiresAt: Math.floor(Date.now() / 1000) + (tokens.expiresIn() ?? 0),
            canEdit: claims ? mayEdit(claims) : session.canEdit,
        }
    } catch (error) {
        console.error('refresh failed for %s', session.sub, error)
        return null
    }
}
