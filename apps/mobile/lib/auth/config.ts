// Mirrors public-web/lib/auth/config.ts. The client is public (registered as
// `mobile` in the realm, PKCE required), so there is no client secret here.

export const CLIENT_ID = 'mobile'

// offline_access keeps the refresh token working for thirty idle days, same
// as public-web. Since Keycloak 26.1 such a login leaves no SSO session
// behind, only an offline session.
export const SCOPES = ['openid', 'profile', 'email', 'offline_access']

function required(name: string, value: string | undefined): string {
    if (!value) throw new Error(`${name} is not set`)
    return value
}

// The realm, not the server: expo-auth-session discovers the endpoints from here.
export function keycloakIssuer(): string {
    return required('EXPO_PUBLIC_KEYCLOAK_ISSUER', process.env.EXPO_PUBLIC_KEYCLOAK_ISSUER)
}

export function gatewayOrigin(): string {
    return required('EXPO_PUBLIC_GATEWAY_ORIGIN', process.env.EXPO_PUBLIC_GATEWAY_ORIGIN).replace(
        /\/$/,
        ''
    )
}
