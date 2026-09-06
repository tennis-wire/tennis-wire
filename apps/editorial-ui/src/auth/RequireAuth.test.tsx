// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useAuth } from 'react-oidc-context'

import RequireAuth from './RequireAuth'

vi.mock('react-oidc-context', () => ({ useAuth: vi.fn() }))

/** What react-oidc-context reports after a silent renew fails. */
function deadSessionButUserStillLoaded() {
    vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        activeNavigator: undefined,
        user: { profile: { sub: 'u1' } },
        error: { name: 'ErrorResponse', message: 'invalid_grant' },
        signinRedirect: vi.fn(),
        signinPopup: vi.fn(),
    } as never)
}

describe('RequireAuth when a silent renew has failed', () => {
    it('keeps the editor mounted', () => {
        deadSessionButUserStillLoaded()

        render(
            <MemoryRouter>
                <RequireAuth>
                    <div>THE EDITOR</div>
                </RequireAuth>
            </MemoryRouter>
        )

        expect(screen.queryByText('THE EDITOR')).not.toBeNull()
    })
})
