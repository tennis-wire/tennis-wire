import { useCallback, useState } from 'react'
import type { Editor } from '@tiptap/react'
import type {
    ContentMetadata,
    ArticleMetadata,
    CreateArticleRequest,
    UpdateArticleRequest,
} from '../types/content'
import { defaultNewsMetadata, defaultArticleMetadata } from '../types/content'
import { articlesApi, ContentApiError } from '../api/contentApi'

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
    articleId: string | null
    setArticleId: (id: string | null) => void
}

export function useEditorActions({
    editor,
    metadata,
    setMetadata,
    originalContent,
    setOriginalContent,
    clearPersisted,
    showSnackbar,
    articleId,
    setArticleId,
}: Params) {
    const [isSaving, setIsSaving] = useState(false)
    const [isPublishing, setIsPublishing] = useState(false)

    // Validate required fields for publishing
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

    // Build request payload from current state
    const buildCreateRequest = useCallback((): CreateArticleRequest => {
        const base: CreateArticleRequest = {
            type: metadata.type,
            title: metadata.title,
            content: editor?.getHTML() || '',
            tagIds: metadata.tags,
            sourceUrl: metadata.sourceUrl || null,
            sourceName: metadata.sourceName || null,
        }
        if (metadata.type === 'article') {
            const articleMeta = metadata as ArticleMetadata
            base.subtitle = articleMeta.subtitle || null
            base.coverImageUrl = articleMeta.coverImage || null
        }
        return base
    }, [metadata, editor])

    const buildUpdateRequest = useCallback((): UpdateArticleRequest => {
        const update: UpdateArticleRequest = {
            title: metadata.title,
            content: editor?.getHTML() || '',
            tagIds: metadata.tags,
            sourceUrl: metadata.sourceUrl || null,
            sourceName: metadata.sourceName || null,
        }
        if (metadata.type === 'article') {
            const articleMeta = metadata as ArticleMetadata
            update.subtitle = articleMeta.subtitle || null
            update.coverImageUrl = articleMeta.coverImage || null
        }
        return update
    }, [metadata, editor])

    // Save draft (create or update)
    const handleSave = useCallback(async () => {
        if (isSaving) return
        setIsSaving(true)

        try {
            if (articleId) {
                // Update existing
                await articlesApi.update(articleId, buildUpdateRequest())
                showSnackbar('Черновик сохранён', 'success')
            } else {
                // Create new
                const response = await articlesApi.create(buildCreateRequest())
                setArticleId(response.id)
                // Update slug from server response
                setMetadata({ ...metadata, slug: response.slug })
                showSnackbar('Черновик создан', 'success')
            }
        } catch (error) {
            console.error('Save error:', error)
            if (error instanceof ContentApiError) {
                if (error.violations) {
                    const messages = error.violations.map((v) => v.message).join(', ')
                    showSnackbar(messages, 'error')
                } else {
                    showSnackbar(error.message, 'error')
                }
            } else {
                showSnackbar('Ошибка сохранения', 'error')
            }
        } finally {
            setIsSaving(false)
        }
    }, [
        articleId,
        buildCreateRequest,
        buildUpdateRequest,
        isSaving,
        metadata,
        setArticleId,
        setMetadata,
        showSnackbar,
    ])

    // Publish article
    const handlePublish = useCallback(async () => {
        // Validate first
        const error = validateForPublish()
        if (error) {
            showSnackbar(error, 'error')
            return
        }

        if (isPublishing) return
        setIsPublishing(true)

        try {
            // If not saved yet, save first
            let currentId = articleId
            if (!currentId) {
                const createResponse = await articlesApi.create(buildCreateRequest())
                currentId = createResponse.id
                setArticleId(currentId)
            } else {
                // Save latest changes before publishing
                await articlesApi.update(currentId, buildUpdateRequest())
            }

            // Now publish
            const publishResponse = await articlesApi.publish(currentId)
            setMetadata({ ...metadata, slug: publishResponse.slug })

            const typeLabel = metadata.type === 'article' ? 'Статья' : 'Новость'
            showSnackbar(`${typeLabel} опубликована! Slug: ${publishResponse.slug}`, 'success')
        } catch (error) {
            console.error('Publish error:', error)
            if (error instanceof ContentApiError) {
                if (error.violations) {
                    const messages = error.violations
                        .map((v) => `${v.field}: ${v.message}`)
                        .join('\n')
                    showSnackbar(messages, 'error')
                } else {
                    showSnackbar(error.message, 'error')
                }
            } else {
                showSnackbar('Ошибка публикации', 'error')
            }
        } finally {
            setIsPublishing(false)
        }
    }, [
        validateForPublish,
        isPublishing,
        articleId,
        buildCreateRequest,
        buildUpdateRequest,
        setArticleId,
        metadata,
        setMetadata,
        showSnackbar,
    ])

    // Reset to original content
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

    // Clear editor
    const handleClear = useCallback(() => {
        if (editor && window.confirm('Очистить редактор? Все изменения будут потеряны.')) {
            editor.commands.clearContent()
            setMetadata(metadata.type === 'article' ? defaultArticleMetadata : defaultNewsMetadata)
            setOriginalContent(undefined)
            setArticleId(null)
            clearPersisted()
            showSnackbar('Редактор очищен', 'info')
        }
    }, [
        editor,
        metadata.type,
        setMetadata,
        setOriginalContent,
        setArticleId,
        clearPersisted,
        showSnackbar,
    ])

    // Insert text below cursor
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

    // Get selected text
    const getSelectedText = useCallback((): string => {
        if (!editor) return ''
        const { from, to } = editor.state.selection
        return editor.state.doc.textBetween(from, to, ' ')
    }, [editor])

    return {
        handleSave,
        handlePublish,
        handleReset,
        handleClear,
        insertBelow,
        getSelectedText,
        isSaving,
        isPublishing,
    }
}
