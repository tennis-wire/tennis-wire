import React from 'react'
import { Box, Typography, Button, CircularProgress } from '@mui/material'
import type { ContentType } from '../types/content'
import { useAppTheme } from '../../../theme'

interface Props {
    contentType: ContentType
    wordCount: number
    readingTime: number
    hasOriginal: boolean
    onReset: () => void
    onClear: () => void
    onSave: () => void
    onPublish: () => void
    isSaving?: boolean
    isPublishing?: boolean
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
    isSaving = false,
    isPublishing = false,
}) => {
    const { colors } = useAppTheme()
    const isLoading = isSaving || isPublishing

    return (
        <Box
            sx={{
                p: 2,
                borderTop: `1px solid ${colors.border}`,
                bgcolor: colors.bgAlt,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 1,
                borderRadius: '0 0 14px 14px',
            }}
        >
            <Typography sx={{ fontSize: '0.85rem', color: colors.textMuted }}>
                {contentType === 'article' ? '📝' : '📰'} Слов: {wordCount}
                {contentType === 'article' && ` · ~${readingTime} мин чтения`}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {hasOriginal && (
                    <Button
                        size="small"
                        variant="outlined"
                        onClick={onReset}
                        disabled={isLoading}
                        sx={{
                            borderColor: colors.border,
                            color: colors.textSecondary,
                            '&:hover': {
                                borderColor: colors.textMuted,
                                backgroundColor: `${colors.text}08`,
                            },
                        }}
                    >
                        Сбросить к оригиналу
                    </Button>
                )}
                <Button
                    size="small"
                    variant="outlined"
                    onClick={onClear}
                    disabled={isLoading}
                    sx={{
                        borderColor: colors.border,
                        color: colors.textSecondary,
                        '&:hover': {
                            borderColor: colors.textMuted,
                            backgroundColor: `${colors.text}08`,
                        },
                    }}
                >
                    Очистить
                </Button>
                <Button
                    size="small"
                    variant="outlined"
                    onClick={onSave}
                    disabled={isLoading}
                    startIcon={
                        isSaving ? <CircularProgress size={16} color="inherit" /> : undefined
                    }
                    sx={{
                        borderColor: colors.primary,
                        color: colors.primary,
                        '&:hover': {
                            backgroundColor: `${colors.primary}0A`,
                            borderColor: colors.primaryDark,
                        },
                    }}
                >
                    {isSaving ? 'Сохранение...' : 'Сохранить черновик'}
                </Button>
                <Button
                    size="small"
                    variant="contained"
                    onClick={onPublish}
                    disabled={isLoading}
                    startIcon={
                        isPublishing ? <CircularProgress size={16} color="inherit" /> : undefined
                    }
                    sx={{
                        backgroundColor: colors.primary,
                        color: '#fff',
                        '&:hover': {
                            backgroundColor: colors.primaryDark,
                        },
                    }}
                >
                    {isPublishing ? 'Публикация...' : 'Опубликовать'}
                </Button>
            </Box>
        </Box>
    )
}
