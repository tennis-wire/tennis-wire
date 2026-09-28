// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ReaderSession } from '@/components/auth/ReaderSessionProvider'
import ProfilePage from './page'

const current: { session: ReaderSession | null } = { session: null }

vi.mock('@/components/auth/ReaderSessionProvider', () => ({
    useReaderSession: () => ({ session: current.session, setSession: () => {} }),
}))
// The forms go their own way; here only what stands in the deletion row matters
vi.mock('@/components/auth/AvatarForm', () => ({ default: () => null }))
vi.mock('@/components/auth/NicknameForm', () => ({ default: () => null }))
vi.mock('@/components/auth/DeleteAccount', () => ({ default: () => <p>the deletion steps</p> }))

const STAFF_NOTE = 'Аккаунт сотрудника удаляет администратор'

function signedIn(staff: boolean): ReaderSession {
    return {
        authenticated: true,
        userId: 'user-1',
        displayName: 'Анна',
        displayNameChosen: true,
        createdAt: '2026-09-01T10:00:00Z',
        avatarUrl: null,
        avatarLargeUrl: null,
        editorialOrigin: null,
        staff,
    }
}

afterEach(cleanup)

describe('the account section of /me', () => {
    it('tells staff who deletes their account, and offers no deletion', () => {
        current.session = signedIn(true)

        render(<ProfilePage />)

        expect(screen.getByText(STAFF_NOTE)).toBeTruthy()
        expect(screen.queryByText('the deletion steps')).toBeNull()
    })

    it('offers a reader the deletion', () => {
        current.session = signedIn(false)

        render(<ProfilePage />)

        expect(screen.getByText('the deletion steps')).toBeTruthy()
        expect(screen.queryByText(STAFF_NOTE)).toBeNull()
    })
})
