import { useState } from 'react'
import { IconButton, Menu, MenuItem, ListItemIcon, ListItemText, Tooltip } from '@mui/material'
import { AccountCircle, Logout } from '@mui/icons-material'
import { useAuth } from 'react-oidc-context'

/** Who is signed in, and the way out. */
export default function UserMenu() {
    const auth = useAuth()
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

    const username =
        auth.user?.profile.preferred_username ?? auth.user?.profile.email ?? 'Неизвестно кто'

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
