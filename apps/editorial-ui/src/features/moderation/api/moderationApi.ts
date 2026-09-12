// Moderation API client. Everything goes through the gateway, as the rest does.

import { apiFetch } from '../../../api/apiFetch'
import type { ModerationQueue, Resolution } from '../types/moderation'

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
}
