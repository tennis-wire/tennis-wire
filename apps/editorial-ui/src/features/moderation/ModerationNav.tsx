import { Tab, Tabs } from '@mui/material'
import { Link, useLocation } from 'react-router-dom'

// Two queues of their own: complaints about comments, and avatars nobody has looked at yet
export default function ModerationNav() {
    const { pathname } = useLocation()

    return (
        <Tabs value={pathname === '/moderation/avatars' ? 1 : 0} sx={{ mb: 3 }}>
            <Tab label="Жалобы" component={Link} to="/moderation" />
            <Tab label="Аватары" component={Link} to="/moderation/avatars" />
        </Tabs>
    )
}
