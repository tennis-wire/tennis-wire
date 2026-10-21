import { Box, Chip, IconButton, Stack, Tooltip, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { DeleteOutlined } from '@mui/icons-material'

import { TINT } from '../../../theme'
import { agoOf } from '../lib/when'
import type { ItemCard } from '../types/aggregator'

interface Props {
    item: ItemCard
    sourceName: string
    now: Date
    selected: boolean
    onOpen: () => void
    onDelete: () => void
}

export default function FeedCard({ item, sourceName, now, selected, onOpen, onDelete }: Props) {
    return (
        <Stack
            component="article"
            direction="row"
            spacing={1}
            aria-current={selected || undefined}
            sx={(theme) => ({
                px: 2,
                py: 1.5,
                borderTop: 1,
                borderColor: 'divider',
                '&:first-of-type': { borderTop: 'none' },
                backgroundColor: selected
                    ? alpha(theme.palette.primary.main, TINT.soft)
                    : 'transparent',
                '&:hover': {
                    backgroundColor: alpha(
                        theme.palette.primary.main,
                        selected ? TINT.soft : TINT.faint
                    ),
                },
            })}
        >
            <Box
                component="button"
                type="button"
                onClick={onOpen}
                sx={{
                    flex: 1,
                    minWidth: 0,
                    p: 0,
                    border: 'none',
                    background: 'none',
                    textAlign: 'left',
                    font: 'inherit',
                    color: 'inherit',
                    cursor: 'pointer',
                }}
            >
                <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5, mb: 0.5 }}
                >
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                        {sourceName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        {item.language.toUpperCase()} ·{' '}
                        {agoOf(item.publishedAt ?? item.arrivedAt, now)}
                    </Typography>
                    {item.extraction !== 'ok' && <Chip size="small" label="только лид" />}
                    {item.titleBefore !== null && (
                        <Chip size="small" variant="outlined" label="заголовок изменён" />
                    )}
                    {item.hasEmbeds && <Chip size="small" variant="outlined" label="встройки" />}
                </Stack>
                <Typography
                    sx={{ fontWeight: 600, color: selected ? 'primary.dark' : 'text.primary' }}
                >
                    {item.title}
                </Typography>
                {item.lead && (
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                        }}
                    >
                        {item.lead}
                    </Typography>
                )}
            </Box>
            <Tooltip title="Удалить из ленты">
                <IconButton
                    size="small"
                    aria-label={`Удалить: ${item.title}`}
                    onClick={onDelete}
                    sx={{ alignSelf: 'flex-start' }}
                >
                    <DeleteOutlined fontSize="small" />
                </IconButton>
            </Tooltip>
        </Stack>
    )
}
