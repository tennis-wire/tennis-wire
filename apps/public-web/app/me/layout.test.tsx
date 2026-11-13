// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ReaderSession } from '@/components/auth/ReaderSessionProvider'
import type { CommentCount } from '@/lib/discussion/types'
import CabinetLayout from './layout'

const current: { session: ReaderSession | null } = { session: null }
const countByAuthor = vi.fn<(authorId: string) => Promise<CommentCount>>()

vi.mock('@/components/auth/ReaderSessionProvider', () => ({
    useReaderSession: () => ({ session: current.session, setSession: () => {} }),
}))
vi.mock('next/navigation', () => ({ usePathname: () => '/me' }))
vi.mock('@/lib/discussion/endpoints', () => ({
    countByAuthor: (authorId: string) => countByAuthor(authorId),
}))

const anna: ReaderSession = {
    authenticated: true,
    userId: 'user-1',
    displayName: 'Анна',
    displayNameChosen: true,
    createdAt: '2026-09-01T10:00:00Z',
    avatarUrl: null,
    avatarLargeUrl: null,
    editorialOrigin: null,
    staff: false,
}

afterEach(() => {
    cleanup()
    countByAuthor.mockReset()
})

describe('the cabinet header', () => {
    it('shows what her comments collected next to how many there are', async () => {
        current.session = anna
        countByAuthor.mockResolvedValue({
            count: 5,
            likeCount: 12,
            dislikeCount: 3,
            emojiCounts: { laugh: 2 },
        })

        render(<CabinetLayout>tab</CabinetLayout>)

        expect(await screen.findByRole('img', { name: 'Нравится: 12' })).toBeTruthy()
        expect(screen.getByRole('img', { name: 'Не нравится: 3' })).toBeTruthy()
        expect(screen.getByRole('img', { name: 'Смешно: 2' })).toBeTruthy()
        expect(screen.getByText('комментариев')).toBeTruthy()
        expect(countByAuthor).toHaveBeenCalledWith('user-1')
    })

    it('leaves the numbers out when they did not come', async () => {
        current.session = anna
        countByAuthor.mockRejectedValue(new Error('down'))

        render(<CabinetLayout>tab</CabinetLayout>)

        expect(await screen.findByText('tab')).toBeTruthy()
        // past the rejection and its catch
        await new Promise((resolve) => setTimeout(resolve, 0))
        expect(countByAuthor).toHaveBeenCalled()
        expect(screen.queryByRole('list', { name: 'Реакции на комментарии' })).toBeNull()
    })
})
