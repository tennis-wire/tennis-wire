import React, { useState, useRef } from 'react'
import {
    IconButton,
    ToggleButton,
    ToggleButtonGroup,
    Divider,
    Box,
    Tooltip,
    Button,
    Menu,
    MenuItem,
} from '@mui/material'
import {
    FormatBold,
    FormatItalic,
    FormatUnderlined,
    FormatListBulleted,
    FormatListNumbered,
    FormatQuote,
    Link,
    LinkOff,
    Image,
    HorizontalRule,
    Undo,
    Redo,
    SmartToy,
    Translate,
    Upload,
    YouTube,
    Telegram,
    OndemandVideo,
    Mic,
} from '@mui/icons-material'
import type { Editor } from '@tiptap/react'

interface Props {
    editor: Editor | null
    onTranslateClick?: () => void // Открыть диалог перевода
    onTranscribeClick?: () => void // Открыть диалог транскрипции
}

export const Toolbar: React.FC<Props> = ({ editor, onTranslateClick, onTranscribeClick }) => {
    const [aiAnchor, setAiAnchor] = useState<null | HTMLElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    if (!editor) return null

    const handleAiClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        setAiAnchor(event.currentTarget)
    }

    const handleAiClose = () => {
        setAiAnchor(null)
    }

    const handleTranslateClick = () => {
        handleAiClose()
        onTranslateClick?.()
    }

    const handleTranscribeClick = () => {
        handleAiClose()
        onTranscribeClick?.()
    }

    const handleFileUpload = () => {
        fileInputRef.current?.click()
    }

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file || !file.type.startsWith('image/')) return

        const reader = new FileReader()
        reader.onload = (e) => {
            const url = e.target?.result as string
            editor.chain().focus().setImage({ src: url }).run()
        }
        reader.readAsDataURL(file)

        event.target.value = ''
    }

    const extractYoutubeId = (url: string): string | null => {
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
            /youtube\.com\/shorts\/([^&\n?#]+)/,
        ]

        for (const pattern of patterns) {
            const match = url.match(pattern)
            if (match) return match[1]
        }
        return null
    }

    const handleYoutubeInsert = () => {
        const url = window.prompt(
            'Вставьте ссылку на YouTube видео:',
            'https://youtube.com/watch?v='
        )
        if (!url) return

        const videoId = extractYoutubeId(url)
        if (!videoId) {
            alert(
                'Не удалось распознать ссылку на YouTube. Поддерживаются форматы:\n• youtube.com/watch?v=...\n• youtu.be/...\n• youtube.com/shorts/...'
            )
            return
        }

        editor
            .chain()
            .focus()
            .setYoutubeVideo({ src: `https://www.youtube.com/watch?v=${videoId}` })
            .run()
    }

    // telegram post embed
    const handleTelegramInsert = () => {
        const url = window.prompt('Вставьте ссылку на пост Telegram:', 'https://t.me/channel/123')
        if (!url) return

        const match = url.match(/(?:t\.me|telegram\.me)\/([^/]+)\/(\d+)/)
        if (!match) {
            alert('Не удалось распознать ссылку на Telegram.\nФормат: https://t.me/channel/123')
            return
        }

        editor.chain().focus().setTelegramPost({ src: url }).run()
    }

    const handleVideoInsert = () => {
        const url = window.prompt('Вставьте прямую ссылку на видео (.mp4, .webm):', 'https://')
        if (!url) return

        const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.m4v']
        const isVideo = videoExtensions.some((ext) => url.toLowerCase().includes(ext))

        if (!isVideo) {
            const proceed = window.confirm(
                'Эта ссылка не похожа на прямую ссылку на видео файл.\n\nДля YouTube используйте кнопку YouTube.\nДля Telegram используйте кнопку Telegram.\n\nВсё равно вставить?'
            )
            if (!proceed) return
        }

        editor.chain().focus().setVideo({ src: url }).run()
    }

    const isValidUrl = (url: string) => {
        try {
            new URL(url)
            return true
        } catch {
            return false
        }
    }

    const normalizeUrl = (url: string) => {
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            return `https://${url}`
        }
        return url
    }

    const handleLinkClick = () => {
        if (editor.isActive('link')) {
            const currentHref = editor.getAttributes('link').href
            const url = window.prompt(
                'Редактировать URL ссылки (оставьте пустым для удаления):',
                currentHref
            )
            if (url === null) return
            if (url === '') {
                editor.chain().focus().unsetLink().run()
            } else {
                const normalizedUrl = normalizeUrl(url)
                if (!isValidUrl(normalizedUrl)) {
                    alert('Пожалуйста, введите корректный URL')
                    return
                }
                editor.chain().focus().setLink({ href: normalizedUrl }).run()
            }
        } else {
            const text = editor.state.doc.textBetween(
                editor.state.selection.from,
                editor.state.selection.to,
                ' '
            )
            const defaultUrl = text.startsWith('http') ? text : 'https://'
            const url = window.prompt('Введите URL ссылки:', defaultUrl)
            if (url) {
                const normalizedUrl = normalizeUrl(url)
                if (!isValidUrl(normalizedUrl)) {
                    alert('Пожалуйста, введите корректный URL')
                    return
                }
                if (editor.state.selection.empty) {
                    editor
                        .chain()
                        .focus()
                        .insertContent(`<a href="${normalizedUrl}">${normalizedUrl}</a>`)
                        .run()
                } else {
                    editor.chain().focus().setLink({ href: normalizedUrl }).run()
                }
            }
        }
    }

    const handleRemoveLink = () => {
        if (editor.isActive('link')) {
            editor.chain().focus().unsetLink().run()
            return
        }

        const { from, to } = editor.state.selection

        if (from !== to) {
            const linkMark = editor.state.doc.rangeHasMark(from, to, editor.schema.marks.link)
            if (linkMark) {
                editor.chain().focus().unsetLink().run()
                return
            }
        }

        if (from === to) {
            const resolvedPos = editor.state.doc.resolve(from)
            const linkMarkAtPos = resolvedPos.marks().find((mark) => mark.type.name === 'link')

            if (linkMarkAtPos) {
                const { node } = resolvedPos.parent.childAfter(resolvedPos.parentOffset)
                if (node) {
                    const linkFrom = from - resolvedPos.parentOffset
                    const linkTo = linkFrom + node.nodeSize
                    editor
                        .chain()
                        .focus()
                        .setTextSelection({ from: linkFrom, to: linkTo })
                        .unsetLink()
                        .run()
                }
                return
            }
        }

        alert('Для удаления ссылки поместите курсор внутрь неё или выделите текст ссылки')
    }

    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 1,
                p: 2,
                background: '#f5f5f5',
                border: '1px solid #ddd',
                borderRadius: 1,
                mb: 2,
            }}
        >
            <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept="image/*"
                onChange={handleFileChange}
            />

            {/* Undo/Redo */}
            <Tooltip title="Отменить (Ctrl+Z)">
                <IconButton
                    size="small"
                    onClick={() => editor.chain().focus().undo().run()}
                    disabled={!editor.can().undo()}
                >
                    <Undo fontSize="small" />
                </IconButton>
            </Tooltip>

            <Tooltip title="Повторить (Ctrl+Y)">
                <IconButton
                    size="small"
                    onClick={() => editor.chain().focus().redo().run()}
                    disabled={!editor.can().redo()}
                >
                    <Redo fontSize="small" />
                </IconButton>
            </Tooltip>

            <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

            {/* AI buttons */}
            <Tooltip title="AI инструменты">
                <Button
                    size="small"
                    variant="contained"
                    startIcon={<SmartToy />}
                    onClick={handleAiClick}
                    sx={{
                        bgcolor: 'primary.main',
                        '&:hover': { bgcolor: 'primary.dark' },
                    }}
                >
                    AI
                </Button>
            </Tooltip>

            <Menu anchorEl={aiAnchor} open={Boolean(aiAnchor)} onClose={handleAiClose}>
                <MenuItem onClick={handleTranslateClick}>
                    <Translate fontSize="small" sx={{ mr: 1 }} />
                    Перевести (DeepL)
                </MenuItem>
                <MenuItem onClick={handleTranscribeClick}>
                    <Mic fontSize="small" sx={{ mr: 1 }} />
                    Транскрипция видео
                </MenuItem>
            </Menu>

            <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

            {/* formatting */}
            <ToggleButtonGroup size="small">
                <Tooltip title="Жирный (Ctrl+B)">
                    <ToggleButton
                        value="bold"
                        selected={editor.isActive('bold')}
                        onClick={() => editor.chain().focus().toggleBold().run()}
                    >
                        <FormatBold fontSize="small" />
                    </ToggleButton>
                </Tooltip>
                <Tooltip title="Курсив (Ctrl+I)">
                    <ToggleButton
                        value="italic"
                        selected={editor.isActive('italic')}
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                    >
                        <FormatItalic fontSize="small" />
                    </ToggleButton>
                </Tooltip>
                <Tooltip title="Подчёркнутый">
                    <ToggleButton
                        value="underline"
                        selected={editor.isActive('underline')}
                        onClick={() => editor.chain().focus().toggleUnderline().run()}
                    >
                        <FormatUnderlined fontSize="small" />
                    </ToggleButton>
                </Tooltip>
            </ToggleButtonGroup>

            <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

            {/* titles */}
            <ToggleButtonGroup size="small">
                <ToggleButton
                    value="h2"
                    selected={editor.isActive('heading', { level: 2 })}
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                >
                    H2
                </ToggleButton>
                <ToggleButton
                    value="h3"
                    selected={editor.isActive('heading', { level: 3 })}
                    onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                >
                    H3
                </ToggleButton>
            </ToggleButtonGroup>

            <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

            {/* lists and quotes */}
            <Tooltip title="Маркированный список">
                <IconButton
                    size="small"
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                >
                    <FormatListBulleted fontSize="small" />
                </IconButton>
            </Tooltip>

            <Tooltip title="Нумерованный список">
                <IconButton
                    size="small"
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                >
                    <FormatListNumbered fontSize="small" />
                </IconButton>
            </Tooltip>

            <Tooltip title="Цитата">
                <IconButton
                    size="small"
                    onClick={() => editor.chain().focus().toggleBlockquote().run()}
                >
                    <FormatQuote fontSize="small" />
                </IconButton>
            </Tooltip>

            <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

            {/* uploading images */}
            <Tooltip title="Загрузить изображение с компьютера">
                <IconButton size="small" onClick={handleFileUpload}>
                    <Upload fontSize="small" />
                </IconButton>
            </Tooltip>

            <Tooltip title="Вставить изображение по URL">
                <IconButton
                    size="small"
                    onClick={() => {
                        const url = window.prompt('Введите URL изображения:', 'https://')
                        if (url) editor.chain().focus().setImage({ src: url }).run()
                    }}
                >
                    <Image fontSize="small" />
                </IconButton>
            </Tooltip>

            <Tooltip title="Вставить YouTube видео">
                <IconButton size="small" onClick={handleYoutubeInsert}>
                    <YouTube fontSize="small" color="error" />
                </IconButton>
            </Tooltip>

            <Tooltip title="Вставить пост из Telegram">
                <IconButton size="small" onClick={handleTelegramInsert}>
                    <Telegram fontSize="small" sx={{ color: '#0088cc' }} />
                </IconButton>
            </Tooltip>

            <Tooltip title="Вставить видео по ссылке (.mp4)">
                <IconButton size="small" onClick={handleVideoInsert}>
                    <OndemandVideo fontSize="small" color="action" />
                </IconButton>
            </Tooltip>

            {/* links */}
            <Tooltip title="Вставить/изменить ссылку">
                <IconButton size="small" onClick={handleLinkClick}>
                    <Link fontSize="small" />
                </IconButton>
            </Tooltip>

            <Tooltip title="Удалить ссылку">
                <IconButton size="small" onClick={handleRemoveLink}>
                    <LinkOff fontSize="small" />
                </IconButton>
            </Tooltip>

            <Tooltip title="Горизонтальная линия">
                <IconButton
                    size="small"
                    onClick={() => editor.chain().focus().setHorizontalRule().run()}
                >
                    <HorizontalRule fontSize="small" />
                </IconButton>
            </Tooltip>
        </Box>
    )
}
