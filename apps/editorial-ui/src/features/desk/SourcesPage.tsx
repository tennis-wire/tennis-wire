import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from 'react-oidc-context'
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Container,
    InputAdornment,
    LinearProgress,
    Paper,
    Snackbar,
    Stack,
    TextField,
    Typography,
} from '@mui/material'
import { Refresh, Search } from '@mui/icons-material'

import UserMenu from '../../auth/UserMenu'
import DeskNav from './DeskNav'
import { aggregatorApi, messageOf } from './api/aggregatorApi'
import FeedCard from './components/FeedCard'
import HealthNotice from './components/HealthNotice'
import ItemPanel from './components/ItemPanel'
import MultiSelectMenu from './components/MultiSelectMenu'
import { useFeed } from './hooks/useFeed'
import { useUndoableDelete } from './hooks/useUndoableDelete'
import { NO_FILTER, readFilter, writeFilter, type Filter } from './lib/feedFilter'
import { hasProblems, problemsOf } from './lib/health'
import type { FeedQuery, Item, ItemCard, Source } from './types/aggregator'

// The next card to show once this one is gone: the one below, else the one above
function neighbour(items: ItemCard[], id: string): string | null {
    const at = items.findIndex((item) => item.id === id)
    if (at < 0) return null
    return items[at + 1]?.id ?? items[at - 1]?.id ?? null
}

// News from the sources, newest arrival first, and the one open beside them
// (architecture/aggregator.md 5.2)
export default function SourcesPage() {
    const auth = useAuth()
    const sub = auth.user?.profile.sub ?? 'anonymous'
    const [params, setParams] = useSearchParams()
    const openId = params.get('item')

    const [filter, setFilter] = useState<Filter>(() => readFilter(sub))
    const [search, setSearch] = useState('')
    const [typed, setTyped] = useState('')
    const [reloads, setReloads] = useState(0)
    const [now, setNow] = useState(() => new Date())
    const [sources, setSources] = useState<Source[]>([])
    const [opened, setOpened] = useState<{ id: string; item?: Item; error?: string } | null>(null)
    const [failure, setFailure] = useState<string | null>(null)

    useEffect(() => {
        const timer = setTimeout(() => setSearch(typed.trim()), 300)
        return () => clearTimeout(timer)
    }, [typed])

    const query = useMemo<FeedQuery>(() => ({ ...filter, search }), [filter, search])
    const feed = useFeed(query, reloads)

    // Read again with every refresh: health is what the collector last said
    useEffect(() => {
        const controller = new AbortController()
        aggregatorApi.sources(controller.signal).then(setSources, () => {
            // the feed still works; names fall back to keys and health goes unsaid
        })
        return () => controller.abort()
    }, [reloads])

    useEffect(() => {
        if (openId === null) return
        const controller = new AbortController()
        aggregatorApi.item(openId, controller.signal).then(
            (item) => setOpened({ id: openId, item }),
            (failed: unknown) => {
                if (!controller.signal.aborted) setOpened({ id: openId, error: messageOf(failed) })
            }
        )
        return () => controller.abort()
    }, [openId])

    const select = useCallback(
        (id: string | null) =>
            setParams(
                (before) => {
                    const next = new URLSearchParams(before)
                    if (id === null) next.delete('item')
                    else next.set('item', id)
                    return next
                },
                { replace: true }
            ),
        [setParams]
    )

    const deletion = useUndoableDelete(
        (id) => aggregatorApi.remove(id),
        () => setFailure('Не удалось удалить новость: она вернулась в ленту.')
    )
    const visible = feed.items.filter((item) => !deletion.hidden.has(item.id))

    function remove(id: string) {
        if (id === openId) select(neighbour(visible, id))
        deletion.remove(id)
    }

    function changeFilter(next: Filter) {
        setFilter(next)
        writeFilter(sub, next)
    }

    function refresh() {
        setNow(new Date())
        setReloads((n) => n + 1)
    }

    const names = useMemo(() => new Map(sources.map((s) => [s.key, s.name])), [sources])
    const sourceName = useCallback((key: string) => names.get(key) ?? key, [names])
    const warnings = useMemo(() => {
        const byName = new Map<string, string[]>()
        problemsOf(sources).forEach((p) =>
            byName.set(p.source, [...(byName.get(p.source) ?? []), p.text])
        )
        return byName
    }, [sources])
    const sourceOptions = sources.map((source) => ({
        value: source.key,
        label: source.name,
        hint: source.retired ? 'выбыл' : source.language.toUpperCase(),
        warning: hasProblems(source) ? warnings.get(source.name)?.join('; ') : undefined,
    }))
    const languageOptions = [...new Set(sources.filter((s) => !s.retired).map((s) => s.language))]
        .sort()
        .map((language) => ({ value: language, label: language.toUpperCase() }))

    const narrowed = filter.sources.length > 0 || filter.languages.length > 0 || search !== ''
    const panel = openId !== null && opened?.id === openId ? opened : null

    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
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

            <HealthNotice sources={sources} now={now} />

            <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', rowGap: 1 }}>
                <TextField
                    size="small"
                    placeholder="Поиск по заголовку и лиду"
                    value={typed}
                    onChange={(event) => setTyped(event.target.value)}
                    sx={{ flex: 1, minWidth: 240 }}
                    slotProps={{
                        htmlInput: { 'aria-label': 'Поиск по заголовку и лиду' },
                        input: {
                            startAdornment: (
                                <InputAdornment position="start">
                                    <Search fontSize="small" />
                                </InputAdornment>
                            ),
                        },
                    }}
                />
                <MultiSelectMenu
                    label="Источники"
                    options={sourceOptions}
                    selected={filter.sources}
                    onChange={(values) => changeFilter({ ...filter, sources: values })}
                    searchable
                />
                <MultiSelectMenu
                    label="Языки"
                    options={languageOptions}
                    selected={filter.languages}
                    onChange={(values) => changeFilter({ ...filter, languages: values })}
                />
                <Button variant="outlined" startIcon={<Refresh />} onClick={refresh}>
                    Обновить
                </Button>
            </Stack>

            {feed.error !== null && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {feed.error}
                </Alert>
            )}

            <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={2}
                sx={{ alignItems: { md: 'flex-start' } }}
            >
                <Box sx={{ flex: '1 1 0', minWidth: 0, width: '100%' }}>
                    {feed.loading && feed.items.length > 0 && <LinearProgress sx={{ mb: 1 }} />}
                    {feed.loading && feed.items.length === 0 && <CircularProgress size={28} />}

                    {feed.loaded && visible.length === 0 && (
                        <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
                            {narrowed ? (
                                <>
                                    <Typography sx={{ mb: 1.5 }}>Ничего не нашлось</Typography>
                                    <Button
                                        variant="outlined"
                                        onClick={() => {
                                            setTyped('')
                                            setSearch('')
                                            changeFilter(NO_FILTER)
                                        }}
                                    >
                                        Сбросить фильтры и поиск
                                    </Button>
                                </>
                            ) : (
                                <Typography color="text.secondary">
                                    Новостей пока нет: сборщик приносит их по мере выхода.
                                </Typography>
                            )}
                        </Paper>
                    )}

                    {visible.length > 0 && (
                        <Paper variant="outlined">
                            {visible.map((item) => (
                                <FeedCard
                                    key={item.id}
                                    item={item}
                                    sourceName={sourceName(item.source)}
                                    now={now}
                                    selected={item.id === openId}
                                    onOpen={() => select(item.id)}
                                    onDelete={() => remove(item.id)}
                                />
                            ))}
                        </Paper>
                    )}

                    {feed.hasMore && <MoreTrigger busy={feed.moreBusy} onMore={feed.loadMore} />}
                </Box>

                <Paper
                    variant="outlined"
                    sx={{
                        flex: '1.2 1 0',
                        minWidth: 0,
                        width: '100%',
                        p: 3,
                        position: { md: 'sticky' },
                        top: { md: 16 },
                        maxHeight: { md: 'calc(100vh - 32px)' },
                        overflow: { md: 'auto' },
                        display: { xs: openId === null ? 'none' : 'block', md: 'block' },
                    }}
                >
                    {openId === null ? (
                        <Typography color="text.secondary">Выберите новость в ленте.</Typography>
                    ) : (
                        <ItemPanel
                            item={panel?.item ?? null}
                            error={panel?.error ?? null}
                            sourceName={sourceName}
                            onClose={() => select(null)}
                            onDelete={remove}
                        />
                    )}
                </Paper>
            </Stack>

            <Snackbar
                open={deletion.pending !== null}
                message="Новость удалена"
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                action={
                    <Button color="inherit" size="small" onClick={deletion.undo}>
                        Отменить
                    </Button>
                }
            />
            <Snackbar
                open={failure !== null}
                autoHideDuration={6000}
                onClose={() => setFailure(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert severity="error" variant="filled" onClose={() => setFailure(null)}>
                    {failure}
                </Alert>
            </Snackbar>
        </Container>
    )
}

// The next page comes when the end of the list scrolls into view; the button is there for
// whoever does not scroll, and where the browser cannot watch
function MoreTrigger({ busy, onMore }: { busy: boolean; onMore: () => void }) {
    const ref = useRef<HTMLDivElement>(null)
    const onMoreRef = useRef(onMore)

    useEffect(() => {
        onMoreRef.current = onMore
    })

    useEffect(() => {
        const element = ref.current
        if (element === null || typeof IntersectionObserver === 'undefined') return
        const observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) onMoreRef.current()
        })
        observer.observe(element)
        return () => observer.disconnect()
    }, [])

    return (
        <Box ref={ref} sx={{ mt: 2, textAlign: 'center' }}>
            <Button onClick={onMore} disabled={busy}>
                {busy ? 'Загружаем…' : 'Показать ещё'}
            </Button>
        </Box>
    )
}
