// @vitest-environment jsdom
import { useEffect } from 'react'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryRouter, RouterProvider, useLocation, useParams } from 'react-router-dom'

import { articlesApi } from '../api/contentApi'
import { NEW } from '../lib/draftBuffer'
import { sessionKeyOf } from '../lib/sessionKey'
import type { EditorialArticle } from '../types/content'
import { useArticleSession } from './useArticleSession'

// the real one pulls in the UserManager, which wants a browser
vi.mock('../../../api/apiFetch', () => ({ apiFetch: vi.fn() }))
vi.mock('../api/contentApi', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../api/contentApi')>()
    return {
        ...actual,
        articlesApi: {
            create: vi.fn(),
            get: vi.fn(),
            save: vi.fn(),
            publish: vi.fn(),
            discardEdit: vi.fn(),
            delete: vi.fn(),
        },
    }
})

const api = vi.mocked(articlesApi)
type Session = ReturnType<typeof useArticleSession>

let session: Session
let mounts = 0

function Probe({ articleId, sessionKey }: { articleId: string | null; sessionKey: string }) {
    const current = useArticleSession({ articleId, sessionKey, sub: 'u1', showSnackbar: vi.fn() })
    useEffect(() => {
        mounts += 1
    }, [])
    useEffect(() => {
        session = current
    })
    return null
}

// What EditorRoute does, without the page around it
function Route() {
    const { id = NEW } = useParams()
    const sessionKey = sessionKeyOf(useLocation())
    return <Probe key={sessionKey} sessionKey={sessionKey} articleId={id === NEW ? null : id} />
}

function open(path: string) {
    const router = createMemoryRouter([{ path: '/editor/:id', element: <Route /> }], {
        initialEntries: [path],
    })
    render(<RouterProvider router={router} />)
    return router
}

function article(overrides: Partial<EditorialArticle> = {}): EditorialArticle {
    return {
        id: 'a1',
        type: 'news',
        status: 'draft',
        slug: null,
        version: 'a:0',
        working: {
            title: 'Title',
            subtitle: null,
            content: '<p>Body</p>',
            coverImageUrl: null,
            readingTime: null,
            sourceUrl: null,
            sourceName: null,
            tags: [],
        },
        live: null,
        lockedBy: null,
        aggregatorItemId: null,
        publishedAt: null,
        firstPublishedAt: null,
        updatedAt: '2026-09-23T10:00:00Z',
        createdAt: '2026-09-23T10:00:00Z',
        ...overrides,
    }
}

beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    mounts = 0
})

afterEach(cleanup)

describe('useArticleSession', () => {
    it('opens a saved draft clean', async () => {
        api.get.mockResolvedValue(article())

        open('/editor/a1')

        await waitFor(() => expect(session.loadState).toBe('ready'))
        expect(session.mode).toBe('draft')
        expect(session.metadata.title).toBe('Title')
        expect(session.content).toBe('<p>Body</p>')
        expect(session.dirty).toBe(false)
    })

    it('saves the whole working copy with the version it was opened at', async () => {
        api.get.mockResolvedValue(article())
        api.save.mockImplementation(async (_id, request) =>
            article({
                version: 'a:1',
                working: { ...article().working, title: request.title, content: request.content },
            })
        )
        open('/editor/a1')
        await waitFor(() => expect(session.loadState).toBe('ready'))

        act(() => session.setMetadata((m) => ({ ...m, title: 'Changed' })))
        await waitFor(() => expect(session.dirty).toBe(true))
        await act(() => session.save())

        expect(api.save).toHaveBeenCalledWith(
            'a1',
            expect.objectContaining({ version: 'a:0', title: 'Changed', content: '<p>Body</p>' })
        )
        expect(session.dirty).toBe(false)
        expect(session.article?.version).toBe('a:1')
    })

    it('keeps a new article mounted when its first save gives it an address', async () => {
        api.create.mockResolvedValue(article({ id: 'fresh', working: { ...article().working } }))
        const router = open('/editor/new')
        await waitFor(() => expect(session.editor).not.toBeNull())

        act(() => {
            session.setMetadata((m) => ({ ...m, title: 'Title' }))
            session.editor?.commands.setContent('<p>Body</p>')
        })
        await act(() => session.save())

        expect(router.state.location.pathname).toBe('/editor/fresh')
        expect(mounts).toBe(1)
        expect(api.get).not.toHaveBeenCalled()
        expect(session.mode).toBe('draft')
        expect(session.dirty).toBe(false)
    })

    it('shows the caller his own pending edit next to the site', async () => {
        api.get.mockResolvedValue(
            article({
                status: 'published',
                version: 'e:2',
                firstPublishedAt: '2026-09-20T10:00:00Z',
                live: { ...article().working, title: 'On the site' },
            })
        )

        open('/editor/a1')

        await waitFor(() => expect(session.loadState).toBe('ready'))
        expect(session.mode).toBe('published')
        expect(session.article?.live?.title).toBe('On the site')
    })

    it('makes an article held by someone else read-only', async () => {
        api.get.mockResolvedValue(
            article({
                status: 'published',
                firstPublishedAt: '2026-09-20T10:00:00Z',
                lockedBy: 'oleg',
            })
        )

        open('/editor/a1')

        await waitFor(() => expect(session.mode).toBe('locked'))
        expect(session.editor?.isEditable).toBe(false)
    })

    it('says so when the article is not there', async () => {
        const { ContentApiError } = await import('../api/contentApi')
        api.get.mockRejectedValue(new ContentApiError(404, 'NOT_FOUND', 'Article not found'))

        open('/editor/a1')

        await waitFor(() => expect(session.loadState).toBe('missing'))
    })
})
