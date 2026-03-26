import React from 'react'
import { Box, Typography } from '@mui/material'
import { EditorContent } from '@tiptap/react'
import type { Editor } from '@tiptap/react'
import { useAppTheme } from '../../../theme'

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
}) => {
    const { colors } = useAppTheme()

    return (
        <Box
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            sx={{
                border: isDragging ? `2px dashed ${colors.primary}` : `1px solid ${colors.border}`,
                borderRadius: '12px',
                mt: 1,
                minHeight: 400,
                backgroundColor: isDragging ? `${colors.primary}08` : 'transparent',
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
                        backgroundColor: `${colors.primary}0C`,
                        zIndex: 10,
                        pointerEvents: 'none',
                        borderRadius: '12px',
                    }}
                >
                    <Typography
                        sx={{
                            fontFamily: 'var(--tw-font-display)',
                            fontSize: '1.2rem',
                            fontWeight: 600,
                            color: colors.primary,
                        }}
                    >
                        📷 Отпустите для вставки изображения
                    </Typography>
                </Box>
            )}
            <EditorContent editor={editor} />
        </Box>
    )
}
