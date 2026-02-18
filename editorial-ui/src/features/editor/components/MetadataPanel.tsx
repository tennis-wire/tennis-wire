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

interface Props {
    metadata: ContentMetadata
    onChange: (metadata: ContentMetadata) => void
    readingTime?: number // time for read
}

export const MetadataPanel: React.FC<Props> = ({ metadata, onChange, readingTime }) => {
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [tagInput, setTagInput] = React.useState('')

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
                mb: 3,
                border: '1px solid #e0e0e0',
                borderRadius: 2,
                backgroundColor: '#fff',
            }}
        >
            <Typography
                variant="h6"
                gutterBottom
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
                {isArticle ? '📝 Статья' : '📰 Новость'}
                {isArticle && readingTime && (
                    <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
                        ~{readingTime} мин чтения
                    </Typography>
                )}
            </Typography>

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
                sx={{ mb: 2 }}
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
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
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
                                    borderRadius: 8,
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
                            sx={{ borderStyle: 'dashed' }}
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
                            />
                        ))}
                    </Stack>
                )}
            </Box>

            <Box
                sx={{
                    pt: 2,
                    borderTop: '1px solid #eee',
                }}
            >
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
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
