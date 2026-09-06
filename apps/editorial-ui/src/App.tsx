import { useMemo } from 'react'
import { ThemeProvider as MuiThemeProvider, CssBaseline } from '@mui/material'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

import Editor from './features/editor/components/Editor.tsx'
import CuratorPage from './features/curator/CuratorPage.tsx'
import { ThemeProvider, useAppTheme, createAppTheme } from './theme'

import RequireAuth from './auth/RequireAuth.tsx'
import CallbackPage from './auth/CallbackPage.tsx'
import LoggedOutPage from './auth/LoggedOutPage.tsx'

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
                    {/* Public: the guard must not run here or it would redirect
                        away before the code exchange finishes. */}
                    <Route path="/auth/callback" element={<CallbackPage />} />
                    <Route path="/logged-out" element={<LoggedOutPage />} />

                    <Route path="/" element={<Navigate to="/editor" replace />} />
                    <Route
                        path="/curator"
                        element={
                            <RequireAuth>
                                <CuratorPage />
                            </RequireAuth>
                        }
                    />
                    <Route
                        path="/editor"
                        element={
                            <RequireAuth>
                                <Editor />
                            </RequireAuth>
                        }
                    />
                    <Route
                        path="/editor/:aggregatorId"
                        element={
                            <RequireAuth>
                                <Editor />
                            </RequireAuth>
                        }
                    />
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
