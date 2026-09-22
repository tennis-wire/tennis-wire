import { apiFetch } from '../../../api/apiFetch'

export interface CreatePoll {
    question: string
    options: string[]
    closesAt: string | null
}

export interface PollOption {
    id: string
    text: string
    voteCount: number
}

export interface Poll {
    id: string
    question: string
    closesAt: string | null
    closed: boolean
    voteCount: number
    options: PollOption[]
}

export class PollApiError extends Error {
    status: number

    constructor(status: number, message: string) {
        super(message)
        this.name = 'PollApiError'
        this.status = status
    }
}

export async function createPoll(poll: CreatePoll): Promise<Poll> {
    const response = await apiFetch('/api/discussion/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(poll),
    })
    if (!response.ok) {
        const body: { message?: string } = await response.json().catch(() => ({}))
        throw new PollApiError(response.status, body.message ?? `HTTP ${response.status}`)
    }
    return response.json() as Promise<Poll>
}
