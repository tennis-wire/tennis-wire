import { describe, expect, it } from 'vitest'

import { mayEdit, rolesOf } from './roles'

describe('mayEdit', () => {
    it('lets an author through', () => {
        expect(mayEdit({ realm_access: { roles: ['user', 'author'] } })).toBe(true)
    })

    // chief-editor is a composite over author, and Keycloak expands it into the token
    it('lets a chief editor through by the author role he carries', () => {
        expect(mayEdit({ realm_access: { roles: ['chief-editor', 'author'] } })).toBe(true)
    })

    it('keeps a reader out', () => {
        expect(mayEdit({ realm_access: { roles: ['user', 'offline_access'] } })).toBe(false)
    })

    it('reads nothing into a claim of the wrong shape', () => {
        expect(rolesOf({ realm_access: { roles: 'author' } })).toEqual([])
        expect(rolesOf({ realm_access: null })).toEqual([])
        expect(mayEdit(undefined)).toBe(false)
    })
})
