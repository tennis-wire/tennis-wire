import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Button, Container, Stack, TextField, Typography } from '@mui/material'
import { Add } from '@mui/icons-material'

import UserMenu from '../../auth/UserMenu'
import { articlesApi } from '../editor/api/contentApi'
import { messageOf } from '../editor/lib/apiMessages'
import type { WorkItem } from '../editor/types/content'
import DeskNav from './DeskNav'
import OpenByLink from './components/OpenByLink'
import WorkList from './components/WorkList'

// The caller's own work: drafts nobody else sees, and edits of published articles that
// are saved but not on the site yet. Someone else's work is not listed here, to anyone.
export default function DeskPage() {
    const navigate = useNavigate()
    const [search, setSearch] = useState('')
    const [query, setQuery] = useState('')
    const [draftReloads, setDraftReloads] = useState(0)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const timer = setTimeout(() => setQuery(search.trim()), 300)
        return () => clearTimeout(timer)
    }, [search])

    const loadDrafts = useCallback(
        (page: number, size: number) =>
            articlesApi.drafts({ search: query || undefined, page, size }),
        [query]
    )
    const loadEdits = useCallback(
        (page: number, size: number) => articlesApi.edits({ page, size }),
        []
    )

    async function remove(item: WorkItem) {
        if (!window.confirm(`Удалить черновик «${item.title}»? Это не отменить.`)) return
        try {
            await articlesApi.delete(item.id)
            setDraftReloads((n) => n + 1)
        } catch (failure) {
            setError(messageOf(failure))
        }
    }

    return (
        <Container maxWidth="md" sx={{ py: 4 }}>
            <Stack
                direction="row"
                sx={{ mb: 2, alignItems: 'center', justifyContent: 'space-between' }}
            >
                <Typography variant="h4" component="h1">
                    Редакция
                </Typography>
                <UserMenu />
            </Stack>
            <DeskNav />

            {error !== null && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                sx={{ mb: 4, alignItems: { sm: 'flex-start' } }}
            >
                <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => void navigate('/editor/new')}
                    sx={{ whiteSpace: 'nowrap' }}
                >
                    Новый материал
                </Button>
                <OpenByLink />
            </Stack>

            {/* keyed by the search, so a new search starts again from the first page */}
            <WorkList
                key={query}
                title="Черновики"
                emptyText={query ? 'Ничего не найдено' : 'Черновиков нет'}
                load={loadDrafts}
                reloads={draftReloads}
                header={
                    <TextField
                        size="small"
                        placeholder="Поиск по заголовку"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />
                }
                badge={(item) => (item.wasPublished ? 'снят с публикации' : null)}
                canDelete={(item) => !item.wasPublished}
                onDelete={(item) => void remove(item)}
            />

            <WorkList
                title="Правки опубликованного"
                emptyText="Незавершённых правок нет"
                load={loadEdits}
                reloads={0}
                badge={() => 'на сайте прежняя версия'}
            />
        </Container>
    )
}
