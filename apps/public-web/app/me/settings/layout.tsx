// The look and the ignore list: the two tabs of the cabinet that sit under /me/settings. They share
// the padding and nothing else.
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
    return <div style={{ padding: '24px 28px 32px', minWidth: 0 }}>{children}</div>
}
