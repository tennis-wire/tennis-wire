import { useEffect, useState, type ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Link,
    Paper,
    Stack,
    Typography,
} from '@mui/material'

import type { PagedResponse, WorkItem } from '../../editor/types/content'
import { messageOf } from '../../editor/lib/apiMessages'
import { timeOf } from '../../editor/lib/dates'

const PAGE_SIZE = 20

interface Props {
    title: string
    emptyText: string
    // must keep its identity between renders, or the list reloads on each one
    load: (page: number, size: number) => Promise<PagedResponse<WorkItem>>
    // bumped by the owner after a change the list cannot see, such as a deletion
    reloads: number
    header?: ReactNode
    badge?: (item: WorkItem) => string | null
    onDelete?: (item: WorkItem) => void
    canDelete?: (item: WorkItem) => boolean
}

interface Shown {
    request: string
    items: WorkItem[]
    last: boolean
}

// One request for everything shown so far rather than one per page: a deletion would
// otherwise shift rows between pages already loaded
export default function WorkList({
    title,
    emptyText,
    load,
    reloads,
    header,
    badge,
    onDelete,
    canDelete,
}: Props) {
    const [pages, setPages] = useState(1)
    const [shown, setShown] = useState<Shown | null>(null)
    const [error, setError] = useState<string | null>(null)
    const request = `${pages}:${reloads}`

    useEffect(() => {
        let live = true
        load(0, pages * PAGE_SIZE).then(
            (page) => {
                if (!live) return
                setShown({
                    request,
                    items: page.content,
                    last: page.page.number + 1 >= page.page.totalPages,
                })
                setError(null)
            },
            (failure: unknown) => {
                if (live) setError(messageOf(failure))
            }
        )
        return () => {
            live = false
        }
    }, [load, pages, request])

    const loading = shown?.request !== request && error === null
    const items = shown?.items ?? []

    return (
        <Box sx={{ mb: 4 }}>
            <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                sx={{ mb: 1.5, alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
            >
                <Typography variant="h6" component="h2">
                    {title}
                </Typography>
                {header}
            </Stack>

            {error !== null && (
                <Alert severity="error" sx={{ mb: 1.5 }}>
                    {error}
                </Alert>
            )}

            {shown !== null && items.length === 0 && !loading && (
                <Typography color="text.secondary">{emptyText}</Typography>
            )}

            {items.length > 0 && (
                <Paper variant="outlined">
                    {items.map((item, index) => {
                        const note = badge?.(item) ?? null
                        return (
                            <Stack
                                key={item.id}
                                direction="row"
                                spacing={1.5}
                                sx={{
                                    px: 2,
                                    py: 1.25,
                                    alignItems: 'center',
                                    borderTop: index === 0 ? 'none' : 1,
                                    borderColor: 'divider',
                                }}
                            >
                                <Chip
                                    size="small"
                                    label={item.type === 'article' ? 'Статья' : 'Новость'}
                                />
                                <Link
                                    component={RouterLink}
                                    to={`/editor/${item.id}`}
                                    underline="hover"
                                    sx={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}
                                >
                                    {item.title}
                                </Link>
                                {note !== null && (
                                    <Chip size="small" variant="outlined" label={note} />
                                )}
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{ whiteSpace: 'nowrap' }}
                                >
                                    {timeOf(item.updatedAt)}
                                </Typography>
                                {onDelete && canDelete?.(item) && (
                                    <Button
                                        size="small"
                                        color="inherit"
                                        onClick={() => onDelete(item)}
                                    >
                                        Удалить
                                    </Button>
                                )}
                            </Stack>
                        )
                    })}
                </Paper>
            )}

            {loading && <CircularProgress size={24} sx={{ mt: 1.5 }} />}

            {shown !== null && !shown.last && !loading && (
                <Button sx={{ mt: 1 }} onClick={() => setPages((n) => n + 1)}>
                    Показать ещё
                </Button>
            )}
        </Box>
    )
}
