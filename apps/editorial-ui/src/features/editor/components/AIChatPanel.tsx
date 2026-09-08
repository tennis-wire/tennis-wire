import React, { useState, useRef, useEffect } from 'react'
import {
    Box,
    Paper,
    Typography,
    TextField,
    IconButton,
    Button,
    CircularProgress,
    Tooltip,
    Select,
    MenuItem,
} from '@mui/material'
import { Send, Close, ContentCopy, Check, Refresh, Psychology } from '@mui/icons-material'
import { useEditorState } from '@tiptap/react'
import type { Editor } from '@tiptap/react'
import { useAppTheme } from '../../../theme'

import { sendChatMessage } from '../api/aiChatApi'
import type { AiModelId } from '../api/aiChatApi'
import { MarkdownMessage } from './MarkdownMessage'
import { markdownToHtml } from '../lib/markdown'

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

/**
 * Stands in for when there is no editor at all.
 *
 * `useEditorState` has nothing to run its selector against in that case and
 * returns null, which is a different situation from an editor that exists but
 * holds an empty document — the selector handles that one itself.
 */
const EMPTY_CONTEXT = { text: '', isSelection: false }

const AI_MODELS: { id: AiModelId; label: string }[] = [
    { id: 'HAIKU', label: 'Haiku · быстрая' },
    { id: 'SONNET', label: 'Sonnet · обычная' },
    { id: 'OPUS', label: 'Opus · сильная' },
]

export const AIChatPanel: React.FC<Props> = ({ editor, isOpen, onClose }) => {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [copiedId, setCopiedId] = useState<string | null>(null)
    const [model, setModel] = useState<AiModelId>('SONNET')
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const abortRef = useRef<AbortController | null>(null)
    const { colors } = useAppTheme()

    /**
     * Recomputed on every editor transaction rather than on React renders.
     *
     * The panel has no state of its own that changes when a selection moves, so
     * reading the selection during render left the badge showing whatever it
     * happened to compute last — it only caught up when something unrelated,
     * like saving a draft, forced a re-render.
     */
    const context =
        useEditorState({
            editor,
            selector: ({ editor: e }): { text: string; isSelection: boolean } => {
                if (!e) return { text: '', isSelection: false }
                const { from, to } = e.state.selection
                const selectedText = e.state.doc.textBetween(from, to, ' ')
                if (selectedText.trim()) return { text: selectedText, isSelection: true }
                return { text: e.getText(), isSelection: false }
            },
        }) ?? EMPTY_CONTEXT

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    useEffect(() => {
        return () => abortRef.current?.abort()
    }, [])

    const handleSend = async (customPrompt?: string) => {
        const prompt = customPrompt || input.trim()
        if (!prompt || isLoading) return

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

        const apiMessages = [
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            { role: 'user' as const, content: prompt },
        ]

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
                isSelection: context.isSelection,
                model,
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

    const handleCopy = async (text: string, id: string) => {
        // Two flavours on purpose. text/html is what the editor picks up, so a
        // paste keeps its formatting; text/plain stays markdown because a paste
        // into Telegram or a ticket reads better with the asterisks left in.
        try {
            await navigator.clipboard.write([
                new ClipboardItem({
                    'text/html': new Blob([markdownToHtml(text)], { type: 'text/html' }),
                    'text/plain': new Blob([text], { type: 'text/plain' }),
                }),
            ])
        } catch {
            await navigator.clipboard.writeText(text)
        }
        setCopiedId(id)
        setTimeout(() => setCopiedId(null), 2000)
    }

    const handleInsert = (text: string, mode: 'replace' | 'below') => {
        if (!editor) return

        // TipTap parses a string that looks like markup, so converting first is
        // what turns ** into bold instead of literal asterisks in the document.
        const html = markdownToHtml(text)

        if (mode === 'replace') {
            const { from, to } = editor.state.selection
            if (from !== to) {
                editor.chain().focus().deleteSelection().insertContent(html).run()
                return
            }
        }

        // The '\n\n' prefix is gone: a newline is not a paragraph break in
        // ProseMirror, and the converted HTML carries its own block structure.
        editor.chain().focus().insertContent(html).run()
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

    if (!isOpen) return null

    return (
        <Paper
            elevation={0}
            sx={{
                width: 380,
                height: '100vh',
                position: 'sticky',
                top: 0,
                display: 'flex',
                flexDirection: 'column',
                borderLeft: `1px solid ${colors.border}`,
                backgroundColor: colors.bg,
                flexShrink: 0,
            }}
        >
            {/* title */}
            <Box
                sx={{
                    p: 2,
                    borderBottom: `1px solid ${colors.border}`,
                    backgroundColor: colors.surface,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Psychology sx={{ color: colors.accent }} />
                    <Typography
                        sx={{
                            fontFamily: 'var(--tw-font-display)',
                            fontSize: '1rem',
                            fontWeight: 700,
                            color: colors.text,
                        }}
                    >
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
                sx={{
                    px: 2,
                    py: 1,
                    backgroundColor: colors.bgAlt,
                    borderBottom: `1px solid ${colors.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1,
                }}
            >
                <Typography sx={{ fontSize: '0.75rem', color: colors.textMuted }}>
                    📎 Контекст: {context.isSelection ? 'выделенный текст' : 'весь текст'}
                    {context.text && ` (${context.text.split(/\s+/).length} слов)`}
                </Typography>

                <Select
                    value={model}
                    onChange={(e) => setModel(e.target.value as AiModelId)}
                    variant="standard"
                    disableUnderline
                    disabled={isLoading}
                    sx={{
                        fontSize: '0.75rem',
                        color: colors.textMuted,
                        '& .MuiSelect-select': { py: 0, pr: '20px !important' },
                        '& .MuiSelect-icon': { color: colors.textMuted },
                    }}
                >
                    {AI_MODELS.map((m) => (
                        <MenuItem key={m.id} value={m.id} sx={{ fontSize: '0.8rem' }}>
                            {m.label}
                        </MenuItem>
                    ))}
                </Select>
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
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                        <Psychology sx={{ fontSize: 48, color: colors.border, mb: 1 }} />
                        <Typography sx={{ fontSize: '0.85rem', color: colors.textMuted }}>
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
                                backgroundColor:
                                    message.role === 'user'
                                        ? `${colors.primary}12`
                                        : colors.surface,
                                border: `1px solid`,
                                borderColor:
                                    message.role === 'user' ? `${colors.primary}30` : colors.border,
                                borderRadius: '12px',
                            }}
                        >
                            {message.role === 'assistant' ? (
                                <MarkdownMessage content={message.content} />
                            ) : (
                                <Typography
                                    sx={{
                                        whiteSpace: 'pre-wrap',
                                        fontSize: '0.875rem',
                                        color: colors.text,
                                        lineHeight: 1.6,
                                    }}
                                >
                                    {message.content}
                                </Typography>
                            )}
                        </Paper>

                        {message.role === 'assistant' && message.content && !isLoading && (
                            <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, ml: 0.5 }}>
                                <Button
                                    size="small"
                                    variant="text"
                                    sx={{
                                        fontSize: '0.7rem',
                                        minWidth: 0,
                                        px: 1,
                                        color: colors.primary,
                                    }}
                                    onClick={() => handleInsert(message.content, 'replace')}
                                >
                                    Заменить
                                </Button>
                                <Button
                                    size="small"
                                    variant="text"
                                    sx={{
                                        fontSize: '0.7rem',
                                        minWidth: 0,
                                        px: 1,
                                        color: colors.primary,
                                    }}
                                    onClick={() => handleInsert(message.content, 'below')}
                                >
                                    Вставить
                                </Button>
                                <IconButton
                                    size="small"
                                    onClick={() => handleCopy(message.content, message.id)}
                                >
                                    {copiedId === message.id ? (
                                        <Check fontSize="small" sx={{ color: colors.primary }} />
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
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            cursor: 'pointer',
                        }}
                        onClick={handleStop}
                    >
                        <CircularProgress size={16} sx={{ color: colors.accent }} />
                        <Typography sx={{ fontSize: '0.85rem', color: colors.textMuted }}>
                            AI думает... (клик чтобы остановить)
                        </Typography>
                    </Box>
                )}

                <div ref={messagesEndRef} />
            </Box>

            {/* input field */}
            <Box
                sx={{
                    p: 2,
                    borderTop: `1px solid ${colors.border}`,
                    backgroundColor: colors.surface,
                }}
            >
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
                        onClick={() => handleSend()}
                        disabled={!input.trim() || isLoading}
                        sx={{
                            backgroundColor: colors.primary,
                            color: '#fff',
                            borderRadius: '10px',
                            '&:hover': {
                                backgroundColor: colors.primaryDark,
                            },
                            '&.Mui-disabled': {
                                backgroundColor: colors.border,
                                color: colors.textMuted,
                            },
                        }}
                    >
                        <Send fontSize="small" />
                    </IconButton>
                </Box>
                <Typography
                    sx={{
                        mt: 0.5,
                        display: 'block',
                        fontSize: '0.7rem',
                        color: colors.textMuted,
                    }}
                >
                    Enter для отправки · Shift+Enter для новой строки
                </Typography>
            </Box>
        </Paper>
    )
}
