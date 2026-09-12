import { describe, expect, it } from 'vitest'

import { hasRole, rolesOf } from './realmRoles'

// Claims arrive as unknown, so anything at all can turn up in that field
describe('reading realm roles out of id token claims', () => {
    it('reads the roles Keycloak puts there', () => {
        const claims = { sub: 'u1', realm_access: { roles: ['moderator', 'user'] } } as never

        expect(rolesOf(claims)).toEqual(['moderator', 'user'])
        expect(hasRole(claims, 'moderator')).toBe(true)
        expect(hasRole(claims, 'admin')).toBe(false)
    })

    it('treats a missing or misshapen claim as no roles at all', () => {
        expect(rolesOf(undefined)).toEqual([])
        expect(rolesOf({ sub: 'u1' } as never)).toEqual([])
        expect(rolesOf({ sub: 'u1', realm_access: 'moderator' } as never)).toEqual([])
        expect(rolesOf({ sub: 'u1', realm_access: { roles: 'moderator' } } as never)).toEqual([])
        expect(rolesOf({ sub: 'u1', realm_access: { roles: [1, 2] } } as never)).toEqual([])
    })
})
