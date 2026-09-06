// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'

import { userManager } from './userManager'

// Neither store is the library default, and neither is visible from the UI, so
// nothing but this test would notice if they were quietly tidied away. Checked
// by behaviour rather than by reaching for the private _store field, which
// would break on a minor release of oidc-client-ts.
afterEach(() => {
    window.sessionStorage.clear()
    window.localStorage.clear()
})

describe('UserManager storage', () => {
    it('keeps the PKCE verifier in sessionStorage, not on disk', async () => {
        await userManager.settings.stateStore.set('probe', 'value')

        expect(window.sessionStorage.length).toBe(1)
        expect(window.localStorage.length).toBe(0)
    })

    it('keeps tokens out of both browser stores', async () => {
        await userManager.settings.userStore.set('probe', 'value')

        expect(window.sessionStorage.length).toBe(0)
        expect(window.localStorage.length).toBe(0)
        // Still a working store — it just lives in memory and dies with the tab.
        await expect(userManager.settings.userStore.get('probe')).resolves.toBe('value')
    })
})
