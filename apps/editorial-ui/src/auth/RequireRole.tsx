import type { ReactNode } from 'react'
import { Box, Stack, Typography } from '@mui/material'
import { useAuth } from 'react-oidc-context'

import RequireAuth from './RequireAuth'
import { hasRole } from './realmRoles'

// Hides a page from people it is not for. A convenience, not a guard: the token
// reaches the gateway and the service either way, and both decide for
// themselves. Everything behind this still has to handle a 403.
export default function RequireRole({ role, children }: { role: string; children: ReactNode }) {
    return (
        <RequireAuth>
            <RoleGate role={role}>{children}</RoleGate>
        </RequireAuth>
    )
}

function RoleGate({ role, children }: { role: string; children: ReactNode }) {
    const auth = useAuth()

    if (!hasRole(auth.user?.profile, role)) {
        return (
            <Box
                sx={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <Stack spacing={1} sx={{ alignItems: 'center' }}>
                    <Typography variant="h6">Раздел недоступен</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Он открыт только модераторам.
                    </Typography>
                </Stack>
            </Box>
        )
    }

    return <>{children}</>
}
