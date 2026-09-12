import { useState } from 'react'
import { IconButton, Menu, MenuItem, ListItemIcon, ListItemText, Tooltip } from '@mui/material'
import { AccountCircle, Gavel, Logout } from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { useAuth } from 'react-oidc-context'

import { hasRole, MODERATOR } from './realmRoles'

// Who is signed in, and the way out
export default function UserMenu() {
    const auth = useAuth()
    const navigate = useNavigate()
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

    const username =
        auth.user?.profile.preferred_username ?? auth.user?.profile.email ?? 'Неизвестно кто'
    // Hiding the entry, not the page: RequireRole and the server both decide again
    const moderates = hasRole(auth.user?.profile, MODERATOR)

    return (
        <>
            <Tooltip title={username}>
                <IconButton size="small" onClick={(e) => setAnchorEl(e.currentTarget)}>
                    <AccountCircle fontSize="small" />
                </IconButton>
            </Tooltip>
            <Menu anchorEl={anchorEl} open={anchorEl !== null} onClose={() => setAnchorEl(null)}>
                <MenuItem disabled>
                    <ListItemText primary={username} />
                </MenuItem>
                {moderates && (
                    <MenuItem
                        onClick={() => {
                            setAnchorEl(null)
                            void navigate('/moderation')
                        }}
                    >
                        <ListItemIcon>
                            <Gavel fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary="Модерация" />
                    </MenuItem>
                )}
                <MenuItem onClick={() => void auth.signoutRedirect()}>
                    <ListItemIcon>
                        <Logout fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary="Выйти" />
                </MenuItem>
            </Menu>
        </>
    )
}
