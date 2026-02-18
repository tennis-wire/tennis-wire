import React from 'react'
import { Box, Typography } from '@mui/material'
import { EditorContent } from '@tiptap/react'
import type { Editor } from '@tiptap/react'

interface Props {
    editor: Editor
    isDragging: boolean
    onDragOver: (e: React.DragEvent) => void
    onDragLeave: (e: React.DragEvent) => void
    onDrop: (e: React.DragEvent) => void
}

export const EditorContentArea: React.FC<Props> = ({
    editor,
    isDragging,
    onDragOver,
    onDragLeave,
    onDrop,
}) => (
    <Box
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        sx={{
            border: isDragging ? '2px dashed #1976d2' : '1px solid #e0e0e0',
            borderRadius: 1,
            mt: 1,
            minHeight: 400,
            backgroundColor: isDragging ? 'rgba(25, 118, 210, 0.04)' : 'transparent',
            transition: 'all 0.2s ease',
            position: 'relative',
        }}
    >
        {isDragging && (
            <Box
                sx={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(25, 118, 210, 0.08)',
                    zIndex: 10,
                    pointerEvents: 'none',
                    borderRadius: 1,
                }}
            >
                <Typography variant="h6" color="primary">
                    📷 Отпустите для вставки изображения
                </Typography>
            </Box>
        )}
        <EditorContent editor={editor} />
    </Box>
)
