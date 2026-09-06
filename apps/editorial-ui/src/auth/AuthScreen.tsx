import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material'
import { useAuth } from 'react-oidc-context'

interface Props {
    message: string
    showRetry?: boolean
}

/** Full-page placeholder for the moments when the app has no session yet. */
export default function AuthScreen({ message, showRetry = false }: Props) {
    const auth = useAuth()

    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <Stack spacing={2} sx={{ alignItems: 'center' }}>
                {!showRetry && <CircularProgress size={28} />}
                <Typography variant="body1">{message}</Typography>
                {showRetry && (
                    <Button variant="contained" onClick={() => void auth.signinRedirect()}>
                        Войти
                    </Button>
                )}
            </Stack>
        </Box>
    )
}
