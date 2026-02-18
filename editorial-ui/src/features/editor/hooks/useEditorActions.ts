import { useCallback } from 'react'
import type { Editor } from '@tiptap/react'
import type { ContentMetadata, ArticleMetadata } from '../types/content'
import { defaultNewsMetadata, defaultArticleMetadata } from '../types/content'

interface ShowSnackbar {
    (message: string, severity: 'success' | 'error' | 'warning' | 'info'): void
}

interface Params {
    editor: Editor | null
    metadata: ContentMetadata
    setMetadata: (m: ContentMetadata) => void
    originalContent: string | undefined
    setOriginalContent: (c: string | undefined) => void
    clearPersisted: () => void
    showSnackbar: ShowSnackbar
}

export function useEditorActions({
    editor,
    metadata,
    setMetadata,
    originalContent,
    setOriginalContent,
    clearPersisted,
    showSnackbar,
}: Params) {
    const validateForPublish = useCallback((): string | null => {
        if (!metadata.title.trim()) return 'Заполните заголовок'
        if (metadata.tags.length === 0) return 'Добавьте хотя бы один тег'
        if (metadata.type === 'article') {
            const articleMeta = metadata as ArticleMetadata
            if (!articleMeta.subtitle?.trim()) return 'Заполните подзаголовок для статьи'
            if (!articleMeta.coverImage) return 'Загрузите обложку для статьи'
        }
        if (!editor?.getText().trim()) return 'Текст материала не может быть пустым'
        return null
    }, [metadata, editor])

    const handleSave = useCallback(() => {
        showSnackbar('Черновик сохранён', 'success')
        console.log('Метаданные:', metadata)
        console.log('Контент:', editor?.getHTML())
    }, [metadata, editor, showSnackbar])

    const handlePublish = useCallback(() => {
        const error = validateForPublish()
        if (error) {
            showSnackbar(error, 'error')
            return
        }
        showSnackbar(
            metadata.type === 'article' ? 'Статья опубликована' : 'Новость опубликована',
            'success'
        )
        console.log('Публикация:', { metadata, content: editor?.getHTML() })
    }, [validateForPublish, metadata, editor, showSnackbar])

    const handleReset = useCallback(() => {
        if (!originalContent) {
            showSnackbar('Нет оригинала для восстановления', 'warning')
            return
        }
        if (editor && window.confirm('Вернуться к оригиналу? Текущие изменения будут потеряны.')) {
            editor.commands.setContent(originalContent)
            showSnackbar('Восстановлен оригинальный текст', 'info')
        }
    }, [editor, originalContent, showSnackbar])

    const handleClear = useCallback(() => {
        if (editor && window.confirm('Очистить редактор? Все изменения будут потеряны.')) {
            editor.commands.clearContent()
            setMetadata(metadata.type === 'article' ? defaultArticleMetadata : defaultNewsMetadata)
            setOriginalContent(undefined)
            clearPersisted()
            showSnackbar('Редактор очищен', 'info')
        }
    }, [editor, metadata.type, setMetadata, setOriginalContent, clearPersisted, showSnackbar])

    const insertBelow = useCallback(
        (text: string) => {
            editor
                ?.chain()
                .focus()
                .insertContent('\n\n' + text)
                .run()
        },
        [editor]
    )

    const getSelectedText = useCallback((): string => {
        if (!editor) return ''
        const { from, to } = editor.state.selection
        return editor.state.doc.textBetween(from, to, ' ')
    }, [editor])

    return { handleSave, handlePublish, handleReset, handleClear, insertBelow, getSelectedText }
}
