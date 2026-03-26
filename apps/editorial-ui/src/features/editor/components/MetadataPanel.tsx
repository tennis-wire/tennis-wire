import React, { useRef } from 'react'
import {
    TextField,
    Select,
    MenuItem,
    Box,
    Chip,
    Stack,
    Typography,
    FormControl,
    InputLabel,
    Button,
    Paper,
    IconButton,
} from '@mui/material'
import { Upload, Delete } from '@mui/icons-material'
import type { ContentMetadata, ContentType } from '../types/content.ts'
import { useAppTheme } from '../../../theme'

interface Props {
    metadata: ContentMetadata
    onChange: (metadata: ContentMetadata) => void
    readingTime?: number
}

export const MetadataPanel: React.FC<Props> = ({ metadata, onChange, readingTime }) => {
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [tagInput, setTagInput] = React.useState('')
    const { colors } = useAppTheme()

    const isArticle = metadata.type === 'article'

    const handleChange =
        (field: keyof ContentMetadata) => (e: React.ChangeEvent<HTMLInputElement>) => {
            onChange({ ...metadata, [field]: e.target.value })
        }

    const handleTypeChange = (newType: ContentType) => {
        if (newType === 'article' && metadata.type === 'news') {
            onChange({
                ...metadata,
                type: 'article',
                subtitle: '',
                coverImage: undefined,
            })
        } else if (newType === 'news' && metadata.type === 'article') {
            const { subtitle, coverImage, ...rest } = metadata as ContentMetadata & {
                subtitle?: string
                coverImage?: string
            }
            void subtitle
            void coverImage
            onChange({
                ...rest,
                type: 'news',
            })
        }
    }

    React.useEffect(() => {
        if (metadata.title && !metadata.slug) {
            const newSlug = metadata.title
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9а-яё\s-]/g, '')
                .trim()
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '')

            onChange({ ...metadata, slug: newSlug })
        }
    }, [metadata.title, metadata.slug, metadata, onChange])

    const handleAddTag = () => {
        if (tagInput.trim() && !metadata.tags.includes(tagInput.trim())) {
            onChange({ ...metadata, tags: [...metadata.tags, tagInput.trim()] })
            setTagInput('')
        }
    }

    const handleRemoveTag = (tagToRemove: string) => {
        onChange({ ...metadata, tags: metadata.tags.filter((tag) => tag !== tagToRemove) })
    }

    const handleTagKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            handleAddTag()
        }
    }

    const handleCoverUpload = () => {
        fileInputRef.current?.click()
    }

    const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !file.type.startsWith('image/')) return

        const reader = new FileReader()
        reader.onload = (event) => {
            if (isArticle) {
                onChange({
                    ...metadata,
                    coverImage: event.target?.result as string,
                })
            }
        }
        reader.readAsDataURL(file)
        e.target.value = ''
    }

    const handleCoverRemove = () => {
        if (isArticle) {
            onChange({
                ...metadata,
                coverImage: undefined,
            })
        }
    }

    return (
        <Paper
            elevation={0}
            sx={{
                p: 3,
                mb: 2.5,
                border: `1px solid ${colors.border}`,
                borderRadius: '14px',
                backgroundColor: colors.surface,
                boxShadow: colors.cardShadow,
            }}
        >
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    mb: 2.5,
                }}
            >
                <Typography
                    sx={{
                        fontFamily: 'var(--tw-font-display)',
                        fontSize: '1.25rem',
                        fontWeight: 700,
                        color: colors.text,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                    }}
                >
                    {isArticle ? '📝 Статья' : '📰 Новость'}
                </Typography>
                {isArticle && readingTime && (
                    <Typography
                        sx={{
                            fontSize: '0.8rem',
                            color: colors.textMuted,
                            backgroundColor: colors.tag,
                            px: 1.5,
                            py: 0.4,
                            borderRadius: '6px',
                            fontWeight: 500,
                        }}
                    >
                        ~{readingTime} мин чтения
                    </Typography>
                )}
            </Box>

            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Тип материала</InputLabel>
                <Select
                    value={metadata.type}
                    label="Тип материала"
                    onChange={(e) => handleTypeChange(e.target.value as ContentType)}
                >
                    <MenuItem value="news">📰 Новость</MenuItem>
                    <MenuItem value="article">📝 Статья</MenuItem>
                </Select>
            </FormControl>

            <TextField
                label="Заголовок"
                value={metadata.title}
                onChange={handleChange('title')}
                fullWidth
                required
                sx={{
                    mb: 2,
                    '& .MuiInputBase-input': {
                        fontFamily: 'var(--tw-font-display)',
                        fontSize: '1.1rem',
                        fontWeight: 600,
                    },
                }}
            />

            {isArticle && (
                <TextField
                    label="Подзаголовок (лид)"
                    value={(metadata as { subtitle?: string }).subtitle || ''}
                    onChange={(e) =>
                        onChange({
                            ...metadata,
                            subtitle: e.target.value,
                        })
                    }
                    multiline
                    rows={2}
                    fullWidth
                    required
                    placeholder="Краткое описание статьи для превью"
                    sx={{ mb: 2 }}
                />
            )}

            {isArticle && (
                <Box sx={{ mb: 2 }}>
                    <Typography
                        variant="body2"
                        sx={{ mb: 1, color: colors.textSecondary, fontSize: '0.85rem' }}
                    >
                        Обложка статьи *
                    </Typography>
                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        accept="image/*"
                        onChange={handleCoverChange}
                    />

                    {(metadata as { coverImage?: string }).coverImage ? (
                        <Box sx={{ position: 'relative', display: 'inline-block' }}>
                            <img
                                src={(metadata as { coverImage?: string }).coverImage}
                                alt="Обложка"
                                style={{
                                    maxWidth: '100%',
                                    maxHeight: 200,
                                    borderRadius: 10,
                                    objectFit: 'cover',
                                }}
                            />
                            <IconButton
                                size="small"
                                onClick={handleCoverRemove}
                                sx={{
                                    position: 'absolute',
                                    top: 8,
                                    right: 8,
                                    bgcolor: 'rgba(255,255,255,0.9)',
                                    '&:hover': { bgcolor: 'rgba(255,255,255,1)' },
                                }}
                            >
                                <Delete fontSize="small" />
                            </IconButton>
                        </Box>
                    ) : (
                        <Button
                            variant="outlined"
                            startIcon={<Upload />}
                            onClick={handleCoverUpload}
                            sx={{
                                borderStyle: 'dashed',
                                borderColor: colors.border,
                                color: colors.textSecondary,
                                '&:hover': {
                                    borderColor: colors.primary,
                                    backgroundColor: `${colors.primary}08`,
                                },
                            }}
                        >
                            Загрузить обложку
                        </Button>
                    )}
                </Box>
            )}

            <TextField
                label="URL (slug)"
                value={metadata.slug}
                onChange={handleChange('slug')}
                fullWidth
                size="small"
                helperText="Автоматически генерируется из заголовка"
                sx={{ mb: 2 }}
            />

            <Box sx={{ mb: 2 }}>
                <TextField
                    label="Добавить тег"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                    fullWidth
                    size="small"
                    helperText="Введите тег и нажмите Enter"
                />
                {metadata.tags.length > 0 && (
                    <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
                        {metadata.tags.map((tag) => (
                            <Chip
                                key={tag}
                                label={tag}
                                size="small"
                                onDelete={() => handleRemoveTag(tag)}
                                sx={{
                                    backgroundColor: colors.tag,
                                    color: colors.primary,
                                    fontWeight: 600,
                                    fontSize: '0.75rem',
                                    '& .MuiChip-deleteIcon': {
                                        color: colors.textMuted,
                                        '&:hover': { color: colors.live },
                                    },
                                }}
                            />
                        ))}
                    </Stack>
                )}
            </Box>

            <Box
                sx={{
                    pt: 2,
                    borderTop: `1px solid ${colors.border}`,
                }}
            >
                <Typography
                    sx={{ mb: 1, color: colors.textMuted, fontSize: '0.8rem', fontWeight: 500 }}
                >
                    Дополнительно (опционально)
                </Typography>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <TextField
                        label="URL источника"
                        value={metadata.sourceUrl || ''}
                        onChange={handleChange('sourceUrl')}
                        fullWidth
                        size="small"
                    />
                    <TextField
                        label="Название издания"
                        value={metadata.sourceName || ''}
                        onChange={handleChange('sourceName')}
                        fullWidth
                        size="small"
                    />
                    <TextField
                        label="Автор"
                        value={metadata.author || ''}
                        onChange={handleChange('author')}
                        fullWidth
                        size="small"
                    />
                </Stack>
            </Box>
        </Paper>
    )
}
