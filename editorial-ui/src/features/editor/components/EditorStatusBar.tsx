import React from 'react'
import { Box, Typography, Button } from '@mui/material'
import type { ContentType } from '../types/content'

interface Props {
    contentType: ContentType
    wordCount: number
    readingTime: number
    hasOriginal: boolean
    onReset: () => void
    onClear: () => void
    onSave: () => void
    onPublish: () => void
}

export const EditorStatusBar: React.FC<Props> = ({
    contentType,
    wordCount,
    readingTime,
    hasOriginal,
    onReset,
    onClear,
    onSave,
    onPublish,
}) => (
    <Box
        sx={{
            p: 2,
            borderTop: 1,
            borderColor: 'divider',
            bgcolor: 'grey.50',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 1,
        }}
    >
        <Typography variant="body2" color="text.secondary">
            {contentType === 'article' ? '📝' : '📰'} Слов: {wordCount}
            {contentType === 'article' && ` • ~${readingTime} мин чтения`}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {hasOriginal && (
                <Button size="small" variant="outlined" color="inherit" onClick={onReset}>
                    Сбросить к оригиналу
                </Button>
            )}
            <Button size="small" variant="outlined" color="inherit" onClick={onClear}>
                Очистить
            </Button>
            <Button size="small" variant="outlined" onClick={onSave}>
                Сохранить черновик
            </Button>
            <Button size="small" variant="contained" onClick={onPublish}>
                Опубликовать
            </Button>
        </Box>
    </Box>
)
