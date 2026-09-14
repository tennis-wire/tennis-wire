import * as client from 'openid-client'

function required(name: string): string {
    const value = process.env[name]
    if (!value) throw new Error(`${name} is not set`)
    return value
}

/** Origin of this app. Taken from configuration, never from the Host header. */
export function appOrigin(): string {
    return required('APP_ORIGIN').replace(/\/$/, '')
}

/** The one redirect URI registered for this client in the realm. */
export function callbackUrl(): string {
    return `${appOrigin()}/api/auth/callback/keycloak`
}

let discovered: Promise<client.Configuration> | undefined

/**
 * Discovery is a network call to Keycloak; the result serves the whole process.
 * The promise is cached rather than the value, so concurrent first requests
 * share one call — but a rejected one is dropped, or a Keycloak that was slow
 * to start would keep the app broken until it restarts.
 */
export function oidcConfig(): Promise<client.Configuration> {
    discovered ??= client
        .discovery(
            new URL(required('KEYCLOAK_ISSUER')),
            required('KEYCLOAK_CLIENT_ID'),
            required('KEYCLOAK_CLIENT_SECRET'),
            undefined,
            // Keycloak is plain HTTP on the local stand, and openid-client
            // refuses that by default. In production the issuer is https and
            // the restriction stays on.
            process.env.NODE_ENV === 'production'
                ? undefined
                : { execute: [client.allowInsecureRequests] }
        )
        .catch((error: unknown) => {
            discovered = undefined
            throw error
        })
    return discovered
}
