import { read, write } from './api'

export type PollOption = { id: string; text: string; voteCount: number }

export type Poll = {
    id: string
    question: string
    closesAt: string | null
    closed: boolean
    voteCount: number
    options: PollOption[]
    // this reader's choice, when there is a reader
    viewerOptionId: string | null
}

const POLLS = '/api/discussion/polls'

export function fetchPoll(id: string): Promise<Poll> {
    return read<Poll>(`${POLLS}/${encodeURIComponent(id)}`)
}

export function castVote(id: string, optionId: string): Promise<void> {
    return write<void>('PUT', `${POLLS}/${encodeURIComponent(id)}/vote`, { optionId })
}

export function retractVote(id: string): Promise<void> {
    return write<void>('DELETE', `${POLLS}/${encodeURIComponent(id)}/vote`)
}

// The poll as it looks once this reader's choice goes from what it was to `to`, null being none.
// One vote moves by one; everyone else's stays where it is.
export function shifted(poll: Poll, to: string | null): Poll {
    const from = poll.viewerOptionId
    if (from === to) return poll
    return {
        ...poll,
        voteCount: poll.voteCount + (to ? 1 : 0) - (from ? 1 : 0),
        viewerOptionId: to,
        options: poll.options.map((option) => ({
            ...option,
            voteCount: option.voteCount + (option.id === to ? 1 : 0) - (option.id === from ? 1 : 0),
        })),
    }
}

export function percent(option: PollOption, poll: Poll): number {
    return poll.voteCount === 0 ? 0 : Math.round((option.voteCount / poll.voteCount) * 100)
}
