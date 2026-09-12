// Which realm roles the signed-in person carries, read from the id token.
//
// The id token is the one issued to this client, so its claims are a contract
// with it. Realm roles also travel in the access token, but that one is
// addressed to the services and this app has no business opening it — see the
// realm-roles-in-id-token mapper on the editorial-ui client.
//
// None of this is a control. It decides what to offer, never what is allowed:
// the gateway and every service check the role again on each request.

import type { IdTokenClaims } from 'oidc-client-ts'

export const MODERATOR = 'moderator'

// Claims are typed as unknown, so the shape is checked rather than asserted
function isRealmAccess(value: unknown): value is { roles: string[] } {
    if (typeof value !== 'object' || value === null || !('roles' in value)) return false
    const { roles } = value as { roles: unknown }
    return Array.isArray(roles) && roles.every((role) => typeof role === 'string')
}

export function rolesOf(claims: IdTokenClaims | undefined): string[] {
    if (claims === undefined) return []
    const realmAccess: unknown = claims.realm_access
    return isRealmAccess(realmAccess) ? realmAccess.roles : []
}

// Composites are expanded by Keycloak, so admin answers true for moderator
export function hasRole(claims: IdTokenClaims | undefined, role: string): boolean {
    return rolesOf(claims).includes(role)
}
