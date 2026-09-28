// Which groups the signed-in person is in, read from the id token this client got: full paths,
// /readers for a reader, /staff/... for staff. The site carries no staff roles at all.
//
// None of this is a control. canEdit only offers a link to the editor, staff only swaps the
// deletion on /me for a note: editorial-ui, content-service and user-service decide for themselves.

const EDITORS = ['/staff/authors', '/staff/chief-editors']
const STAFF = '/staff/'

// Claims are typed loosely, so the shape is checked rather than asserted. null: no usable claim
export function groupsOf(claims: Record<string, unknown> | undefined): string[] | null {
    const groups = claims?.groups
    return Array.isArray(groups) && groups.every((group) => typeof group === 'string')
        ? groups
        : null
}

// A moderator is left out: the editor would answer him 403
export function mayEdit(claims: Record<string, unknown> | undefined): boolean {
    return groupsOf(claims)?.some((group) => EDITORS.includes(group)) ?? false
}

// Keycloak leaves the claim out for someone in no group at all, and user-service refuses an account
// without it its deletion. Read the same way here, so the site does not offer what would be refused
export function isStaff(claims: Record<string, unknown> | undefined): boolean {
    const groups = groupsOf(claims)
    return groups === null || groups.some((group) => group.startsWith(STAFF))
}
