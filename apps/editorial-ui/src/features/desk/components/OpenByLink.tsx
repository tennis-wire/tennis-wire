import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Stack, TextField } from '@mui/material'

import { articlesApi, ContentApiError } from '../../editor/api/contentApi'
import { messageOf } from '../../editor/lib/apiMessages'
import { slugFromLink } from '../lib/slugFromLink'

// A published article is reached from the site: its address is all the caller needs.
// Who may edit it is the server's answer, not this form's.
export default function OpenByLink() {
    const navigate = useNavigate()
    const [link, setLink] = useState('')
    const [busy, setBusy] = useState(false)
    const [problem, setProblem] = useState<string | null>(null)

    async function open() {
        const slug = slugFromLink(link)
        if (slug === null) {
            setProblem('Не похоже на ссылку на материал')
            return
        }
        setBusy(true)
        setProblem(null)
        try {
            const article = await articlesApi.getBySlug(slug)
            void navigate(`/editor/${article.id}`)
        } catch (failure) {
            setProblem(
                failure instanceof ContentApiError && failure.status === 404
                    ? 'Материал по этой ссылке не найден'
                    : messageOf(failure)
            )
            setBusy(false)
        }
    }

    return (
        <Stack
            component="form"
            direction="row"
            spacing={1}
            sx={{ flex: 1, alignItems: 'flex-start' }}
            onSubmit={(event) => {
                event.preventDefault()
                void open()
            }}
        >
            <TextField
                size="small"
                fullWidth
                label="Открыть по ссылке"
                placeholder="https://…/news/…"
                value={link}
                onChange={(event) => {
                    setLink(event.target.value)
                    setProblem(null)
                }}
                error={problem !== null}
                helperText={problem ?? 'Адрес опубликованного материала со страницы на сайте'}
            />
            <Button type="submit" variant="outlined" disabled={busy || !link.trim()}>
                Открыть
            </Button>
        </Stack>
    )
}
