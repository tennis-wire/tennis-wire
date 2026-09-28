import { read, write } from './api'

export type PollOption = { id: string; text: string; voteCount: number }

export type Poll = {
    id: string
    question: string
    closesAt: string | null
    closed: boolean
    voteCount: number
    // several options per reader; voteCount still counts readers, so the shares add up past 100
    multipleChoice: boolean
    options: PollOption[]
    // this reader's choice in the order the options stand in, empty when there is none or no reader
    viewerOptionIds: string[]
}

const POLLS = '/api/discussion/polls'

export function fetchPoll(id: string): Promise<Poll> {
    return read<Poll>(`${POLLS}/${encodeURIComponent(id)}`)
}

// The whole of this reader's choice, replacing what it was
export function castVote(id: string, optionIds: readonly string[]): Promise<void> {
    return write<void>('PUT', `${POLLS}/${encodeURIComponent(id)}/vote`, { optionIds })
}

export function retractVote(id: string): Promise<void> {
    return write<void>('DELETE', `${POLLS}/${encodeURIComponent(id)}/vote`)
}

// What this reader's choice becomes on a click: in a single-choice poll the option, or nothing
// when it was the one held; in a multiple-choice poll the option in or out of what is held
export function toggled(poll: Poll, optionId: string): string[] {
    const held = poll.viewerOptionIds.includes(optionId)
    if (!poll.multipleChoice) return held ? [] : [optionId]
    return held
        ? poll.viewerOptionIds.filter((id) => id !== optionId)
        : [...poll.viewerOptionIds, optionId]
}

export function sameChoice(a: readonly string[], b: readonly string[]): boolean {
    return a.length === b.length && a.every((id) => b.includes(id))
}

// The poll as it looks once this reader's choice goes from what it was to `to`, empty being none.
// Each option he takes or drops moves by one; the poll's count moves only when he starts or stops
// being a voter. Everyone else's stays where it is.
export function shifted(poll: Poll, to: readonly string[]): Poll {
    const from = poll.viewerOptionIds
    if (sameChoice(from, to)) return poll
    const voter = (choice: readonly string[]) => (choice.length > 0 ? 1 : 0)
    return {
        ...poll,
        voteCount: poll.voteCount + voter(to) - voter(from),
        viewerOptionIds: poll.options.map((o) => o.id).filter((id) => to.includes(id)),
        options: poll.options.map((option) => ({
            ...option,
            voteCount:
                option.voteCount +
                (to.includes(option.id) ? 1 : 0) -
                (from.includes(option.id) ? 1 : 0),
        })),
    }
}

// A share of the readers who voted, so in a multiple-choice poll the shares add up past 100
export function percent(option: PollOption, poll: Poll): number {
    return poll.voteCount === 0 ? 0 : Math.round((option.voteCount / poll.voteCount) * 100)
}
