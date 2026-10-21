// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'

import { aggregatorApi } from './api/aggregatorApi'
import { UNDO_MS } from './hooks/useUndoableDelete'
import type { Item, ItemCard, Source } from './types/aggregator'
import SourcesPage from './SourcesPage'

// the real one pulls in the UserManager, which wants a browser
vi.mock('../../api/apiFetch', () => ({ apiFetch: vi.fn() }))
vi.mock('react-oidc-context', () => ({
    useAuth: () => ({
        user: { profile: { sub: 'anna-sub', realm_access: { roles: ['author'] } } },
        signoutRedirect: vi.fn(),
    }),
}))
vi.mock('./api/aggregatorApi', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./api/aggregatorApi')>()
    return {
        ...actual,
        aggregatorApi: { feed: vi.fn(), item: vi.fn(), remove: vi.fn(), sources: vi.fn() },
    }
})

const api = vi.mocked(aggregatorApi)

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()

function card(id: string, title: string, source = 'eurosport-fr'): ItemCard {
    return {
        id,
        source,
        language: 'fr',
        title,
        titleBefore: null,
        lead: `Lead of ${title}`,
        publishedAt: minutesAgo(10),
        arrivedAt: minutesAgo(9),
        extraction: 'ok',
        hasEmbeds: false,
    }
}

function whole(id: string, title: string): Item {
    return {
        id,
        url: `https://www.eurosport.fr/tennis/${id}.shtml`,
        source: 'eurosport-fr',
        language: 'fr',
        title,
        titleBefore: 'Old title',
        lead: 'The lead',
        text: '## Une semaine décisive\n\nLe texte.\n\n<b>raw</b><script>alert(1)</script>',
        author: 'Rédaction',
        imageUrl: 'https://img.example.com/a.jpg',
        publishedAt: minutesAgo(10),
        arrivedAt: minutesAgo(9),
        categories: ['Tennis'],
        embeds: ['https://x.com/a/status/1', 'javascript:alert(1)'],
        extraction: 'ok',
    }
}

function source(key: string, name: string, overrides: Partial<Source> = {}): Source {
    return {
        key,
        name,
        language: 'fr',
        siteUrl: `https://${key}.example.com/`,
        retired: false,
        health: {
            problems: [],
            lastRunAt: null,
            lastStatus: 'ok',
            lastOkAt: null,
            lastNewAt: null,
            failuresInRow: 0,
            blockedSince: null,
            blockKind: null,
        },
        healthAt: minutesAgo(2),
        ...overrides,
    }
}

function open(path = '/desk/sources') {
    const router = createMemoryRouter([{ path: '/desk/sources', element: <SourcesPage /> }], {
        initialEntries: [path],
    })
    render(<RouterProvider router={router} />)
    return router
}

beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    api.sources.mockResolvedValue([
        source('eurosport-fr', 'Eurosport FR'),
        source('sports-ru', 'sports.ru', { language: 'ru' }),
    ])
    api.feed.mockResolvedValue({
        items: [card('a', 'First'), card('b', 'Second'), card('c', 'Third', 'sports-ru')],
        nextCursor: null,
    })
    api.item.mockImplementation(async (id) => whole(id, `Whole ${id}`))
    api.remove.mockResolvedValue(undefined)
})

afterEach(() => {
    vi.useRealTimers()
    cleanup()
})

describe('SourcesPage', () => {
    it('lists the feed by source name and opens an item beside it', async () => {
        const router = open()

        expect(await screen.findByText('First')).not.toBeNull()
        expect(screen.getAllByText('Eurosport FR')).toHaveLength(2)
        fireEvent.click(screen.getByText('Second'))

        expect(await screen.findByRole('heading', { name: 'Whole b' })).not.toBeNull()
        expect(router.state.location.search).toBe('?item=b')
        expect(screen.getByText('Было: «Old title»')).not.toBeNull()
        const make = screen.getByRole('link', { name: 'Сделать материал' })
        expect(make.getAttribute('href')).toBe('/editor/new?from=b')
        expect(make.getAttribute('target')).toBe('_blank')
    })

    it('renders the text as markdown and never its raw HTML or foreign pictures', async () => {
        open('/desk/sources?item=a')

        expect(await screen.findByRole('heading', { name: 'Une semaine décisive' })).not.toBeNull()
        expect(document.querySelector('script')).toBeNull()
        expect(document.querySelector('b')).toBeNull()
        const picture = document.querySelector('img')
        expect(picture?.getAttribute('referrerpolicy')).toBe('no-referrer')
        expect(screen.getByRole('link', { name: 'https://x.com/a/status/1' })).not.toBeNull()
        expect(screen.queryByText('javascript:alert(1)')).toBeNull()
    })

    it('deletes after the undo window, and an undone delete sends nothing', async () => {
        open()
        await screen.findByText('First')
        vi.useFakeTimers()

        fireEvent.click(screen.getByRole('button', { name: 'Удалить: First' }))
        expect(screen.queryByText('First')).toBeNull()
        fireEvent.click(screen.getByRole('button', { name: 'Отменить' }))
        expect(screen.getByText('First')).not.toBeNull()

        fireEvent.click(screen.getByRole('button', { name: 'Удалить: Second' }))
        act(() => {
            vi.advanceTimersByTime(UNDO_MS)
        })

        expect(api.remove).toHaveBeenCalledTimes(1)
        expect(api.remove).toHaveBeenCalledWith('b')
        expect(screen.queryByText('Second')).toBeNull()
    })

    it('moves to the next item when the open one is deleted', async () => {
        const router = open('/desk/sources?item=b')
        await screen.findByRole('heading', { name: 'Whole b' })

        fireEvent.click(screen.getByRole('button', { name: 'Удалить' }))

        await waitFor(() => expect(router.state.location.search).toBe('?item=c'))
        expect(await screen.findByRole('heading', { name: 'Whole c' })).not.toBeNull()
    })

    it('brings the next page by its cursor below the first', async () => {
        api.feed
            .mockResolvedValueOnce({ items: [card('a', 'First')], nextCursor: 'c1' })
            .mockResolvedValueOnce({ items: [card('d', 'Fourth')], nextCursor: null })
        open()
        await screen.findByText('First')

        fireEvent.click(screen.getByRole('button', { name: 'Показать ещё' }))

        expect(await screen.findByText('Fourth')).not.toBeNull()
        expect(api.feed.mock.calls[1][1]).toBe('c1')
        expect(screen.queryByRole('button', { name: 'Показать ещё' })).toBeNull()
    })

    it('filters by source and remembers the choice', async () => {
        open()
        await screen.findByText('First')

        fireEvent.click(screen.getByRole('button', { name: /Источники: все/ }))
        const menu = await screen.findByRole('presentation')
        fireEvent.click(within(menu).getByLabelText('sports.ru'))

        await waitFor(() =>
            expect(api.feed).toHaveBeenLastCalledWith(
                { sources: ['sports-ru'], languages: [], search: '' },
                null,
                50,
                expect.anything()
            )
        )
        expect(JSON.parse(localStorage.getItem('sources-filter:anna-sub')!)).toEqual({
            sources: ['sports-ru'],
            languages: [],
        })
    })

    it('says which sources are in trouble', async () => {
        api.sources.mockResolvedValue([
            source('eurosport-de', 'Eurosport DE', {
                health: {
                    ...source('x', 'x').health!,
                    problems: [{ kind: 'failing', detail: null }],
                    failuresInRow: 5,
                },
            }),
            source('bounces', 'Bounces'),
        ])
        open()

        expect(await screen.findByText(/1 источник работает с перебоями/)).not.toBeNull()
        fireEvent.click(screen.getByRole('button', { name: 'Подробнее' }))
        expect(screen.getByText(/не открывается, 5 попыток подряд/)).not.toBeNull()
    })

    it('says the collector is down when nothing was heard for half an hour', async () => {
        api.sources.mockResolvedValue([source('a', 'A', { healthAt: minutesAgo(45) })])
        open()

        expect(await screen.findByText(/Сбор новостей не работает с/)).not.toBeNull()
    })
})
