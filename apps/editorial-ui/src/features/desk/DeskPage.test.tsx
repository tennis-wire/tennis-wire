// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, useParams } from 'react-router-dom'

import { articlesApi } from '../editor/api/contentApi'
import type { EditorialArticle, PagedResponse, WorkItem } from '../editor/types/content'
import DeskPage from './DeskPage'

// the real one pulls in the UserManager, which wants a browser
vi.mock('../../api/apiFetch', () => ({ apiFetch: vi.fn() }))
vi.mock('react-oidc-context', () => ({
    useAuth: () => ({
        user: { profile: { preferred_username: 'anna', realm_access: { roles: ['author'] } } },
        signoutRedirect: vi.fn(),
    }),
}))
vi.mock('../editor/api/contentApi', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../editor/api/contentApi')>()
    return {
        ...actual,
        articlesApi: {
            drafts: vi.fn(),
            edits: vi.fn(),
            getBySlug: vi.fn(),
            delete: vi.fn(),
        },
    }
})

const api = vi.mocked(articlesApi)

function page(items: WorkItem[]): PagedResponse<WorkItem> {
    return {
        content: items,
        page: { number: 0, size: 20, totalElements: items.length, totalPages: 1 },
    }
}

function item(id: string, title: string, wasPublished = false): WorkItem {
    return { id, type: 'news', title, wasPublished, updatedAt: '2026-09-23T10:00:00Z' }
}

function EditorStub() {
    const { id } = useParams()
    return <div>EDITOR {id}</div>
}

function openDesk() {
    const router = createMemoryRouter(
        [
            { path: '/desk', element: <DeskPage /> },
            { path: '/editor/:id', element: <EditorStub /> },
        ],
        { initialEntries: ['/desk'] }
    )
    render(<RouterProvider router={router} />)
    return router
}

beforeEach(() => {
    vi.clearAllMocks()
    api.drafts.mockResolvedValue(page([item('d1', 'Draft one'), item('d2', 'Pulled back', true)]))
    api.edits.mockResolvedValue(page([item('e1', 'Edit one', true)]))
})

afterEach(cleanup)

describe('DeskPage', () => {
    it('lists own drafts and edits, each leading to the editor', async () => {
        openDesk()

        const draft = await screen.findByRole('link', { name: 'Draft one' })
        expect(draft.getAttribute('href')).toBe('/editor/d1')
        const edit = await screen.findByRole('link', { name: 'Edit one' })
        expect(edit.getAttribute('href')).toBe('/editor/e1')
        expect(screen.getByText('снят с публикации')).not.toBeNull()
    })

    // one that has been on the site is kept: comments may hang on it
    it('offers to delete only drafts that were never published', async () => {
        openDesk()
        await screen.findByRole('link', { name: 'Draft one' })

        expect(screen.getAllByRole('button', { name: 'Удалить' })).toHaveLength(1)
    })

    it('deletes a draft once asked and lists the drafts again', async () => {
        vi.spyOn(window, 'confirm').mockReturnValue(true)
        api.delete.mockResolvedValue(undefined)
        openDesk()
        await screen.findByRole('link', { name: 'Draft one' })
        api.drafts.mockResolvedValue(page([item('d2', 'Pulled back', true)]))

        fireEvent.click(screen.getByRole('button', { name: 'Удалить' }))

        await waitFor(() => expect(screen.queryByRole('link', { name: 'Draft one' })).toBeNull())
        expect(api.delete).toHaveBeenCalledWith('d1')
    })

    it('opens a published article from its address on the site', async () => {
        api.getBySlug.mockResolvedValue({ id: 'a9' } as EditorialArticle)
        const router = openDesk()

        fireEvent.change(screen.getByLabelText('Открыть по ссылке'), {
            target: { value: 'https://tennis-wire.ru/news/sinner-wins' },
        })
        fireEvent.click(screen.getByRole('button', { name: 'Открыть' }))

        await screen.findByText('EDITOR a9')
        expect(api.getBySlug).toHaveBeenCalledWith('sinner-wins')
        expect(router.state.location.pathname).toBe('/editor/a9')
    })

    it('says so when the address is not an article', async () => {
        openDesk()

        fireEvent.change(screen.getByLabelText('Открыть по ссылке'), {
            target: { value: 'просто текст' },
        })
        fireEvent.click(screen.getByRole('button', { name: 'Открыть' }))

        expect(await screen.findByText('Не похоже на ссылку на материал')).not.toBeNull()
        expect(api.getBySlug).not.toHaveBeenCalled()
    })

    it('searches the drafts by title', async () => {
        openDesk()
        await screen.findByRole('link', { name: 'Draft one' })

        fireEvent.change(screen.getByPlaceholderText('Поиск по заголовку'), {
            target: { value: 'draft' },
        })

        await waitFor(() =>
            expect(api.drafts).toHaveBeenCalledWith(expect.objectContaining({ search: 'draft' }))
        )
    })
})
