import { useEffect, useState } from 'react'
import {
    Alert,
    Avatar,
    Box,
    Button,
    CircularProgress,
    Container,
    Paper,
    Stack,
    Typography,
} from '@mui/material'

import UserMenu from '../../auth/UserMenu'
import ModerationNav from './ModerationNav'
import { moderationApi, ModerationApiError } from './api/moderationApi'
import type { AvatarQueueEntry } from './types/moderation'

// user-service takes up to 200
const BATCH = 60

type Decision = 'approve' | 'takeDown'

// Post-moderation: every avatar is already on the site, this only catches up with them. A decided
// card leaves the screen at once; the server has dropped it from the queue too, so the next load
// brings the next ones rather than the same.
export default function AvatarQueuePage() {
    const [entries, setEntries] = useState<AvatarQueueEntry[]>([])
    // the last load came back full: there may be more behind it
    const [more, setMore] = useState(false)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState<ReadonlySet<string>>(new Set())
    const [reloads, setReloads] = useState(0)

    useEffect(() => {
        let live = true
        moderationApi
            .avatarQueue(BATCH)
            .then((queue) => {
                if (!live) return
                setEntries(queue.items)
                setMore(queue.items.length === BATCH)
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
    }, [reloads])

    function reload() {
        setLoading(true)
        setReloads((n) => n + 1)
    }

    function drop(entry: AvatarQueueEntry) {
        setEntries((current) => current.filter((e) => e.userId !== entry.userId))
    }

    async function decide(entry: AvatarQueueEntry, decision: Decision) {
        setBusy((current) => new Set(current).add(entry.userId))
        try {
            if (decision === 'approve') {
                await moderationApi.approveAvatar(entry.userId, entry.avatarKey)
            } else {
                await moderationApi.takeDownAvatar(entry.userId, entry.avatarKey)
            }
            drop(entry)
        } catch (failure) {
            setError(messageFor(failure))
            if (failure instanceof ModerationApiError && failure.status === 404) drop(entry)
            // the new avatar is in the queue in place of this one
            if (failure instanceof ModerationApiError && failure.status === 409) reload()
        } finally {
            setBusy((current) => {
                const next = new Set(current)
                next.delete(entry.userId)
                return next
            })
        }
    }

    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            <Stack
                direction="row"
                sx={{ mb: 2, alignItems: 'center', justifyContent: 'space-between' }}
            >
                <Typography variant="h4" component="h1">
                    Аватары
                </Typography>
                <UserMenu />
            </Stack>
            <ModerationNav />

            {error !== null && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {loading && entries.length === 0 && <CircularProgress size={28} />}

            {!loading && entries.length === 0 && error === null && !more && (
                <Typography color="text.secondary">Новых аватаров нет.</Typography>
            )}

            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                    gap: 2,
                }}
            >
                {entries.map((entry) => (
                    <Card
                        key={entry.userId}
                        entry={entry}
                        busy={busy.has(entry.userId)}
                        onDecide={decide}
                    />
                ))}
            </Box>

            {!loading && (entries.length > 0 || more) && (
                <Box sx={{ mt: 3 }}>
                    <Button onClick={reload}>
                        {entries.length === 0 ? 'Следующие' : 'Обновить'}
                    </Button>
                </Box>
            )}
        </Container>
    )
}

function Card({
    entry,
    busy,
    onDecide,
}: {
    entry: AvatarQueueEntry
    busy: boolean
    onDecide: (entry: AvatarQueueEntry, decision: Decision) => Promise<void>
}) {
    return (
        <Paper sx={{ p: 1.5 }}>
            {/* The whole square, not the circle readers get: the corners are stored too */}
            <Avatar
                variant="rounded"
                src={entry.avatarLargeUrl}
                alt=""
                sx={{ width: '100%', height: 'auto', aspectRatio: '1', mb: 1 }}
            >
                Не загрузилось
            </Avatar>
            <Typography variant="body2" noWrap title={entry.displayName}>
                {entry.displayName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
                {new Date(entry.updatedAt).toLocaleString('ru-RU')}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Button
                    size="small"
                    disabled={busy}
                    onClick={() => void onDecide(entry, 'approve')}
                >
                    Ок
                </Button>
                <Button
                    size="small"
                    color="error"
                    disabled={busy}
                    onClick={() => void onDecide(entry, 'takeDown')}
                >
                    Снять
                </Button>
            </Stack>
        </Paper>
    )
}

function messageFor(error: unknown): string {
    if (error instanceof ModerationApiError) {
        if (error.status === 403) return 'Нет прав на модерацию.'
        if (error.status === 404) return 'Этого аккаунта уже нет.'
        if (error.status === 409)
            return 'Пока карточка была на экране, аватар сменился. Новый уже в очереди.'
        return error.message
    }
    return 'Не удалось связаться с сервером.'
}
