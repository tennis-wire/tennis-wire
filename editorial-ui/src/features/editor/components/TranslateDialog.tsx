import React, { useState } from 'react'
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Box,
    Typography,
    CircularProgress,
    IconButton,
    Tooltip,
    Paper,
    Divider,
    Alert,
    TextField,
} from '@mui/material'
import { ContentCopy, Check, Close, SwapHoriz } from '@mui/icons-material'

import { translate } from '../api/translateApi'
import { sourceLanguages, targetLanguages } from '../constants/languages'

interface Props {
    open: boolean
    onClose: () => void
    selectedText: string
    fullText: string
    onInsert: (text: string) => void
}

export const TranslateDialog: React.FC<Props> = ({
    open,
    onClose,
    selectedText,
    fullText,
    onInsert,
}) => {
    const [sourceLang, setSourceLang] = useState('')
    const [targetLang, setTargetLang] = useState('RU')
    const [isLoading, setIsLoading] = useState(false)
    const [result, setResult] = useState('')
    const [detectedLang, setDetectedLang] = useState('')
    const [error, setError] = useState('')
    const [copied, setCopied] = useState(false)
    const [customText, setCustomText] = useState('')

    const hasSelection = selectedText.trim().length > 0

    const handleSwapLanguages = () => {
        const newSourceCode = sourceLang || detectedLang || 'EN'

        let newTargetFromSource = newSourceCode
        if (newSourceCode === 'EN') newTargetFromSource = 'EN-US'

        let newSource = targetLang
        if (targetLang.startsWith('EN-')) newSource = 'EN'
        else if (targetLang.startsWith('PT-')) newSource = 'PT'
        else if (targetLang.startsWith('ZH-')) newSource = 'ZH'

        setSourceLang(newSource)
        setTargetLang(newTargetFromSource)
        setResult('')
        setDetectedLang('')
    }

    const handleTranslate = async () => {
        if (!customText.trim()) return

        setIsLoading(true)
        setResult('')
        setError('')
        setDetectedLang('')

        try {
            const data = await translate(customText, sourceLang || null, targetLang)
            setResult(data.text)
            setDetectedLang(data.detectedSourceLanguage || '')
        } catch (err) {
            console.error('Translation error:', err)
            setError(err instanceof Error ? err.message : 'Ошибка перевода')
        } finally {
            setIsLoading(false)
        }
    }

    const handleCopy = () => {
        navigator.clipboard.writeText(result)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const handleInsert = () => {
        onInsert(result)
        onClose()
    }

    const handleClose = () => {
        setResult('')
        setError('')
        setDetectedLang('')
        setCopied(false)
        setCustomText('')
        onClose()
    }

    React.useEffect(() => {
        if (open) {
            if (hasSelection) setCustomText(selectedText)
            setResult('')
            setError('')
            setDetectedLang('')
        }
    }, [open, hasSelection, selectedText])

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle
                sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>🌐 Перевод</Box>
                <IconButton size="small" onClick={handleClose}>
                    <Close fontSize="small" />
                </IconButton>
            </DialogTitle>

            <DialogContent>
                {/* Текст для перевода */}
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
                            Текст для перевода:
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                            {hasSelection && (
                                <Button
                                    size="small"
                                    variant="text"
                                    onClick={() => setCustomText(selectedText)}
                                    sx={{ fontSize: '0.75rem', minWidth: 0 }}
                                >
                                    Вставить выделенное
                                </Button>
                            )}
                            {fullText && (
                                <Button
                                    size="small"
                                    variant="text"
                                    onClick={() => setCustomText(fullText)}
                                    sx={{ fontSize: '0.75rem', minWidth: 0 }}
                                >
                                    Вставить всё
                                </Button>
                            )}
                        </Box>
                    </Box>
                    <TextField
                        fullWidth
                        multiline
                        rows={4}
                        placeholder="Введите или вставьте текст для перевода..."
                        value={customText}
                        onChange={(e) => {
                            setCustomText(e.target.value)
                            setResult('')
                        }}
                    />
                    <Typography variant="caption" color="text.secondary">
                        {customText.split(/\s+/).filter(Boolean).length} слов
                    </Typography>
                </Box>

                {/* Выбор языков */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <FormControl size="small" sx={{ minWidth: 160 }}>
                        <InputLabel>Исходный</InputLabel>
                        <Select
                            value={sourceLang}
                            label="Исходный"
                            onChange={(e) => {
                                setSourceLang(e.target.value)
                                setResult('')
                                setDetectedLang('')
                            }}
                        >
                            {sourceLanguages.map((lang) => (
                                <MenuItem key={lang.code} value={lang.code}>
                                    {lang.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <Tooltip title="Поменять местами">
                        <IconButton
                            onClick={handleSwapLanguages}
                            size="small"
                            disabled={!sourceLang && !detectedLang}
                        >
                            <SwapHoriz />
                        </IconButton>
                    </Tooltip>

                    <FormControl size="small" sx={{ minWidth: 160 }}>
                        <InputLabel>Целевой</InputLabel>
                        <Select
                            value={targetLang}
                            label="Целевой"
                            onChange={(e) => {
                                setTargetLang(e.target.value)
                                setResult('')
                            }}
                        >
                            {targetLanguages.map((lang) => (
                                <MenuItem key={lang.code} value={lang.code}>
                                    {lang.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <Button
                        variant="contained"
                        onClick={handleTranslate}
                        disabled={isLoading || !customText.trim() || !targetLang}
                        sx={{ ml: 'auto' }}
                    >
                        {isLoading ? <CircularProgress size={20} /> : 'Перевести'}
                    </Button>
                </Box>

                {detectedLang && (
                    <Typography variant="caption" color="primary" sx={{ mb: 1, display: 'block' }}>
                        Определён язык:{' '}
                        {sourceLanguages.find((l) => l.code === detectedLang)?.name || detectedLang}
                    </Typography>
                )}

                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                <Divider sx={{ my: 2 }} />

                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    Перевод:
                </Typography>
                <Paper
                    variant="outlined"
                    sx={{
                        p: 1.5,
                        minHeight: 100,
                        maxHeight: 200,
                        overflow: 'auto',
                        backgroundColor: result ? '#fff' : '#f5f5f5',
                    }}
                >
                    {isLoading ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CircularProgress size={16} />
                            <Typography variant="body2" color="text.secondary">
                                Переводим...
                            </Typography>
                        </Box>
                    ) : result ? (
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                            {result}
                        </Typography>
                    ) : (
                        <Typography variant="body2" color="text.secondary">
                            Нажмите "Перевести" для получения результата
                        </Typography>
                    )}
                </Paper>
            </DialogContent>

            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={handleClose} color="inherit">
                    Закрыть
                </Button>
                <Button
                    onClick={handleCopy}
                    disabled={!result}
                    startIcon={copied ? <Check /> : <ContentCopy />}
                >
                    {copied ? 'Скопировано!' : 'Копировать'}
                </Button>
                <Button onClick={handleInsert} disabled={!result} variant="contained">
                    Вставить в редактор
                </Button>
            </DialogActions>
        </Dialog>
    )
}
