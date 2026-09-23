import { useMemo } from 'react'
import { ThemeProvider as MuiThemeProvider, CssBaseline } from '@mui/material'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'

import EditorRoute from './features/editor/components/EditorRoute.tsx'
import CuratorPage from './features/curator/CuratorPage.tsx'
import ModerationPage from './features/moderation/ModerationPage.tsx'
import AvatarQueuePage from './features/moderation/AvatarQueuePage.tsx'
import { ThemeProvider, useAppTheme, createAppTheme } from './theme'

import RequireAuth from './auth/RequireAuth.tsx'
import RequireRole from './auth/RequireRole.tsx'
import { AUTHOR, MODERATOR } from './auth/realmRoles.ts'
import CallbackPage from './auth/CallbackPage.tsx'
import LoggedOutPage from './auth/LoggedOutPage.tsx'

// A data router: the editor asks before unsaved work is navigated away from, and
// useBlocker works with nothing else
const router = createBrowserRouter([
    // Public: the guard must not run here or it would redirect away before the
    // code exchange finishes.
    { path: '/auth/callback', element: <CallbackPage /> },
    { path: '/logged-out', element: <LoggedOutPage /> },

    { path: '/', element: <Navigate to="/editor/new" replace /> },
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
    { path: '/editor', element: <Navigate to="/editor/new" replace /> },
    {
        // "new" or an article id
        path: '/editor/:id',
        element: (
            <RequireRole role={AUTHOR}>
                <EditorRoute />
            </RequireRole>
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
