import { apiFetch } from '../../../api/apiFetch'

export interface TranslateResult {
    text: string
    detectedSourceLanguage?: string
}

export async function translate(
    text: string,
    sourceLang: string | null,
    targetLang: string
): Promise<TranslateResult> {
    const response = await apiFetch(`/api/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, sourceLang, targetLang }),
    })

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `Server error: ${response.status}`)
    }

    return response.json()
}
