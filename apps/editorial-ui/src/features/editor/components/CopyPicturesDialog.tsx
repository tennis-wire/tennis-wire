import React from 'react'
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
} from '@mui/material'

interface Props {
    // how many pictures from elsewhere the pasted text holds; the dialog is shown while set
    count: number | null
    // copy them, paste without them, or cancel the paste (null)
    onAnswer: (copy: boolean | null) => void
}

function pictures(count: number): string {
    const last = count % 10
    const teen = count % 100 >= 11 && count % 100 <= 14
    if (last === 1 && !teen) return `${count} картинка`
    if (last >= 2 && last <= 4 && !teen) return `${count} картинки`
    return `${count} картинок`
}

// Asked when pasted or dropped text brings pictures from another site. The site shows pictures
// from our storage alone, so they either come in as copies or stay out.
export const CopyPicturesDialog: React.FC<Props> = ({ count, onAnswer }) => (
    <Dialog open={count !== null} onClose={() => onAnswer(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Картинки с другого сайта</DialogTitle>
        <DialogContent>
            <DialogContentText>
                В тексте {count !== null && pictures(count)} с другого сайта. Сайт показывает только
                картинки из нашего хранилища: их можно скопировать туда. У каждой потом нужно
                указать автора.
            </DialogContentText>
        </DialogContent>
        <DialogActions>
            <Button onClick={() => onAnswer(false)}>Вставить без картинок</Button>
            <Button variant="contained" onClick={() => onAnswer(true)}>
                Скопировать
            </Button>
        </DialogActions>
    </Dialog>
)
