// Which realm roles the signed-in person carries, read from the id token this client got.
// Realm roles travel in the access token too, but that one is addressed to the services.
//
// None of this is a control. It only decides whether to offer a link to the editor:
// editorial-ui and content-service check the role again on every request.

export const AUTHOR = 'author'

// Claims are typed loosely, so the shape is checked rather than asserted
function isRealmAccess(value: unknown): value is { roles: string[] } {
    if (typeof value !== 'object' || value === null || !('roles' in value)) return false
    const { roles } = value as { roles: unknown }
    return Array.isArray(roles) && roles.every((role) => typeof role === 'string')
}

export function rolesOf(claims: Record<string, unknown> | undefined): string[] {
    const realmAccess = claims?.realm_access
    return isRealmAccess(realmAccess) ? realmAccess.roles : []
}

// Composites are expanded by Keycloak, so a chief editor answers true as well
export function mayEdit(claims: Record<string, unknown> | undefined): boolean {
    return rolesOf(claims).includes(AUTHOR)
}
