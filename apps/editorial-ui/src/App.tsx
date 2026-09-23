import { useMemo } from 'react'
import { ThemeProvider as MuiThemeProvider, CssBaseline } from '@mui/material'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'

import Editor from './features/editor/components/Editor.tsx'
import CuratorPage from './features/curator/CuratorPage.tsx'
import ModerationPage from './features/moderation/ModerationPage.tsx'
import AvatarQueuePage from './features/moderation/AvatarQueuePage.tsx'
import { ThemeProvider, useAppTheme, createAppTheme } from './theme'

import RequireAuth from './auth/RequireAuth.tsx'
import RequireRole from './auth/RequireRole.tsx'
import { MODERATOR } from './auth/realmRoles.ts'
import CallbackPage from './auth/CallbackPage.tsx'
import LoggedOutPage from './auth/LoggedOutPage.tsx'

// A data router, so that a page can ask before unsaved work is navigated away
// from: useBlocker works with nothing else
const router = createBrowserRouter([
    // Public: the guard must not run here or it would redirect away before the
    // code exchange finishes.
    { path: '/auth/callback', element: <CallbackPage /> },
    { path: '/logged-out', element: <LoggedOutPage /> },

    { path: '/', element: <Navigate to="/editor" replace /> },
    {
        path: '/curator',
        element: (
            <RequireAuth>
                <CuratorPage />
            </RequireAuth>
        ),
    },
    {
        path: '/moderation',
        element: (
            <RequireRole role={MODERATOR}>
                <ModerationPage />
            </RequireRole>
        ),
    },
    {
        path: '/moderation/avatars',
        element: (
            <RequireRole role={MODERATOR}>
                <AvatarQueuePage />
            </RequireRole>
        ),
    },
    {
        path: '/editor',
        element: (
            <RequireAuth>
                <Editor />
            </RequireAuth>
        ),
    },
    {
        path: '/editor/:aggregatorId',
        element: (
            <RequireAuth>
                <Editor />
            </RequireAuth>
        ),
    },
])

function AppRoutes() {
    const { colors, fontPair, isDark } = useAppTheme()

    const muiTheme = useMemo(
        () => createAppTheme(colors, fontPair, isDark),
        [colors, fontPair, isDark]
    )

    return (
        <MuiThemeProvider theme={muiTheme}>
            <CssBaseline />
            <RouterProvider router={router} />
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
