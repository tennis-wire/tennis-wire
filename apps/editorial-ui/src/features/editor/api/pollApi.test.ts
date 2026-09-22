import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiFetch } from '../../../api/apiFetch'
import { PollApiError, createPoll } from './pollApi'

vi.mock('../../../api/apiFetch', () => ({ apiFetch: vi.fn() }))

const apiFetchMock = vi.mocked(apiFetch)

beforeEach(() => {
    apiFetchMock.mockReset()
})

describe('createPoll', () => {
    it('posts the poll as JSON and returns what the service made of it', async () => {
        const made = { id: 'p1', question: 'Who wins?', options: [] }
        apiFetchMock.mockResolvedValue(Response.json(made, { status: 201 }))
        const poll = { question: 'Who wins?', options: ['Sinner', 'Alcaraz'], closesAt: null }

        await expect(createPoll(poll)).resolves.toEqual(made)

        const [path, init] = apiFetchMock.mock.calls[0]
        expect(path).toBe('/api/discussion/polls')
        expect(init?.method).toBe('POST')
        expect(JSON.parse(init?.body as string)).toEqual(poll)
    })

    it('carries the status and the message of a refusal', async () => {
        apiFetchMock.mockResolvedValue(
            Response.json({ error: 'VALIDATION_ERROR', message: 'too few' }, { status: 400 })
        )

        const error = await createPoll({ question: '', options: [], closesAt: null }).catch(
            (e: unknown) => e
        )

        expect(error).toBeInstanceOf(PollApiError)
        expect((error as PollApiError).status).toBe(400)
        expect((error as PollApiError).message).toBe('too few')
    })
})
