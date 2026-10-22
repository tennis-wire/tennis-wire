import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiFetch } from '../../../api/apiFetch'
import { AggregatorApiError, aggregatorApi, messageOf } from './aggregatorApi'

// the real one pulls in the UserManager, which wants a browser
vi.mock('../../../api/apiFetch', () => ({ apiFetch: vi.fn() }))

const apiFetchMock = vi.mocked(apiFetch)

beforeEach(() => {
    apiFetchMock.mockReset()
})

function sentUrl(call = 0): URL {
    return new URL(apiFetchMock.mock.calls[call][0] as string, 'http://gateway.test')
}

describe('aggregatorApi', () => {
    it('asks for the feed with repeated filters, the search and the cursor', async () => {
        apiFetchMock.mockResolvedValue(Response.json({ items: [], nextCursor: null }))

        await aggregatorApi.feed(
            { sources: ['sports-ru', 'eurosport-fr'], languages: ['fr'], search: ' Sinner ' },
            'abc',
            50
        )

        const url = sentUrl()
        expect(url.pathname).toBe('/api/aggregator/items')
        expect(url.searchParams.getAll('source')).toEqual(['sports-ru', 'eurosport-fr'])
        expect(url.searchParams.getAll('language')).toEqual(['fr'])
        expect(url.searchParams.get('search')).toBe('Sinner')
        expect(url.searchParams.get('cursor')).toBe('abc')
        expect(url.searchParams.get('limit')).toBe('50')
    })

    it('leaves out what is not asked for', async () => {
        apiFetchMock.mockResolvedValue(Response.json({ items: [], nextCursor: null }))

        await aggregatorApi.feed({ sources: [], languages: [], search: '  ' }, null, 50)

        expect([...sentUrl().searchParams.keys()]).toEqual(['limit'])
    })

    it('deletes by id', async () => {
        apiFetchMock.mockResolvedValue(new Response(null, { status: 204 }))

        await aggregatorApi.remove('7f1c')

        expect(sentUrl().pathname).toBe('/api/aggregator/items/7f1c')
        expect(apiFetchMock.mock.calls[0][1]?.method).toBe('DELETE')
    })

    it('says plainly that an item is gone', async () => {
        apiFetchMock.mockResolvedValue(
            Response.json({ error: 'NOT_FOUND', message: 'Item not found' }, { status: 404 })
        )

        const failure = await aggregatorApi.item('7f1c').catch((e: unknown) => e)

        expect(failure).toBeInstanceOf(AggregatorApiError)
        expect((failure as AggregatorApiError).errorCode).toBe('NOT_FOUND')
        expect(messageOf(failure)).toBe('Новости уже нет: её удалили или истёк срок.')
    })
})
