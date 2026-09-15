import { redirect } from 'next/navigation'

// Settings is the tab, not a page of its own: the first section is what it opens
export default function SettingsIndex() {
    redirect('/me/settings/appearance')
}
