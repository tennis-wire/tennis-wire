import React, { useState } from 'react'
import {
    Alert,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    TextField,
} from '@mui/material'

import { importImage, pictureOf, uploadErrorMessage, type StoredPicture } from '../api/mediaApi'

interface Props {
    open: boolean
    onClose: () => void
    // the copy in our storage, to put in the text
    onInsert: (picture: StoredPicture) => void
}

// A picture by its link: the server copies it into our storage, and the text gets the copy.
// Remounted on every open (key in Editor.tsx), so nothing from the last time stays in it.
export const ImageLinkDialog: React.FC<Props> = ({ open, onClose, onInsert }) => {
    const [link, setLink] = useState('')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const submit = async (event: React.FormEvent) => {
        event.preventDefault()
        if (!link.trim() || busy) return
        setBusy(true)
        setError(null)
        try {
            onInsert(pictureOf(await importImage(link.trim())))
            onClose()
        } catch (failure) {
            setError(uploadErrorMessage(failure))
        } finally {
            setBusy(false)
        }
    }

    return (
        <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
            <form onSubmit={submit}>
                <DialogTitle>Картинка по ссылке</DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ mb: 2 }}>
                        Картинка скопируется в наше хранилище: если на том сайте она пропадёт, в
                        статье останется. После вставки укажите автора.
                    </DialogContentText>
                    <TextField
                        label="Ссылка на картинку"
                        placeholder="https://…"
                        value={link}
                        onChange={(e) => setLink(e.target.value)}
                        fullWidth
                        autoFocus
                        disabled={busy}
                        slotProps={{ htmlInput: { maxLength: 2000 } }}
                    />
                    {error && (
                        <Alert severity="error" sx={{ mt: 2 }}>
                            {error}
                        </Alert>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose} disabled={busy}>
                        Отмена
                    </Button>
                    <Button
                        type="submit"
                        variant="contained"
                        disabled={busy || !link.trim()}
                        startIcon={busy ? <CircularProgress size={16} /> : undefined}
                    >
                        {busy ? 'Копируем' : 'Вставить'}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    )
}
