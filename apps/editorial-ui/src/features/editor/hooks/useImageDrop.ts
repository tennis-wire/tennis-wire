import { useState, useCallback } from 'react'
import type { Editor } from '@tiptap/react'

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
        (e: React.DragEvent) => {
            e.preventDefault()
            e.stopPropagation()
            setIsDragging(false)

            const files = Array.from(e.dataTransfer.files)
            const imageFiles = files.filter((file) => file.type.startsWith('image/'))

            if (imageFiles.length === 0) {
                showSnackbar('Можно перетаскивать только изображения', 'warning')
                return
            }

            imageFiles.forEach((file) => {
                const reader = new FileReader()
                reader.onload = (event) => {
                    const url = event.target?.result as string
                    editor?.chain().focus().setImage({ src: url }).run()
                }
                reader.readAsDataURL(file)
            })

            showSnackbar(`Добавлено изображений: ${imageFiles.length}`, 'success')
        },
        [editor, showSnackbar]
    )

    return { isDragging, handleDragOver, handleDragLeave, handleDrop }
}
