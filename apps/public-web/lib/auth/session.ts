import { sealData, unsealData } from 'iron-session'

/** Tokens for the gateway. Sent with every request to this app. */
export const SESSION_COOKIE = 'tw_session'

/** PKCE verifier, state and nonce. Lives between /api/auth/login and the callback. */
export const FLOW_COOKIE = 'tw_flow'

/**
 * The id_token, kept only to pass as `id_token_hint` when ending the Keycloak
 * session. Scoped to the logout path: without a hint Keycloak asks the reader
 * to confirm the logout, but carrying another kilobyte and a half on every
 * request to pay for that is the worse trade.
 */
export const ID_TOKEN_COOKIE = 'tw_idt'

/** Matches `offlineSessionIdleTimeout` in the realm. */
const SESSION_TTL = 30 * 24 * 60 * 60
const FLOW_TTL = 10 * 60

export type Session = {
    sub: string
    accessToken: string
    refreshToken: string
    /** Epoch seconds. */
    accessExpiresAt: number
    /**
     * Carried the author role in the last id token: at sign-in, then on every refresh,
     * so a role granted or taken away shows within one access token lifetime. Only
     * decides whether the site offers a link to the editor. Absent in cookies sealed
     * before it existed, which reads as false until the next refresh.
     */
    canEdit?: boolean
}

export type Flow = {
    codeVerifier: string
    state: string
    nonce: string
    returnTo: string
}

function password(): string {
    const value = process.env.SESSION_PASSWORD
    if (!value || value.length < 32) {
        throw new Error('SESSION_PASSWORD must be set and at least 32 characters long')
    }
    return value
}

/**
 * `lax`, not `strict`: the callback and the post-logout redirect both arrive as
 * top-level navigations from Keycloak, and `strict` would withhold the cookie
 * on exactly those two requests. Cross-site POSTs stay covered, and the proxy
 * checks Origin on its own.
 */
function cookieOptions(maxAge: number, path = '/') {
    return {
        httpOnly: true,
        sameSite: 'lax' as const,
        secure: appIsHttps(),
        path,
        maxAge,
    }
}

function appIsHttps(): boolean {
    return (process.env.APP_ORIGIN ?? '').startsWith('https://')
}

export function sessionCookieOptions() {
    return cookieOptions(SESSION_TTL)
}

export function flowCookieOptions() {
    return cookieOptions(FLOW_TTL)
}

export function idTokenCookieOptions() {
    return cookieOptions(SESSION_TTL, '/api/auth/logout')
}

export async function sealSession(session: Session): Promise<string> {
    return sealData(session, { password: password(), ttl: SESSION_TTL })
}

export async function sealFlow(flow: Flow): Promise<string> {
    return sealData(flow, { password: password(), ttl: FLOW_TTL })
}

/**
 * iron-session answers a tampered, expired or badly rotated cookie with an
 * empty object rather than an error, so an empty result here means "no
 * session", not "broken session".
 */
export async function readSession(seal: string | undefined): Promise<Session | null> {
    if (!seal) return null
    const data = await unsealData<Session>(seal, { password: password(), ttl: SESSION_TTL })
    return data?.sub ? data : null
}

export async function readFlow(seal: string | undefined): Promise<Flow | null> {
    if (!seal) return null
    const data = await unsealData<Flow>(seal, { password: password(), ttl: FLOW_TTL })
    return data?.codeVerifier ? data : null
}
