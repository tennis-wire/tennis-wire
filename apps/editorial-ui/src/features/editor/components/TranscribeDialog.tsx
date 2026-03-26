import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Box,
    Typography,
    IconButton,
    Paper,
    Alert,
    LinearProgress,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    FormControlLabel,
    Checkbox,
    Tabs,
    Tab,
    Chip,
} from '@mui/material'
import {
    ContentCopy,
    Check,
    Close,
    Upload,
    Delete,
    Link as LinkIcon,
    Mic,
} from '@mui/icons-material'

import {
    transcribeUrl,
    transcribeFile,
    getJobStatus,
    getJobResult,
    cancelJob,
    type JobStatus,
    type TranscriptionResult,
} from '../api/transcribeApi'
import { transcriptionLanguages } from '../constants/languages'

interface Props {
    open: boolean
    onClose: () => void
    onInsert: (text: string) => void
}

const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export const TranscribeDialog: React.FC<Props> = ({ open, onClose, onInsert }) => {
    const [inputTab, setInputTab] = useState(0)
    const [url, setUrl] = useState('')
    const [file, setFile] = useState<File | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [language, setLanguage] = useState('')
    const [enableDiarization, setEnableDiarization] = useState(false)
    const [showTimestamps, setShowTimestamps] = useState(true)

    const [jobId, setJobId] = useState<string | null>(null)
    const [status, setStatus] = useState<JobStatus>('idle')
    const [progress, setProgress] = useState(0)
    const [statusMessage, setStatusMessage] = useState('')
    const [error, setError] = useState('')

    const [result, setResult] = useState<TranscriptionResult | null>(null)
    const [copied, setCopied] = useState(false)

    const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        return () => {
            if (pollingRef.current) clearTimeout(pollingRef.current)
        }
    }, [])

    // Polling статуса через API
    const pollStatus = useCallback(async (id: string) => {
        try {
            const data = await getJobStatus(id)
            setStatus(data.status)
            setProgress(data.progress || 0)
            setStatusMessage(data.status_message || '')

            if (data.status === 'completed') {
                const resultData = await getJobResult(id)
                setResult(resultData)
            } else if (data.status === 'failed') {
                setError(data.error || 'Транскрипция не удалась')
            } else {
                pollingRef.current = setTimeout(() => pollStatus(id), 2000)
            }
        } catch (err) {
            console.error('Polling error:', err)
            setError(err instanceof Error ? err.message : 'Ошибка получения статуса')
            setStatus('failed')
        }
    }, [])

    const handleStart = async () => {
        setError('')
        setResult(null)
        setStatus('pending')
        setProgress(0)

        try {
            let data: { job_id: string }

            if (inputTab === 0) {
                if (!url.trim()) {
                    setError('Введите URL видео')
                    setStatus('idle')
                    return
                }
                data = await transcribeUrl(url.trim(), language || undefined, enableDiarization)
            } else {
                if (!file) {
                    setError('Выберите файл')
                    setStatus('idle')
                    return
                }
                data = await transcribeFile(file, language || undefined, enableDiarization)
            }

            setJobId(data.job_id)
            pollStatus(data.job_id)
        } catch (err) {
            console.error('Start error:', err)
            setError(err instanceof Error ? err.message : 'Ошибка запуска транскрипции')
            setStatus('failed')
        }
    }

    const handleCancel = async () => {
        if (pollingRef.current) clearTimeout(pollingRef.current)
        if (jobId) {
            try {
                await cancelJob(jobId)
            } catch (err) {
                console.error('Cancel error:', err)
            }
        }
        setStatus('idle')
        setJobId(null)
        setProgress(0)
        setStatusMessage('')
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (selectedFile) {
            if (selectedFile.size > 500 * 1024 * 1024) {
                setError('Файл слишком большой (максимум 500MB)')
                return
            }
            setFile(selectedFile)
            setError('')
        }
        e.target.value = ''
    }

    const formatResult = (): string => {
        if (!result) return ''
        if (!showTimestamps) return result.text
        return result.segments
            .map((segment) => {
                const time = `[${formatTime(segment.start)}]`
                const speaker = segment.speaker ? ` ${segment.speaker}:` : ''
                return `${time}${speaker} ${segment.text}`
            })
            .join('\n\n')
    }

    const handleCopy = () => {
        navigator.clipboard.writeText(formatResult())
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const handleInsert = () => {
        onInsert(formatResult())
        handleClose()
    }

    const handleClose = () => {
        if (pollingRef.current) clearTimeout(pollingRef.current)
        setUrl('')
        setFile(null)
        setLanguage('')
        setEnableDiarization(false)
        setJobId(null)
        setStatus('idle')
        setProgress(0)
        setStatusMessage('')
        setError('')
        setResult(null)
        setCopied(false)
        onClose()
    }

    const getStatusText = () => {
        switch (status) {
            case 'pending':
                return 'В очереди...'
            case 'downloading':
                return 'Скачивание видео...'
            case 'processing':
                return statusMessage || 'Транскрибируем...'
            default:
                return ''
        }
    }

    const isProcessing = ['pending', 'downloading', 'processing'].includes(status)
    const canStart = (inputTab === 0 ? url.trim() : file) && status === 'idle'

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
            <DialogTitle
                sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Mic color="primary" />
                    Транскрипция
                </Box>
                <IconButton size="small" onClick={handleClose}>
                    <Close fontSize="small" />
                </IconButton>
            </DialogTitle>

            <DialogContent>
                {/* Выбор источника */}
                {!result && (
                    <>
                        <Tabs value={inputTab} onChange={(_, v) => setInputTab(v)} sx={{ mb: 2 }}>
                            <Tab icon={<LinkIcon />} label="YouTube / URL" />
                            <Tab icon={<Upload />} label="Загрузить файл" />
                        </Tabs>

                        {inputTab === 0 && (
                            <TextField
                                fullWidth
                                label="URL видео"
                                placeholder="https://youtube.com/watch?v=... или прямая ссылка"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                disabled={isProcessing}
                                sx={{ mb: 2 }}
                            />
                        )}

                        {inputTab === 1 && (
                            <Box sx={{ mb: 2 }}>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    style={{ display: 'none' }}
                                    accept="audio/*,video/*"
                                    onChange={handleFileSelect}
                                />
                                {file ? (
                                    <Paper
                                        variant="outlined"
                                        sx={{
                                            p: 2,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                        }}
                                    >
                                        <Box>
                                            <Typography variant="body2">{file.name}</Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {(file.size / 1024 / 1024).toFixed(1)} MB
                                            </Typography>
                                        </Box>
                                        <IconButton
                                            size="small"
                                            onClick={() => setFile(null)}
                                            disabled={isProcessing}
                                        >
                                            <Delete fontSize="small" />
                                        </IconButton>
                                    </Paper>
                                ) : (
                                    <Button
                                        variant="outlined"
                                        startIcon={<Upload />}
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isProcessing}
                                        sx={{ borderStyle: 'dashed', py: 2, width: '100%' }}
                                    >
                                        Выбрать аудио или видео файл (до 500MB)
                                    </Button>
                                )}
                            </Box>
                        )}

                        {/* Опции */}
                        <Box
                            sx={{
                                display: 'flex',
                                gap: 2,
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                mb: 2,
                            }}
                        >
                            <FormControl size="small" sx={{ minWidth: 160 }}>
                                <InputLabel>Язык аудио</InputLabel>
                                <Select
                                    value={language}
                                    label="Язык аудио"
                                    onChange={(e) => setLanguage(e.target.value)}
                                    disabled={isProcessing}
                                >
                                    {transcriptionLanguages.map((lang) => (
                                        <MenuItem key={lang.code} value={lang.code}>
                                            {lang.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={enableDiarization}
                                        onChange={(e) => setEnableDiarization(e.target.checked)}
                                        disabled={isProcessing}
                                    />
                                }
                                label="Разделять спикеров"
                            />

                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={showTimestamps}
                                        onChange={(e) => setShowTimestamps(e.target.checked)}
                                    />
                                }
                                label="Показывать таймкоды"
                            />
                        </Box>
                    </>
                )}

                {error && (
                    <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
                        {error}
                    </Alert>
                )}

                {isProcessing && (
                    <Box sx={{ mb: 2 }}>
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                mb: 1,
                            }}
                        >
                            <Typography variant="body2" color="text.secondary">
                                {getStatusText()}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {progress}%
                            </Typography>
                        </Box>
                        <LinearProgress
                            variant={progress > 0 ? 'determinate' : 'indeterminate'}
                            value={progress}
                        />
                        <Box sx={{ mt: 1, textAlign: 'center' }}>
                            <Button size="small" color="inherit" onClick={handleCancel}>
                                Отменить
                            </Button>
                        </Box>
                    </Box>
                )}

                {result && (
                    <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <Typography variant="body2" color="text.secondary">
                                Результат:
                            </Typography>
                            <Chip
                                size="small"
                                label={
                                    transcriptionLanguages.find((l) => l.code === result.language)
                                        ?.name || result.language
                                }
                            />
                            <Chip
                                size="small"
                                label={`${formatTime(result.duration)}`}
                                variant="outlined"
                            />
                            <Chip
                                size="small"
                                label={`${result.segments.length} сегментов`}
                                variant="outlined"
                            />
                        </Box>

                        <Paper
                            variant="outlined"
                            sx={{
                                p: 2,
                                maxHeight: 300,
                                overflow: 'auto',
                                backgroundColor: '#fafafa',
                                fontFamily: 'monospace',
                                fontSize: '0.875rem',
                                whiteSpace: 'pre-wrap',
                            }}
                        >
                            {formatResult()}
                        </Paper>

                        <Box sx={{ mt: 1 }}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={showTimestamps}
                                        onChange={(e) => setShowTimestamps(e.target.checked)}
                                        size="small"
                                    />
                                }
                                label={<Typography variant="body2">Показывать таймкоды</Typography>}
                            />
                        </Box>
                    </Box>
                )}
            </DialogContent>

            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={handleClose} color="inherit">
                    Закрыть
                </Button>

                {!result && !isProcessing && (
                    <Button
                        variant="contained"
                        onClick={handleStart}
                        disabled={!canStart}
                        startIcon={<Mic />}
                    >
                        Начать транскрипцию
                    </Button>
                )}

                {result && (
                    <>
                        <Button
                            onClick={handleCopy}
                            startIcon={copied ? <Check /> : <ContentCopy />}
                        >
                            {copied ? 'Скопировано!' : 'Копировать'}
                        </Button>
                        <Button variant="contained" onClick={handleInsert}>
                            Вставить в редактор
                        </Button>
                    </>
                )}
            </DialogActions>
        </Dialog>
    )
}
