import { useState, useCallback } from 'react'

// The frame around the text while a file is dragged over it. The drop itself is the editor's,
// see PictureInput: it knows where in the text the file was let go.
export function useDragHighlight() {
    const [isDragging, setIsDragging] = useState(false)

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        if (e.dataTransfer.types.includes('Files')) setIsDragging(true)
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
    }, [])

    // Kept from the browser, which would otherwise open a file let go beside the text
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
    }, [])

    return { isDragging, handleDragOver, handleDragLeave, handleDrop }
}
