import { useState, useSyncExternalStore } from 'react'
import { Alert, Button, Snackbar } from '@mui/material'
import { useAuth } from 'react-oidc-context'

import { clearSessionExpired, isSessionExpired, subscribeToSessionExpiry } from './sessionExpiry'

/**
 * Offers a way back in without unloading the page. A redirect here would take
 * the AI chat, the transcription dialog and the unsaved article id with it; the
 * popup leaves the tab standing.
 */
export default function SessionExpiredBanner() {
    const auth = useAuth()
    const expired = useSyncExternalStore(subscribeToSessionExpiry, isSessionExpired)
    const [failed, setFailed] = useState(false)

    async function signInAgain() {
        try {
            await auth.signinPopup()
            clearSessionExpired()
            setFailed(false)
        } catch {
            // Popup blocked, or the person closed it. A redirect still works,
            // but it costs whatever is not in localStorage, so it is offered
            // rather than performed.
            setFailed(true)
        }
    }

    if (!expired) return null

    return (
        <Snackbar open anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
            <Alert
                severity="warning"
                action={
                    failed ? (
                        <Button
                            color="inherit"
                            size="small"
                            onClick={() => void auth.signinRedirect()}
                        >
                            Перезагрузить и войти
                        </Button>
                    ) : (
                        <Button color="inherit" size="small" onClick={() => void signInAgain()}>
                            Войти заново
                        </Button>
                    )
                }
            >
                {failed
                    ? 'Всплывающее окно заблокировано. Текст статьи сохранён, остальное будет потеряно.'
                    : 'Сессия истекла. Несохранённые изменения на месте, но отправить их не получится.'}
            </Alert>
        </Snackbar>
    )
}
