// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { castVote, fetchPoll, retractVote, type Poll } from '@/lib/discussion/polls'

import PollWidget from './PollWidget'

vi.mock('@/components/auth/ReaderSessionProvider', () => ({
    useReaderSession: () => ({ session: { authenticated: true } }),
}))
vi.mock('@/lib/discussion/polls', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/discussion/polls')>()),
    fetchPoll: vi.fn(),
    castVote: vi.fn(),
    retractVote: vi.fn(),
}))

const fetched = vi.mocked(fetchPoll)
const cast = vi.mocked(castVote)
const retracted = vi.mocked(retractVote)

function poll(overrides: Partial<Poll> = {}): Poll {
    return {
        id: 'p',
        question: 'Who makes the semis?',
        closesAt: null,
        closed: false,
        multipleChoice: true,
        voteCount: 0,
        options: [
            { id: 'a', text: 'Sinner', voteCount: 0 },
            { id: 'b', text: 'Alcaraz', voteCount: 0 },
        ],
        viewerOptionIds: [],
        ...overrides,
    }
}

// A write the test answers when it chooses to
function held() {
    let settle: (error?: Error) => void = () => {}
    const promise = new Promise<void>((resolve, reject) => {
        settle = (error) => (error ? reject(error) : resolve())
    })
    return { promise, settle }
}

async function shown(loaded: Poll) {
    fetched.mockResolvedValue(loaded)
    render(<PollWidget id="p" fallback="" />)
    await screen.findByText(loaded.question)
}

const option = (text: string) => screen.getByRole('button', { name: new RegExp(text) })

beforeEach(() => {
    fetched.mockReset()
    cast.mockReset()
    retracted.mockReset()
})

afterEach(cleanup)

describe('PollWidget', () => {
    it('sends quick clicks one at a time, the last one with the whole choice', async () => {
        await shown(poll())
        const first = held()
        cast.mockReturnValueOnce(first.promise).mockResolvedValue(undefined)

        fireEvent.click(option('Sinner'))
        fireEvent.click(option('Alcaraz'))

        expect(cast).toHaveBeenCalledTimes(1)
        expect(cast).toHaveBeenLastCalledWith('p', ['a'])
        expect(option('Sinner').getAttribute('aria-pressed')).toBe('true')
        expect(option('Alcaraz').getAttribute('aria-pressed')).toBe('true')
        expect(screen.getByText('Можно выбрать несколько')).not.toBeNull()

        await act(async () => first.settle())

        expect(cast).toHaveBeenCalledTimes(2)
        expect(cast).toHaveBeenLastCalledWith('p', ['a', 'b'])
    })

    it('takes the choice back to what the service holds when a write fails', async () => {
        await shown(
            poll({
                voteCount: 1,
                viewerOptionIds: ['a'],
                options: [
                    { id: 'a', text: 'Sinner', voteCount: 1 },
                    { id: 'b', text: 'Alcaraz', voteCount: 0 },
                ],
            })
        )
        cast.mockRejectedValue(new Error('down'))

        await act(async () => fireEvent.click(option('Alcaraz')))

        expect(option('Sinner').getAttribute('aria-pressed')).toBe('true')
        expect(option('Alcaraz').getAttribute('aria-pressed')).toBe('false')
        expect(screen.getByText(/Не удалось сохранить голос/)).not.toBeNull()
    })

    it('retracts when the last option is taken off', async () => {
        await shown(
            poll({
                voteCount: 1,
                viewerOptionIds: ['b'],
                options: [
                    { id: 'a', text: 'Sinner', voteCount: 0 },
                    { id: 'b', text: 'Alcaraz', voteCount: 1 },
                ],
            })
        )
        retracted.mockResolvedValue(undefined)

        await act(async () => fireEvent.click(option('Alcaraz')))

        expect(retracted).toHaveBeenCalledWith('p')
        expect(cast).not.toHaveBeenCalled()
    })

    it('says until when an open poll takes votes, and nothing of the kind without a deadline', async () => {
        await shown(
            poll({ closesAt: new Date(new Date().getFullYear(), 9, 5, 18, 0).toISOString() })
        )
        expect(screen.getByText(/до 5 октября в 18:00/)).not.toBeNull()
        cleanup()

        await shown(poll())
        expect(screen.queryByText(/ до /)).toBeNull()
    })
})
