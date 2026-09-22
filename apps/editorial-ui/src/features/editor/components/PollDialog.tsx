import React, { useState } from 'react'
import {
    Alert,
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    InputAdornment,
    TextField,
    Typography,
} from '@mui/material'
import { Add, Close } from '@mui/icons-material'

import { createPoll, type Poll } from '../api/pollApi'

const MIN_OPTIONS = 2
const MAX_OPTIONS = 10
const QUESTION_MAX = 300
const OPTION_MAX = 120

interface Props {
    open: boolean
    onClose: () => void
    onInsert: (poll: Poll) => void
}

// A datetime-local value has no zone; the browser reads it as local time, which is the author's
function toInstant(local: string): string | null {
    return local ? new Date(local).toISOString() : null
}

export const PollDialog: React.FC<Props> = ({ open, onClose, onInsert }) => {
    const [question, setQuestion] = useState('')
    const [options, setOptions] = useState<string[]>(['', ''])
    const [closesAt, setClosesAt] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const filled = options.map((o) => o.trim()).filter((o) => o.length > 0)
    const ready = question.trim().length > 0 && filled.length >= MIN_OPTIONS && !submitting

    const reset = () => {
        setQuestion('')
        setOptions(['', ''])
        setClosesAt('')
        setError(null)
    }

    const handleClose = () => {
        if (submitting) return
        reset()
        onClose()
    }

    const setOption = (index: number, value: string) =>
        setOptions((current) => current.map((o, i) => (i === index ? value : o)))

    const removeOption = (index: number) =>
        setOptions((current) => current.filter((_, i) => i !== index))

    const handleSubmit = async () => {
        setSubmitting(true)
        setError(null)
        try {
            const poll = await createPoll({
                question: question.trim(),
                options: filled,
                closesAt: toInstant(closesAt),
            })
            reset()
            onInsert(poll)
            onClose()
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Не удалось создать опрос')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle>Опрос</DialogTitle>
            <DialogContent>
                <TextField
                    label="Вопрос"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    fullWidth
                    autoFocus
                    margin="normal"
                    slotProps={{ htmlInput: { maxLength: QUESTION_MAX } }}
                />
                <Typography variant="subtitle2" sx={{ mt: 1, mb: 0.5 }}>
                    Варианты
                </Typography>
                {options.map((option, index) => (
                    <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
                        <TextField
                            value={option}
                            onChange={(e) => setOption(index, e.target.value)}
                            placeholder={`Вариант ${index + 1}`}
                            size="small"
                            fullWidth
                            slotProps={{ htmlInput: { maxLength: OPTION_MAX } }}
                        />
                        <IconButton
                            size="small"
                            onClick={() => removeOption(index)}
                            disabled={options.length <= MIN_OPTIONS}
                            aria-label="Убрать вариант"
                        >
                            <Close fontSize="small" />
                        </IconButton>
                    </Box>
                ))}
                <Button
                    size="small"
                    startIcon={<Add />}
                    onClick={() => setOptions((current) => [...current, ''])}
                    disabled={options.length >= MAX_OPTIONS}
                >
                    Добавить вариант
                </Button>
                <TextField
                    label="Закрыть голосование"
                    type="datetime-local"
                    value={closesAt}
                    onChange={(e) => setClosesAt(e.target.value)}
                    fullWidth
                    margin="normal"
                    helperText="Пусто: голосование без срока. Закрыть можно и позже."
                    slotProps={{
                        inputLabel: { shrink: true },
                        input: {
                            // the browser's own picker has no way to empty the field
                            endAdornment: closesAt ? (
                                <InputAdornment position="end">
                                    <IconButton
                                        size="small"
                                        onClick={() => setClosesAt('')}
                                        aria-label="Без срока"
                                    >
                                        <Close fontSize="small" />
                                    </IconButton>
                                </InputAdornment>
                            ) : undefined,
                        },
                    }}
                />
                {error && (
                    <Alert severity="error" sx={{ mt: 1 }}>
                        {error}
                    </Alert>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose} disabled={submitting}>
                    Отмена
                </Button>
                <Button variant="contained" onClick={handleSubmit} disabled={!ready}>
                    {submitting ? 'Создание' : 'Вставить'}
                </Button>
            </DialogActions>
        </Dialog>
    )
}
