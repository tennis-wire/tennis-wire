import type { ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Divider,
    IconButton,
    Link,
    Stack,
    Tooltip,
    Typography,
} from '@mui/material'
import { Close, DeleteOutlined, EditOutlined, OpenInNew } from '@mui/icons-material'

import { clockOf } from '../lib/when'
import type { Item } from '../types/aggregator'
import ItemText from './ItemText'

interface Props {
    // null while it is on its way
    item: Item | null
    error: string | null
    sourceName: (key: string) => string
    onClose: () => void
    onDelete: (id: string) => void
}

function webAddress(url: string | null): string | null {
    return url !== null && /^https?:\/\//i.test(url) ? url : null
}

export default function ItemPanel({ item, error, sourceName, onClose, onDelete }: Props) {
    if (error !== null) {
        return (
            <Stack spacing={2}>
                <Header onClose={onClose} />
                <Alert severity="info">{error}</Alert>
            </Stack>
        )
    }
    if (item === null) {
        return (
            <Stack spacing={2}>
                <Header onClose={onClose} />
                <CircularProgress size={28} />
            </Stack>
        )
    }

    const picture = webAddress(item.imageUrl)
    const embeds = item.embeds.filter((embed) => webAddress(embed) !== null)
    const published = item.publishedAt ? `Опубликовано ${clockOf(item.publishedAt)} · ` : ''
    return (
        <Stack spacing={2}>
            <Header onClose={onClose}>
                <Typography sx={{ fontWeight: 600 }}>{sourceName(item.source)}</Typography>
                <Chip size="small" label={item.language.toUpperCase()} />
            </Header>

            <Box>
                <Typography variant="h5" component="h2" sx={{ mb: 1 }}>
                    {item.title}
                </Typography>
                {item.titleBefore !== null && (
                    <Typography variant="body2" color="text.secondary">
                        Было: «{item.titleBefore}»
                    </Typography>
                )}
                <Typography variant="body2" color="text.secondary">
                    {published}у нас с {clockOf(item.arrivedAt)}
                    {item.author ? ` · ${item.author}` : ''}
                </Typography>
            </Box>

            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
                <Button
                    variant="contained"
                    startIcon={<EditOutlined />}
                    component={RouterLink}
                    to={`/editor/new?from=${encodeURIComponent(item.id)}`}
                    target="_blank"
                    rel="noopener"
                >
                    Сделать материал
                </Button>
                {webAddress(item.url) !== null && (
                    <Button
                        variant="outlined"
                        color="inherit"
                        endIcon={<OpenInNew />}
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Оригинал
                    </Button>
                )}
                <Button
                    color="inherit"
                    startIcon={<DeleteOutlined />}
                    onClick={() => onDelete(item.id)}
                    sx={{ color: 'text.secondary' }}
                >
                    Удалить
                </Button>
            </Stack>

            {picture !== null && (
                <Box
                    component="img"
                    src={picture}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    sx={{ width: '100%', maxHeight: 360, objectFit: 'cover', borderRadius: 2 }}
                />
            )}

            {item.lead && <Typography sx={{ fontWeight: 600 }}>{item.lead}</Typography>}
            {item.text ? (
                <ItemText markdown={item.text} />
            ) : (
                <Typography variant="body2" color="text.secondary">
                    Текста статьи нет: источник отдаёт только лид, или страницу не удалось
                    разобрать. Полностью — в оригинале.
                </Typography>
            )}

            {embeds.length > 0 && (
                <>
                    <Divider />
                    <Stack spacing={0.5}>
                        <Typography variant="overline" color="text.secondary">
                            Встройки
                        </Typography>
                        {embeds.map((embed) => (
                            <Link
                                key={embed}
                                href={embed}
                                target="_blank"
                                rel="noopener noreferrer"
                                sx={{ overflowWrap: 'anywhere' }}
                            >
                                {embed}
                            </Link>
                        ))}
                    </Stack>
                </>
            )}
            {item.categories.length > 0 && (
                <Typography variant="body2" color="text.secondary">
                    Рубрики: {item.categories.join(', ')}
                </Typography>
            )}
        </Stack>
    )
}

function Header({ onClose, children }: { onClose: () => void; children?: ReactNode }) {
    return (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            {children}
            <Box sx={{ flex: 1 }} />
            <Tooltip title="Закрыть">
                <IconButton aria-label="Закрыть новость" onClick={onClose}>
                    <Close />
                </IconButton>
            </Tooltip>
        </Stack>
    )
}
