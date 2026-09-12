import { useEffect, useState } from 'react'
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Container,
    Divider,
    Paper,
    Stack,
    Typography,
} from '@mui/material'

import UserMenu from '../../auth/UserMenu'
import { moderationApi, ModerationApiError } from './api/moderationApi'
import { REASON_LABELS, type QueueEntry, type Resolution } from './types/moderation'

const PAGE_SIZE = 50
// discussion-service caps a page here, so this screen cannot show more than that
const MAX_SIZE = 200

interface Loaded {
    entries: QueueEntry[]
    full: boolean
    capped: boolean
}

// One request, not one per page: the sort key is a count that changes under the reader, and two
// requests would disagree about the order between them. Returns data only, so a stale answer can
// be dropped by whoever asked
async function loadUpTo(page: number): Promise<Loaded> {
    const size = Math.min((page + 1) * PAGE_SIZE, MAX_SIZE)
    const queue = await moderationApi.queue(0, size)
    return { entries: queue.items, full: queue.items.length === size, capped: size >= MAX_SIZE }
}

// The queue, deliberately plain: a flat list, no layout work. What it does have
// to get right is which decisions it offers — a comment its author deleted can
// be counted against him or let go, but not removed a second time
export default function ModerationPage() {
    const [entries, setEntries] = useState<QueueEntry[]>([])
    const [page, setPage] = useState(0)
    const [full, setFull] = useState(false)
    const [capped, setCapped] = useState(false)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState<string | null>(null)
    const [reloads, setReloads] = useState(0)

    // Always from the top, never patched in place: a decision changes the counts everything is
    // ordered by. An answer that arrives after the next request started is dropped
    useEffect(() => {
        let live = true
        loadUpTo(page)
            .then((loaded) => {
                if (!live) return
                setEntries(loaded.entries)
                setFull(loaded.full)
                setCapped(loaded.capped)
                setError(null)
            })
            .catch((failure: unknown) => {
                if (live) setError(messageFor(failure))
            })
            .finally(() => {
                if (live) setLoading(false)
            })
        return () => {
            live = false
        }
    }, [page, reloads])

    function showMore() {
        setLoading(true)
        setPage(page + 1)
    }

    async function decide(entry: QueueEntry, resolution: Resolution) {
        setBusy(entry.commentId)
        try {
            await moderationApi.resolve(entry.commentId, resolution)
            setLoading(true)
            setReloads((n) => n + 1)
        } catch (failure) {
            setError(messageFor(failure))
            // 404 and 409 both mean someone else moved this card while it was on screen.
            if (
                failure instanceof ModerationApiError &&
                (failure.status === 404 || failure.status === 409)
            ) {
                setLoading(true)
                setReloads((n) => n + 1)
            }
        } finally {
            setBusy(null)
        }
    }

    return (
        <Container maxWidth="md" sx={{ py: 4 }}>
            <Stack
                direction="row"
                sx={{ mb: 3, alignItems: 'center', justifyContent: 'space-between' }}
            >
                <Typography variant="h4" component="h1">
                    Жалобы
                </Typography>
                <UserMenu />
            </Stack>

            {error !== null && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {loading && entries.length === 0 && <CircularProgress size={28} />}

            {!loading && entries.length === 0 && error === null && (
                <Typography color="text.secondary">Открытых жалоб нет.</Typography>
            )}

            <Stack spacing={2}>
                {entries.map((entry) => (
                    <Card
                        key={entry.commentId}
                        entry={entry}
                        busy={busy === entry.commentId}
                        onDecide={decide}
                    />
                ))}
            </Stack>

            {full && !capped && (
                <Box sx={{ mt: 3 }}>
                    <Button onClick={showMore} disabled={loading}>
                        Показать ещё
                    </Button>
                </Box>
            )}

            {full && capped && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
                    Показаны первые {MAX_SIZE} карточек. Разберите их, чтобы увидеть следующие.
                </Typography>
            )}
        </Container>
    )
}

function Card({
    entry,
    busy,
    onDecide,
}: {
    entry: QueueEntry
    busy: boolean
    onDecide: (entry: QueueEntry, resolution: Resolution) => Promise<void>
}) {
    return (
        <Paper sx={{ p: 2 }}>
            <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap' }}>
                <Chip size="small" label={`Жалоб: ${entry.reportCount}`} />
                {Object.entries(entry.reasons).map(([reason, count]) => (
                    <Chip
                        key={reason}
                        size="small"
                        variant="outlined"
                        label={`${REASON_LABELS[reason] ?? reason}: ${count}`}
                    />
                ))}
                {entry.fromBot && <Chip size="small" color="info" label="Есть от бота" />}
                {entry.deletedByAuthor && (
                    <Chip size="small" color="warning" label="Удалён автором" />
                )}
            </Stack>

            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', mb: 1 }}>
                {entry.body}
            </Typography>

            <Typography variant="body2" color="text.secondary">
                {entry.author.displayName ?? `Автор ${entry.author.id}`}
                {entry.author.restriction !== null && ' · под баном'}
                {entry.author.restriction !== null &&
                    (entry.author.restriction.expiresAt === null
                        ? ' бессрочно'
                        : ` до ${formatTime(entry.author.restriction.expiresAt)}`)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
                Удалено модерацией: {entry.author.removedByModerator.total} (за 30 дней{' '}
                {entry.author.removedByModerator.last30Days}), ботом:{' '}
                {entry.author.removedByBot.total} (за 30 дней {entry.author.removedByBot.last30Days}
                )
            </Typography>
            <Typography variant="body2" color="text.secondary">
                Первая жалоба {formatTime(entry.firstReportedAt)}, последняя{' '}
                {formatTime(entry.lastReportedAt)} · {entry.subjectType} {entry.subjectId}
            </Typography>

            <Divider sx={{ my: 1.5 }} />

            <Stack direction="row" spacing={1}>
                {entry.deletedByAuthor ? (
                    <Button
                        size="small"
                        color="error"
                        disabled={busy}
                        onClick={() => void onDecide(entry, 'counted')}
                    >
                        Засчитать нарушение
                    </Button>
                ) : (
                    <Button
                        size="small"
                        color="error"
                        disabled={busy}
                        onClick={() => void onDecide(entry, 'hidden')}
                    >
                        Удалить
                    </Button>
                )}
                <Button
                    size="small"
                    disabled={busy}
                    onClick={() => void onDecide(entry, 'dismissed')}
                >
                    {entry.deletedByAuthor ? 'Закрыть' : 'Оставить'}
                </Button>
            </Stack>
        </Paper>
    )
}

function formatTime(iso: string): string {
    return new Date(iso).toLocaleString('ru-RU')
}

function messageFor(error: unknown): string {
    if (error instanceof ModerationApiError) {
        // The server decides; a gate in the browser only hides the page from a menu.
        if (error.status === 403) return 'Нет прав на модерацию.'
        if (error.status === 404) return 'Жалоба уже закрыта кем-то другим.'
        if (error.status === 409)
            return 'Комментарий изменил состояние: это решение уже не подходит.'
        return error.message
    }
    return 'Не удалось связаться с сервером.'
}
