// Someone else's page: the card from discussion-service and the date from user-service. Read from
// the browser through the BFF, which holds each reader to his own rate; a server render would reach
// the gateway from one address for everybody.

import { DiscussionError, read } from './discussion/api'
import { authorCard } from './discussion/endpoints'
import { readQueue } from './discussion/queue'
import type { AuthorCard } from './discussion/types'

// The large photo comes from user-service too: the card carries only the small one
export type Reader = AuthorCard & { createdAt: string; avatarLargeUrl: string | null }

const absent = (error: unknown) => error instanceof DiscussionError && error.status === 404

// null: there is no page, for an id nobody has and for someone under a restriction alike
export async function fetchReader(id: string): Promise<Reader | null> {
    try {
        const [card, profile] = await Promise.all([
            authorCard(id),
            readQueue(() =>
                read<{ createdAt: string; avatarLargeUrl?: string | null }>(
                    `/api/users/${encodeURIComponent(id)}`
                )
            ),
        ])
        return {
            ...card,
            createdAt: profile.createdAt,
            avatarLargeUrl: profile.avatarLargeUrl ?? null,
        }
    } catch (error) {
        if (absent(error)) return null
        throw error
    }
}
