import { useState } from 'react'
import {
    Box,
    Button,
    Checkbox,
    FormControlLabel,
    InputAdornment,
    Popover,
    Stack,
    TextField,
    Typography,
} from '@mui/material'
import { ExpandMore, Search } from '@mui/icons-material'

export interface MenuOption {
    value: string
    label: string
    hint?: string
    // a problem worth a dot beside the name, said in words on hover
    warning?: string
}

interface Props {
    label: string
    options: MenuOption[]
    selected: string[]
    onChange: (values: string[]) => void
    searchable?: boolean
}

// Several values out of a list that may grow long: a button that says how many are chosen, and a
// list with a search above it. Nothing chosen means everything
export default function MultiSelectMenu({ label, options, selected, onChange, searchable }: Props) {
    const [anchor, setAnchor] = useState<HTMLElement | null>(null)
    const [search, setSearch] = useState('')
    const chosen = new Set(selected)
    const needle = search.trim().toLowerCase()
    const shown = needle
        ? options.filter((option) => option.label.toLowerCase().includes(needle))
        : options
    const warned = options.some((option) => option.warning)

    function toggle(value: string) {
        onChange(chosen.has(value) ? selected.filter((v) => v !== value) : [...selected, value])
    }

    return (
        <>
            <Button
                variant="outlined"
                color="inherit"
                endIcon={<ExpandMore />}
                onClick={(event) => setAnchor(event.currentTarget)}
                aria-haspopup="dialog"
                aria-expanded={anchor !== null}
            >
                {label}: {selected.length === 0 ? 'все' : selected.length}
                {warned && selected.length === 0 && <Dot />}
            </Button>
            <Popover
                open={anchor !== null}
                anchorEl={anchor}
                onClose={() => {
                    setAnchor(null)
                    setSearch('')
                }}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                slotProps={{ paper: { sx: { width: 320, p: 1.5, mt: 0.5 } } }}
            >
                {searchable && (
                    <TextField
                        size="small"
                        fullWidth
                        autoFocus
                        placeholder="Найти"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        sx={{ mb: 1 }}
                        slotProps={{
                            htmlInput: { 'aria-label': `Найти: ${label.toLowerCase()}` },
                            input: {
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <Search fontSize="small" />
                                    </InputAdornment>
                                ),
                            },
                        }}
                    />
                )}
                <Box sx={{ maxHeight: 360, overflow: 'auto' }}>
                    {shown.map((option) => (
                        <Stack key={option.value} direction="row" sx={{ alignItems: 'center' }}>
                            <FormControlLabel
                                sx={{ flex: 1, mr: 0, minWidth: 0 }}
                                control={
                                    <Checkbox
                                        size="small"
                                        checked={chosen.has(option.value)}
                                        onChange={() => toggle(option.value)}
                                    />
                                }
                                label={<Typography variant="body2">{option.label}</Typography>}
                            />
                            {option.hint && (
                                <Typography variant="caption" color="text.secondary" sx={{ mx: 1 }}>
                                    {option.hint}
                                </Typography>
                            )}
                            {option.warning && <Dot title={option.warning} />}
                        </Stack>
                    ))}
                    {shown.length === 0 && (
                        <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
                            Ничего не нашлось
                        </Typography>
                    )}
                </Box>
                <Stack direction="row" sx={{ justifyContent: 'flex-end', pt: 1 }}>
                    <Button
                        size="small"
                        onClick={() => onChange([])}
                        disabled={selected.length === 0}
                    >
                        Сбросить
                    </Button>
                </Stack>
            </Popover>
        </>
    )
}

function Dot({ title }: { title?: string }) {
    return (
        <Box
            component="span"
            title={title}
            aria-label={title}
            sx={{
                display: 'inline-block',
                flex: 'none',
                width: 8,
                height: 8,
                ml: 1,
                borderRadius: '50%',
                bgcolor: 'warning.main',
            }}
        />
    )
}
