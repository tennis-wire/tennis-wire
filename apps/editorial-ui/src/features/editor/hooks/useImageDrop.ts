import { useState, useCallback } from 'react'
import type { Editor } from '@tiptap/react'
import { uploadErrorMessage, uploadImage } from '../api/mediaApi'

interface ShowSnackbar {
    (message: string, severity: 'success' | 'error' | 'warning' | 'info'): void
}

export function useImageDrop(editor: Editor | null, showSnackbar: ShowSnackbar) {
    const [isDragging, setIsDragging] = useState(false)

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (e.dataTransfer.types.includes('Files')) setIsDragging(true)
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)
    }, [])

    const handleDrop = useCallback(
        async (e: React.DragEvent) => {
            e.preventDefault()
            e.stopPropagation()
            setIsDragging(false)

            const files = Array.from(e.dataTransfer.files)
            const imageFiles = files.filter((file) => file.type.startsWith('image/'))

            if (imageFiles.length === 0) {
                showSnackbar('Можно перетаскивать только изображения', 'warning')
                return
            }

            const results = await Promise.allSettled(imageFiles.map(uploadImage))
            let added = 0
            let failure: string | null = null
            for (const result of results) {
                if (result.status === 'fulfilled') {
                    editor?.chain().focus().setImage({ src: result.value.url }).run()
                    added++
                } else {
                    failure ??= uploadErrorMessage(result.reason)
                }
            }

            if (failure !== null) {
                const rest = added > 0 ? ` Добавлено: ${added} из ${imageFiles.length}` : ''
                showSnackbar(`${failure}.${rest}`, 'error')
            } else {
                showSnackbar(`Добавлено изображений: ${added}`, 'success')
            }
        },
        [editor, showSnackbar]
    )

    return { isDragging, handleDragOver, handleDragLeave, handleDrop }
}
