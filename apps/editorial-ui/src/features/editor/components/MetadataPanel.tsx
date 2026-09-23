import React, { useRef } from 'react'
import {
    TextField,
    Select,
    MenuItem,
    Box,
    Stack,
    Typography,
    FormControl,
    InputLabel,
    Button,
    Paper,
    IconButton,
    Autocomplete,
    CircularProgress,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import { Upload, Delete } from '@mui/icons-material'
import type { ContentMetadata, ContentType, Tag } from '../types/content.ts'
import { TAG_TYPE_LABELS } from '../constants/tagTypes'
import { useTagSearch } from '../hooks/useTagSearch'
import { IMAGE_ACCEPT, uploadErrorMessage, uploadImage } from '../api/mediaApi'
import { RADIUS, useAppTheme } from '../../../theme'

interface Props {
    metadata: ContentMetadata
    onChange: React.Dispatch<React.SetStateAction<ContentMetadata>>
    onError: (message: string) => void
    readingTime?: number
    // once on the site, type and address stay as they are
    frozen?: boolean
    // someone else holds the article
    readOnly?: boolean
}

export const MetadataPanel: React.FC<Props> = ({
    metadata,
    onChange,
    onError,
    readingTime,
    frozen = false,
    readOnly = false,
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [coverUploading, setCoverUploading] = React.useState(false)
    const [tagQuery, setTagQuery] = React.useState('')
    const [tagsOpen, setTagsOpen] = React.useState(false)
    const tagSearch = useTagSearch(tagQuery, tagsOpen)
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

    const handleCoverUpload = () => {
        fileInputRef.current?.click()
    }

    const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        e.target.value = ''
        if (!file) return

        setCoverUploading(true)
        try {
            const { url } = await uploadImage(file)
            // The form stays editable while the file travels, so the cover goes into
            // whatever the metadata is by then, not into what it was at the click.
            onChange((current) =>
                current.type === 'article' ? { ...current, coverImage: url } : current
            )
        } catch (error) {
            onError(uploadErrorMessage(error))
        } finally {
            setCoverUploading(false)
        }
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
        <Paper elevation={0} sx={{ p: 3, mb: 2.5, border: 1, borderColor: 'divider' }}>
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
                    disabled={frozen || readOnly}
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
                disabled={readOnly}
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
                    disabled={readOnly}
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
                        accept={IMAGE_ACCEPT}
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
                                    borderRadius: RADIUS.md,
                                    objectFit: 'cover',
                                }}
                            />
                            <IconButton
                                size="small"
                                onClick={handleCoverRemove}
                                disabled={readOnly}
                                sx={(theme) => ({
                                    position: 'absolute',
                                    top: 8,
                                    right: 8,
                                    bgcolor: alpha(theme.palette.background.paper, 0.9),
                                    '&:hover': { bgcolor: theme.palette.background.paper },
                                })}
                            >
                                <Delete fontSize="small" />
                            </IconButton>
                        </Box>
                    ) : (
                        <Button
                            variant="outlined"
                            startIcon={coverUploading ? <CircularProgress size={16} /> : <Upload />}
                            disabled={coverUploading || readOnly}
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
                            {coverUploading ? 'Загрузка' : 'Загрузить обложку'}
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
                disabled={frozen || readOnly}
                placeholder={frozen ? undefined : 'сформируется из заголовка при публикации'}
                helperText={
                    frozen
                        ? 'Адрес на сайте. После публикации не меняется'
                        : 'Необязательно: латиница, цифры и дефисы'
                }
                sx={{ mb: 2 }}
            />

            {/* Tags can only be picked, never typed in: the server takes ids.
                Creating one is a separate screen; see issue #TODO. */}
            <Box sx={{ mb: 2 }}>
                <Autocomplete
                    multiple
                    disabled={readOnly}
                    open={tagsOpen}
                    onOpen={() => setTagsOpen(true)}
                    onClose={() => setTagsOpen(false)}
                    options={tagSearch.options}
                    value={metadata.tags}
                    loading={tagSearch.loading}
                    loadingText="Загрузка…"
                    // The server already filtered by `search`; filtering again
                    // here would drop matches made on fields we never receive.
                    filterOptions={(options) => options}
                    onInputChange={(_, value) => setTagQuery(value)}
                    onChange={(_, value: Tag[]) => onChange({ ...metadata, tags: value })}
                    getOptionLabel={(option) => option.name}
                    isOptionEqualToValue={(option, value) => option.id === value.id}
                    noOptionsText={tagQuery ? 'Ничего не найдено' : 'Начните вводить название'}
                    renderOption={(props, option) => (
                        <Box component="li" {...props} key={option.id}>
                            <Stack spacing={0}>
                                <Typography variant="body2">{option.name}</Typography>
                                <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                                    {TAG_TYPE_LABELS[option.type]}
                                </Typography>
                            </Stack>
                        </Box>
                    )}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            label="Теги"
                            size="small"
                            error={Boolean(tagSearch.error)}
                            helperText={tagSearch.error ?? 'Выберите из существующих тегов'}
                        />
                    )}
                />
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
                        disabled={readOnly}
                    />
                    <TextField
                        label="Название издания"
                        value={metadata.sourceName || ''}
                        onChange={handleChange('sourceName')}
                        fullWidth
                        size="small"
                        disabled={readOnly}
                    />
                    <TextField
                        label="Автор"
                        value={metadata.author || ''}
                        onChange={handleChange('author')}
                        fullWidth
                        size="small"
                        disabled={readOnly}
                    />
                </Stack>
            </Box>
        </Paper>
    )
}
