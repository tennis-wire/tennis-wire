import * as client from 'openid-client'

import { oidcConfig } from './config'
import { mayEdit } from './roles'
import type { Session } from './session'

// What a request can do with the session it came with
export type Freshness =
    | { status: 'usable'; session: Session }
    // The refresh token is spent: revoked, past its lifetime, or its account shut. Only a new
    // sign-in helps.
    | { status: 'signed-out' }
    // Keycloak gave no answer about the token. The reader is most likely still signed in, and
    // throwing his cookie away would end his session over our outage.
    | { status: 'unavailable' }

// A page fires several requests at once; without this each one would spend its own refresh, and
// with rotation turned on later they would race. Keyed by the refresh token rather than by the
// reader: two devices of one reader are two sessions, and one must never get the other's tokens.
const inFlight = new Map<string, Promise<Freshness>>()

const EARLY_SECONDS = 30

export function isFresh(session: Session, now: number = Date.now()): boolean {
    return session.accessExpiresAt - EARLY_SECONDS > Math.floor(now / 1000)
}

export async function freshSession(session: Session): Promise<Freshness> {
    if (isFresh(session)) return { status: 'usable', session }

    const running = inFlight.get(session.refreshToken)
    if (running) return running

    const attempt = refresh(session).finally(() => inFlight.delete(session.refreshToken))
    inFlight.set(session.refreshToken, attempt)
    return attempt
}

async function refresh(session: Session): Promise<Freshness> {
    try {
        const tokens = await client.refreshTokenGrant(await oidcConfig(), session.refreshToken)
        // Keycloak answers a refresh with a new id token, roles as they are now; without
        // one the flag stays what it was
        const claims = tokens.claims()
        return {
            status: 'usable',
            session: {
                sub: session.sub,
                accessToken: tokens.access_token,
                // Keycloak does not rotate refresh tokens by default, but it may.
                refreshToken: tokens.refresh_token ?? session.refreshToken,
                accessExpiresAt: Math.floor(Date.now() / 1000) + (tokens.expiresIn() ?? 0),
                canEdit: claims ? mayEdit(claims) : session.canEdit,
            },
        }
    } catch (error) {
        // The one answer that is about the token itself: revoked, expired, account disabled.
        // Anything else, a refused client secret included, is about us or the network, and the
        // reader should not pay for it with his session.
        if (error instanceof client.ResponseBodyError && error.error === 'invalid_grant') {
            return { status: 'signed-out' }
        }
        console.error('refresh failed for %s', session.sub, error)
        return { status: 'unavailable' }
    }
}
