import { describe, expect, it } from 'vitest'

import { groupsOf, isStaff, mayEdit } from './groups'

describe('mayEdit', () => {
    it('lets an author through', () => {
        expect(mayEdit({ groups: ['/staff/authors'] })).toBe(true)
    })

    it('lets a chief editor through', () => {
        expect(mayEdit({ groups: ['/staff/admins', '/staff/chief-editors'] })).toBe(true)
    })

    // The editor would answer him 403
    it('offers a moderator nothing', () => {
        expect(mayEdit({ groups: ['/staff/moderators'] })).toBe(false)
    })

    it('keeps a reader out', () => {
        expect(mayEdit({ groups: ['/readers'] })).toBe(false)
    })

    it('keeps out whoever carries no groups claim', () => {
        expect(mayEdit({ sub: 's1' })).toBe(false)
    })
})

describe('isStaff', () => {
    it('knows staff by any group under /staff/', () => {
        expect(isStaff({ groups: ['/staff/moderators'] })).toBe(true)
        expect(isStaff({ groups: ['/staff/admins'] })).toBe(true)
    })

    it('takes a reader for a reader', () => {
        expect(isStaff({ groups: ['/readers'] })).toBe(false)
        expect(isStaff({ groups: [] })).toBe(false)
        expect(isStaff({ groups: ['/staffers'] })).toBe(false)
    })

    // Keycloak leaves the claim out for someone in no group at all, and user-service refuses such
    // an account its deletion: the site does not offer what would be refused
    it('takes a missing claim for staff', () => {
        expect(isStaff({ sub: 's1' })).toBe(true)
        expect(isStaff(undefined)).toBe(true)
    })
})

describe('groupsOf', () => {
    it('reads nothing into a claim of the wrong shape', () => {
        expect(groupsOf({ groups: '/staff/authors' })).toBeNull()
        expect(groupsOf({ groups: [1] })).toBeNull()
        expect(groupsOf(undefined)).toBeNull()
    })
})
