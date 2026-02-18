import { TRANSCRIBE_API } from './apiConfig'

export interface TranscriptionSegment {
    start: number
    end: number
    text: string
    speaker: string | null
}

export interface TranscriptionResult {
    text: string
    language: string
    duration: number
    segments: TranscriptionSegment[]
}

export type JobStatus = 'idle' | 'pending' | 'downloading' | 'processing' | 'completed' | 'failed'

export interface TranscriptionJob {
    job_id: string
    status: JobStatus
    progress: number
    status_message: string | null
    error: string | null
}

/** create a task via url */
export async function transcribeUrl(
    url: string,
    language?: string,
    enableDiarization?: boolean
): Promise<{ job_id: string }> {
    const response = await fetch(`${TRANSCRIBE_API}/api/transcribe/url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            url,
            language: language || undefined,
            enable_diarization: enableDiarization ?? false,
        }),
    })
    if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.detail || `Server error: ${response.status}`)
    }
    return response.json()
}

/** create a task from a file */
export async function transcribeFile(
    file: File,
    language?: string,
    enableDiarization?: boolean
): Promise<{ job_id: string }> {
    const formData = new FormData()
    formData.append('file', file)
    if (language) formData.append('language', language)
    if (enableDiarization) formData.append('enable_diarization', 'true')

    const response = await fetch(`${TRANSCRIBE_API}/api/transcribe/file`, {
        method: 'POST',
        body: formData,
    })
    if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.detail || `Ошибка сервера: ${response.status}`)
    }
    return response.json()
}

/** check task status */
export async function getJobStatus(jobId: string): Promise<TranscriptionJob> {
    const response = await fetch(`${TRANSCRIBE_API}/api/transcribe/${jobId}`)
    if (!response.ok) throw new Error('Ошибка получения статуса')
    return response.json()
}

/** get the result */
export async function getJobResult(jobId: string): Promise<TranscriptionResult> {
    const response = await fetch(`${TRANSCRIBE_API}/api/transcribe/${jobId}/result`)
    if (!response.ok) throw new Error('Ошибка получения результата')
    const data = await response.json()
    return data.result
}

/** cancel task */
export async function cancelJob(jobId: string): Promise<void> {
    await fetch(`${TRANSCRIBE_API}/api/transcribe/${jobId}`, { method: 'DELETE' })
}
