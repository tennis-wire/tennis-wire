import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Container, Typography, Box, Button, Paper } from '@mui/material'
import { Add } from '@mui/icons-material'

const CuratorPage: React.FC = () => {
    const navigate = useNavigate()

    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 3,
                }}
            >
                <Typography variant="h4" component="h1">
                    📋 Куратор материалов
                </Typography>

                <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/editor')}>
                    Создать новый
                </Button>
            </Box>

            <Paper
                sx={{
                    p: 4,
                    textAlign: 'center',
                    bgcolor: '#f5f5f5',
                }}
            >
                <Typography variant="h6" color="text.secondary">
                    🚧 Curator UI - в разработке
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Здесь будет список спарсенных материалов из агрегатора
                </Typography>
            </Paper>
        </Container>
    )
}

export default CuratorPage
