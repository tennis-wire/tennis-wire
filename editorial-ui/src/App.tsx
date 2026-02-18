import Editor from './features/editor/components/Editor.tsx'
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import CuratorPage from './features/curator/CuratorPage.tsx'

const theme = createTheme({
    palette: {
        mode: 'light', // for future
    },
})

function App() {
    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<Navigate to="/editor" replace />} />
                    <Route path="/curator" element={<CuratorPage />} />
                    <Route path="/editor" element={<Editor />} />
                    <Route path="/editor/:aggregatorId" element={<Editor />} />
                </Routes>
            </BrowserRouter>
        </ThemeProvider>
    )
}

export default App
