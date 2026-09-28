import React, { useState } from 'react'
import {
    Alert,
    Box,
    Button,
    Checkbox,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    IconButton,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from '@mui/material'
import { Add, Close, Poll as PollIcon } from '@mui/icons-material'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker'
import { ruRU } from '@mui/x-date-pickers/locales'
import type { DateTimeValidationError } from '@mui/x-date-pickers/models'
import dayjs, { type Dayjs } from 'dayjs'
import 'dayjs/locale/ru'

import { createPoll, type Poll } from '../api/pollApi'

const MIN_OPTIONS = 2
const MAX_OPTIONS = 10
const QUESTION_MAX = 300
const OPTION_MAX = 120

const pickerText = ruRU.components.MuiLocalizationProvider.defaultProps.localeText

// "Пн", "Вт": a single letter a day leaves two of П, С and В each
const weekday = (day: Dayjs) => {
    const short = day.format('dd')
    return short.charAt(0).toUpperCase() + short.slice(1)
}

type Deadline = 'none' | 'date'

interface Props {
    open: boolean
    onClose: () => void
    onInsert: (poll: Poll) => void
}

export const PollDialog: React.FC<Props> = ({ open, onClose, onInsert }) => {
    const [question, setQuestion] = useState('')
    const [options, setOptions] = useState<string[]>(['', ''])
    const [multipleChoice, setMultipleChoice] = useState(false)
    const [deadline, setDeadline] = useState<Deadline>('none')
    // Local time, the author's: the picker works in the browser's zone
    const [closesAt, setClosesAt] = useState<Dayjs | null>(null)
    const [pickerError, setPickerError] = useState<DateTimeValidationError>(null)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const filled = options.map((o) => o.trim()).filter((o) => o.length > 0)
    const inFuture = (value: Dayjs | null) =>
        value !== null && value.isValid() && value.isAfter(dayjs())
    const deadlineReady = deadline === 'none' || inFuture(closesAt)
    const ready =
        question.trim().length > 0 && filled.length >= MIN_OPTIONS && deadlineReady && !submitting

    const reset = () => {
        setQuestion('')
        setOptions(['', ''])
        setMultipleChoice(false)
        setDeadline('none')
        setClosesAt(null)
        setPickerError(null)
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

    const chooseDeadline = (next: Deadline | null) => {
        // a click on the button already pressed would leave neither
        if (next === null) return
        setDeadline(next)
        // tomorrow, on the hour: computed now, so a tab left open overnight does not offer the past
        if (next === 'date' && !inFuture(closesAt)) {
            setClosesAt(dayjs().startOf('hour').add(1, 'hour').add(1, 'day'))
        }
    }

    const handleSubmit = async () => {
        if (deadline === 'date' && !inFuture(closesAt)) {
            setError('Срок уже прошёл')
            return
        }
        setSubmitting(true)
        setError(null)
        try {
            const poll = await createPoll({
                question: question.trim(),
                options: filled,
                closesAt: deadline === 'date' && closesAt ? closesAt.toISOString() : null,
                multipleChoice,
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

    const pickerHelp =
        pickerError === null
            ? undefined
            : pickerError === 'invalidDate'
              ? 'Дата не дописана'
              : 'Срок уже прошёл'

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="ru" localeText={pickerText}>
            <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
                <DialogTitle
                    sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PollIcon color="primary" />
                        Опрос
                    </Box>
                    <IconButton
                        size="small"
                        onClick={handleClose}
                        disabled={submitting}
                        aria-label="Закрыть"
                    >
                        <Close fontSize="small" />
                    </IconButton>
                </DialogTitle>
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
                        <Box
                            key={index}
                            sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}
                        >
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
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: 1,
                        }}
                    >
                        <Button
                            size="small"
                            startIcon={<Add />}
                            onClick={() => setOptions((current) => [...current, ''])}
                            disabled={options.length >= MAX_OPTIONS}
                        >
                            Добавить вариант
                        </Button>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    size="small"
                                    checked={multipleChoice}
                                    onChange={(e) => setMultipleChoice(e.target.checked)}
                                />
                            }
                            label="Несколько ответов"
                            slotProps={{ typography: { variant: 'body2' } }}
                        />
                    </Box>
                    <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                        Срок
                    </Typography>
                    <ToggleButtonGroup
                        value={deadline}
                        exclusive
                        onChange={(_, next: Deadline | null) => chooseDeadline(next)}
                        fullWidth
                        size="small"
                        aria-label="Срок"
                        sx={{
                            '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 600 },
                        }}
                    >
                        <ToggleButton value="none">Без срока</ToggleButton>
                        <ToggleButton value="date">До даты</ToggleButton>
                    </ToggleButtonGroup>
                    {deadline === 'none' ? (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            Голосование не закроется само
                        </Typography>
                    ) : (
                        <DateTimePicker
                            label="Закрыть голосование"
                            value={closesAt}
                            onChange={(value) => setClosesAt(value)}
                            onError={(reason) => setPickerError(reason)}
                            ampm={false}
                            disablePast
                            format="DD.MM.YYYY HH:mm"
                            dayOfWeekFormatter={weekday}
                            slotProps={{
                                textField: {
                                    fullWidth: true,
                                    margin: 'normal',
                                    helperText: pickerHelp,
                                },
                            }}
                        />
                    )}
                    {error && (
                        <Alert severity="error" sx={{ mt: 1 }}>
                            {error}
                        </Alert>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={handleClose} color="inherit" disabled={submitting}>
                        Отмена
                    </Button>
                    <Button variant="contained" onClick={handleSubmit} disabled={!ready}>
                        {submitting ? 'Создание' : 'Вставить'}
                    </Button>
                </DialogActions>
            </Dialog>
        </LocalizationProvider>
    )
}
