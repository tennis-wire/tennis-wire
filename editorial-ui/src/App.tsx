import { useMemo } from 'react'
import { ThemeProvider as MuiThemeProvider, CssBaseline } from '@mui/material'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

import Editor from './features/editor/components/Editor.tsx'
import CuratorPage from './features/curator/CuratorPage.tsx'
import { ThemeProvider, useAppTheme, createAppTheme } from './theme'

function AppRoutes() {
    const { colors, fontPair, isDark } = useAppTheme()

    const muiTheme = useMemo(
        () => createAppTheme(colors, fontPair, isDark),
        [colors, fontPair, isDark]
    )

    return (
        <MuiThemeProvider theme={muiTheme}>
            <CssBaseline />
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<Navigate to="/editor" replace />} />
                    <Route path="/curator" element={<CuratorPage />} />
                    <Route path="/editor" element={<Editor />} />
                    <Route path="/editor/:aggregatorId" element={<Editor />} />
                </Routes>
            </BrowserRouter>
        </MuiThemeProvider>
    )
}

function App() {
    return (
        <ThemeProvider>
            <AppRoutes />
        </ThemeProvider>
    )
}

export default App
