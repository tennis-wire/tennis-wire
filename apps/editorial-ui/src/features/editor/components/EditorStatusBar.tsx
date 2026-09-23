import React from 'react'
import { Box, Typography, Button, CircularProgress } from '@mui/material'
import type { ContentType } from '../types/content'
import type { Busy, Mode } from '../hooks/useArticleSession'
import { useAppTheme } from '../../../theme'

interface Props {
    mode: Mode
    // where the article stands: draft, on the site, taken by someone
    status: string
    contentType: ContentType
    wordCount: number
    readingTime: number
    hasOriginal: boolean
    // a published article with a pending edit of the caller's own
    hasEdit: boolean
    dirty: boolean
    // a draft that has never been on the site
    canDelete: boolean
    // a chief editor looking at someone else's edit
    canReset: boolean
    busy: Busy
    onReset: () => void
    onClear: () => void
    onDelete: () => void
    onDiscardEdit: () => void
    onSave: () => void
    onPublish: () => void
}

export const EditorStatusBar: React.FC<Props> = ({
    mode,
    status,
    contentType,
    wordCount,
    readingTime,
    hasOriginal,
    hasEdit,
    dirty,
    canDelete,
    canReset,
    busy,
    onReset,
    onClear,
    onDelete,
    onDiscardEdit,
    onSave,
    onPublish,
}) => {
    const { colors } = useAppTheme()
    const isLoading = busy !== null

    const quiet = {
        borderColor: colors.border,
        color: colors.textSecondary,
        '&:hover': {
            borderColor: colors.textMuted,
            backgroundColor: `${colors.text}08`,
        },
    }
    const spinner = (kind: Busy) =>
        busy === kind ? <CircularProgress size={16} color="inherit" /> : undefined

    const published = mode === 'published'
    const saveLabel = published ? 'Сохранить правку' : 'Сохранить'
    const publishLabel = published ? 'Обновить на сайте' : 'Опубликовать'

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
            <Box>
                <Typography sx={{ fontSize: '0.85rem', color: colors.text }}>{status}</Typography>
                <Typography sx={{ fontSize: '0.8rem', color: colors.textMuted }}>
                    {contentType === 'article' ? '📝' : '📰'} Слов: {wordCount}
                    {contentType === 'article' && ` · ~${readingTime} мин чтения`}
                </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {hasOriginal && mode !== 'locked' && (
                    <Button
                        size="small"
                        variant="outlined"
                        onClick={onReset}
                        disabled={isLoading}
                        sx={quiet}
                    >
                        Сбросить к оригиналу
                    </Button>
                )}

                {mode === 'new' && (
                    <Button
                        size="small"
                        variant="outlined"
                        onClick={onClear}
                        disabled={isLoading}
                        sx={quiet}
                    >
                        Очистить
                    </Button>
                )}
                {mode === 'draft' && canDelete && (
                    <Button
                        size="small"
                        variant="outlined"
                        onClick={onDelete}
                        disabled={isLoading}
                        startIcon={spinner('delete')}
                        sx={quiet}
                    >
                        Удалить
                    </Button>
                )}
                {published && hasEdit && (
                    <Button
                        size="small"
                        variant="outlined"
                        onClick={onDiscardEdit}
                        disabled={isLoading}
                        startIcon={spinner('discard')}
                        sx={quiet}
                    >
                        Отменить правку
                    </Button>
                )}
                {mode === 'locked' && canReset && (
                    <Button
                        size="small"
                        variant="outlined"
                        onClick={onDiscardEdit}
                        disabled={isLoading}
                        startIcon={spinner('discard')}
                        sx={quiet}
                    >
                        Сбросить правку
                    </Button>
                )}

                {mode !== 'locked' && (
                    <>
                        <Button
                            size="small"
                            variant="outlined"
                            onClick={onSave}
                            disabled={isLoading || (mode !== 'new' && !dirty)}
                            startIcon={spinner('save')}
                            sx={{
                                borderColor: colors.primary,
                                color: colors.primary,
                                '&:hover': {
                                    backgroundColor: `${colors.primary}0A`,
                                    borderColor: colors.primaryDark,
                                },
                            }}
                        >
                            {busy === 'save' ? 'Сохранение...' : saveLabel}
                        </Button>
                        <Button
                            size="small"
                            variant="contained"
                            onClick={onPublish}
                            disabled={isLoading || (published && !hasEdit && !dirty)}
                            startIcon={spinner('publish')}
                            sx={{
                                backgroundColor: colors.primary,
                                color: '#fff',
                                '&:hover': {
                                    backgroundColor: colors.primaryDark,
                                },
                            }}
                        >
                            {busy === 'publish' ? 'Публикация...' : publishLabel}
                        </Button>
                    </>
                )}
            </Box>
        </Box>
    )
}
