import React from 'react'
import { MenuItem, Stack, TextField } from '@mui/material'

import { CREDIT_KIND_LABELS } from '../constants/creditKinds'
import type { CreditKind } from '../types/content'

export interface PictureText {
    alt: string
    caption: string
    credit: string
    creditKind: CreditKind
}

interface Props {
    value: PictureText
    onChange: (patch: Partial<PictureText>) => void
    disabled?: boolean
    autoFocus?: boolean
}

const KINDS = Object.entries(CREDIT_KIND_LABELS) as [CreditKind, string][]

// The text of a picture, the cover's and one in the article alike. Every part may stay empty,
// and the site then draws nothing in its place.
export const CaptionFields: React.FC<Props> = ({ value, onChange, disabled, autoFocus }) => (
    <Stack spacing={1.5}>
        <TextField
            label="Подпись"
            value={value.caption}
            onChange={(e) => onChange({ caption: e.target.value })}
            size="small"
            fullWidth
            multiline
            maxRows={3}
            disabled={disabled}
            autoFocus={autoFocus}
            slotProps={{ htmlInput: { maxLength: 500 } }}
        />
        <Stack direction="row" spacing={1}>
            <TextField
                select
                label="Что это"
                value={value.creditKind}
                onChange={(e) => onChange({ creditKind: e.target.value as CreditKind })}
                size="small"
                disabled={disabled}
                sx={{ minWidth: 150 }}
            >
                {KINDS.map(([kind, label]) => (
                    <MenuItem key={kind} value={kind}>
                        {label}
                    </MenuItem>
                ))}
            </TextField>
            <TextField
                label="Автор или источник"
                placeholder="Getty Images"
                value={value.credit}
                onChange={(e) => onChange({ credit: e.target.value })}
                size="small"
                fullWidth
                disabled={disabled}
                slotProps={{ htmlInput: { maxLength: 300 } }}
            />
        </Stack>
        <TextField
            label="Описание для незрячих"
            helperText="Что на изображении. Его читают экранные читалки и поисковики"
            value={value.alt}
            onChange={(e) => onChange({ alt: e.target.value })}
            size="small"
            fullWidth
            disabled={disabled}
            slotProps={{ htmlInput: { maxLength: 500 } }}
        />
    </Stack>
)
