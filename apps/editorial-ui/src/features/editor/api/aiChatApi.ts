import { apiFetch } from '../../../api/apiFetch'

export interface ChatMessage {
    role: 'user' | 'assistant'
    content: string
}

interface SendChatOptions {
    messages: ChatMessage[]
    onChunk: (accumulated: string) => void
    context?: string
    isSelection?: boolean
    signal?: AbortSignal
}

export async function sendChatMessage(options: SendChatOptions): Promise<string> {
    const { messages, onChunk, context, isSelection, signal } = options

    const response = await apiFetch(`/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, context, isSelection }),
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

    // Frames are separated by a blank line and a name holds until the next one,
    // so the parser has to carry it across reads rather than per chunk.
    let event = 'message'

    const consume = (raw: string): void => {
        const line = raw.replace(/\r$/, '')

        if (line === '') {
            event = 'message'
            return
        }
        if (line.startsWith('event:')) {
            event = line.slice(6).trim()
            return
        }
        if (!line.startsWith('data:')) return

        // Every payload is a JSON value, so a delta with newlines in it arrives
        // whole instead of being split across data: lines and losing them.
        const payload: unknown = JSON.parse(line.slice(5))

        if (event === 'error') {
            const message =
                typeof payload === 'object' && payload !== null && 'message' in payload
                    ? String((payload as { message: unknown }).message)
                    : 'AI-сервис вернул ошибку'
            throw new Error(message)
        }
        if (event === 'delta') accumulated += String(payload)
    }

    while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const text = lineBuffer + chunk
        const lines = text.split('\n')

        lineBuffer = lines.pop() ?? ''

        for (const line of lines) consume(line)

        onChunk(accumulated)
    }

    if (lineBuffer !== '') {
        consume(lineBuffer)
        onChunk(accumulated)
    }

    return accumulated
}
