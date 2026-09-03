import { apiFetch } from '../../../api/apiFetch'

export interface ChatMessage {
    role: 'user' | 'assistant'
    content: string
}

interface SendChatOptions {
    messages: ChatMessage[]
    onChunk: (accumulated: string) => void
    context?: string
    signal?: AbortSignal
}

export async function sendChatMessage(options: SendChatOptions): Promise<string> {
    const { messages, onChunk, context, signal } = options

    const response = await apiFetch(`/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, context }),
        signal,
    })

    if (!response.ok) {
        const error = await response.json().catch(() => null)
        throw new Error(error?.message ?? `Ошибка сервера: ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('Стриминг не поддерживается')

    const decoder = new TextDecoder()
    let accumulated = ''
    let lineBuffer = ''

    while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const text = lineBuffer + chunk
        const lines = text.split('\n')

        lineBuffer = lines.pop() ?? ''

        for (const line of lines) {
            if (line.startsWith('data:')) {
                const data = line.slice(5)
                if (data === '[DONE]') continue
                accumulated += data
            }
        }

        onChunk(accumulated)
    }

    if (lineBuffer.startsWith('data:')) {
        const data = lineBuffer.slice(5)
        if (data && data !== '[DONE]') {
            accumulated += data
            onChunk(accumulated)
        }
    }

    return accumulated
}
