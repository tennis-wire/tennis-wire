// Moderation API client. Everything goes through the gateway, as the rest does.

import { apiFetch } from '../../../api/apiFetch'
import type { AvatarQueue, ModerationQueue, Resolution } from '../types/moderation'

export class ModerationApiError extends Error {
    status: number
    errorCode: string

    constructor(status: number, errorCode: string, message: string) {
        super(message)
        this.name = 'ModerationApiError'
        this.status = status
        this.errorCode = errorCode
    }
}

async function check(response: Response): Promise<void> {
    if (response.ok) return
    const body: { error?: string; message?: string } = await response.json().catch(() => ({}))
    throw new ModerationApiError(
        response.status,
        body.error ?? 'UNKNOWN_ERROR',
        body.message ?? `HTTP ${response.status}`
    )
}

export const moderationApi = {
    async queue(page: number, size: number): Promise<ModerationQueue> {
        const response = await apiFetch(
            `/api/discussion/moderation/reports?status=open&page=${page}&size=${size}`
        )
        await check(response)
        return response.json() as Promise<ModerationQueue>
    },

    /** Closes every open report on the comment at once; the server answers 204. */
    async resolve(commentId: string, resolution: Resolution): Promise<void> {
        const response = await apiFetch(`/api/discussion/moderation/reports/${commentId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resolution }),
        })
        await check(response)
    },

    // First page only: whatever is decided leaves the queue, so the next call is the next batch
    async avatarQueue(size: number): Promise<AvatarQueue> {
        const response = await apiFetch(`/api/users/moderation/avatars?size=${size}`)
        await check(response)
        return response.json() as Promise<AvatarQueue>
    },

    // Both decisions carry the key on screen: an avatar uploaded since answers 409 AVATAR_CHANGED
    async approveAvatar(userId: string, avatarKey: string): Promise<void> {
        const response = await apiFetch(`/api/users/${encodeURIComponent(userId)}/avatar/review`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ avatarKey }),
        })
        await check(response)
    },

    // Not counted against the reader anywhere
    async takeDownAvatar(userId: string, avatarKey: string): Promise<void> {
        const response = await apiFetch(
            `/api/users/${encodeURIComponent(userId)}/avatar?avatarKey=${encodeURIComponent(avatarKey)}`,
            { method: 'DELETE' }
        )
        await check(response)
    },
}
