import { Tab, Tabs } from '@mui/material'
import { Link, useLocation } from 'react-router-dom'

// The caller's own work, and what arrives from the sources for someone to pick up
export default function DeskNav() {
    const { pathname } = useLocation()

    return (
        <Tabs value={pathname === '/desk/sources' ? 1 : 0} sx={{ mb: 3 }}>
            <Tab label="Мои материалы" component={Link} to="/desk" />
            <Tab label="Источники" component={Link} to="/desk/sources" />
        </Tabs>
    )
}
