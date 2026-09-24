import { redirect } from 'next/navigation'

// Not a page of its own: a link to the settings lands on the first tab under them
export default function SettingsIndex() {
    redirect('/me/settings/appearance')
}
