import { Container, Paper, Stack, Typography } from '@mui/material'

import UserMenu from '../../auth/UserMenu'
import DeskNav from './DeskNav'

// Where parsed items will wait for someone to take them into the editor
export default function SourcesPage() {
    return (
        <Container maxWidth="md" sx={{ py: 4 }}>
            <Stack
                direction="row"
                sx={{ mb: 2, alignItems: 'center', justifyContent: 'space-between' }}
            >
                <Typography variant="h4" component="h1">
                    Редакция
                </Typography>
                <UserMenu />
            </Stack>
            <DeskNav />

            <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="h6" color="text.secondary">
                    Здесь будет лента материалов из источников
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Парсинг ещё не подключён
                </Typography>
            </Paper>
        </Container>
    )
}
