import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
    Box,
    Paper,
    Typography,
    TextField,
    IconButton,
    Button,
    CircularProgress,
    Tooltip,
} from '@mui/material'
import { Send, Close, ContentCopy, Check, Refresh, Psychology } from '@mui/icons-material'
import type { Editor } from '@tiptap/react'

import { sendChatMessage } from '../api/aiChatApi'

interface Message {
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: Date
}

interface Props {
    editor: Editor | null
    isOpen: boolean
    onClose: () => void
}

export const AIChatPanel: React.FC<Props> = ({ editor, isOpen, onClose }) => {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [copiedId, setCopiedId] = useState<string | null>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const abortRef = useRef<AbortController | null>(null)

    const getContext = useCallback((): { text: string; isSelection: boolean } => {
        if (!editor) return { text: '', isSelection: false }
        const { from, to } = editor.state.selection
        const selectedText = editor.state.doc.textBetween(from, to, ' ')
        if (selectedText.trim()) return { text: selectedText, isSelection: true }
        return { text: editor.getText(), isSelection: false }
    }, [editor])

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    useEffect(() => {
        return () => abortRef.current?.abort()
    }, [])

    const handleSend = async (customPrompt?: string) => {
        const prompt = customPrompt || input.trim()
        if (!prompt || isLoading) return

        const context = getContext()

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: prompt,
            timestamp: new Date(),
        }

        const assistantMessageId = (Date.now() + 1).toString()

        setMessages((prev) => [...prev, userMessage])
        setInput('')
        setIsLoading(true)

        // collecting history
        const apiMessages = [
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            { role: 'user' as const, content: prompt },
        ]

        // create an empty assistant message
        setMessages((prev) => [
            ...prev,
            { id: assistantMessageId, role: 'assistant', content: '', timestamp: new Date() },
        ])

        try {
            abortRef.current = new AbortController()

            await sendChatMessage({
                messages: apiMessages,
                onChunk: (accumulated: string) => {
                    setMessages((prev) =>
                        prev.map((m) =>
                            m.id === assistantMessageId ? { ...m, content: accumulated } : m
                        )
                    )
                },
                context: context.text || undefined,
                signal: abortRef.current.signal,
            })
        } catch (error: unknown) {
            if (error instanceof Error && error.name === 'AbortError') return

            const errorMessage =
                error instanceof Error ? error.message : 'Не удалось получить ответ от AI'

            setMessages((prev) => [
                ...prev.filter((m) => m.id !== assistantMessageId),
                {
                    id: assistantMessageId,
                    role: 'assistant',
                    content: `⚠️ ${errorMessage}`,
                    timestamp: new Date(),
                },
            ])
        } finally {
            setIsLoading(false)
            abortRef.current = null
        }
    }

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text)
        setCopiedId(id)
        setTimeout(() => setCopiedId(null), 2000)
    }

    const handleInsert = (text: string, mode: 'replace' | 'below') => {
        if (!editor) return
        if (mode === 'replace') {
            const { from, to } = editor.state.selection
            if (from !== to) {
                editor.chain().focus().deleteSelection().insertContent(text).run()
            } else {
                editor.chain().focus().insertContent(text).run()
            }
        } else {
            editor
                .chain()
                .focus()
                .insertContent('\n\n' + text)
                .run()
        }
    }

    const handleStop = () => {
        abortRef.current?.abort()
        setIsLoading(false)
    }

    const handleClear = () => {
        abortRef.current?.abort()
        setMessages([])
        setIsLoading(false)
    }

    const context = getContext()

    if (!isOpen) return null

    return (
        <Paper
            elevation={3}
            sx={{
                width: 380,
                height: '100vh',
                position: 'sticky',
                top: 0,
                display: 'flex',
                flexDirection: 'column',
                borderLeft: '1px solid #e0e0e0',
                backgroundColor: '#fafafa',
                flexShrink: 0,
            }}
        >
            {/* title */}
            <Box
                sx={{
                    p: 2,
                    borderBottom: '1px solid #e0e0e0',
                    backgroundColor: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Psychology color="primary" />
                    <Typography variant="h6" sx={{ fontSize: '1rem' }}>
                        AI-помощник
                    </Typography>
                </Box>
                <Box>
                    <Tooltip title="Очистить историю">
                        <IconButton size="small" onClick={handleClear}>
                            <Refresh fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Закрыть">
                        <IconButton size="small" onClick={onClose}>
                            <Close fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>

            {/* context */}
            <Box
                sx={{ px: 2, py: 1, backgroundColor: '#f5f5f5', borderBottom: '1px solid #e0e0e0' }}
            >
                <Typography variant="caption" color="text.secondary">
                    📎 Контекст: {context.isSelection ? 'выделенный текст' : 'весь текст'}
                    {context.text && ` (${context.text.split(/\s+/).length} слов)`}
                </Typography>
            </Box>

            {/* messages */}
            <Box
                sx={{
                    flex: 1,
                    overflow: 'auto',
                    p: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                }}
            >
                {messages.length === 0 && (
                    <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                        <Psychology sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
                        <Typography variant="body2">
                            Выделите текст и задайте вопрос,
                            <br />
                            или используйте быстрые команды
                        </Typography>
                    </Box>
                )}

                {messages.map((message) => (
                    <Box
                        key={message.id}
                        sx={{
                            alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                            maxWidth: '90%',
                        }}
                    >
                        <Paper
                            elevation={0}
                            sx={{
                                p: 1.5,
                                backgroundColor: message.role === 'user' ? '#e3f2fd' : '#fff',
                                border: '1px solid',
                                borderColor: message.role === 'user' ? '#bbdefb' : '#e0e0e0',
                                borderRadius: 2,
                            }}
                        >
                            <Typography
                                variant="body2"
                                sx={{ whiteSpace: 'pre-wrap', fontSize: '0.875rem' }}
                            >
                                {message.content}
                            </Typography>
                        </Paper>

                        {message.role === 'assistant' && message.content && !isLoading && (
                            <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, ml: 0.5 }}>
                                <Button
                                    size="small"
                                    variant="text"
                                    sx={{ fontSize: '0.7rem', minWidth: 0, px: 1 }}
                                    onClick={() => handleInsert(message.content, 'replace')}
                                >
                                    Заменить
                                </Button>
                                <Button
                                    size="small"
                                    variant="text"
                                    sx={{ fontSize: '0.7rem', minWidth: 0, px: 1 }}
                                    onClick={() => handleInsert(message.content, 'below')}
                                >
                                    Вставить
                                </Button>
                                <IconButton
                                    size="small"
                                    onClick={() => handleCopy(message.content, message.id)}
                                >
                                    {copiedId === message.id ? (
                                        <Check fontSize="small" color="success" />
                                    ) : (
                                        <ContentCopy sx={{ fontSize: 14 }} />
                                    )}
                                </IconButton>
                            </Box>
                        )}
                    </Box>
                ))}

                {isLoading && (
                    <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}
                        onClick={handleStop}
                    >
                        <CircularProgress size={16} />
                        <Typography variant="body2" color="text.secondary">
                            AI думает... (клик чтобы остановить)
                        </Typography>
                    </Box>
                )}

                <div ref={messagesEndRef} />
            </Box>

            {/* input field */}
            <Box sx={{ p: 2, borderTop: '1px solid #e0e0e0', backgroundColor: '#fff' }}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                        fullWidth
                        size="small"
                        placeholder="Спросите AI..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                handleSend()
                            }
                        }}
                        multiline
                        maxRows={3}
                        disabled={isLoading}
                    />
                    <IconButton
                        color="primary"
                        onClick={() => handleSend()}
                        disabled={!input.trim() || isLoading}
                    >
                        <Send />
                    </IconButton>
                </Box>
                <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mt: 0.5, display: 'block' }}
                >
                    Enter для отправки • Shift+Enter для новой строки
                </Typography>
            </Box>
        </Paper>
    )
}
