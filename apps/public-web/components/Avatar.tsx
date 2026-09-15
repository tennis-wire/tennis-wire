// Stands in for a photo. Avatars are not in v1 — readers.md §1.4 keeps `avatarUrl` null and has
// the clients draw an initial — so this is what an author looks like everywhere. Neutral on
// purpose: a colour hashed from the id would have to hold its contrast against nine looks.
export default function Avatar({ name, size = 32 }: { name?: string | null; size?: number }) {
    const initial = name?.trim().charAt(0).toUpperCase()

    return (
        <span
            aria-hidden
            style={{
                width: size,
                height: size,
                flexShrink: 0,
                borderRadius: '50%',
                background: 'var(--tw-tag)',
                border: '1px solid var(--tw-border)',
                color: 'var(--tw-text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--tw-font-body)',
                fontSize: Math.round(size * 0.44),
                fontWeight: 600,
                lineHeight: 1,
                overflow: 'hidden',
            }}
        >
            {initial ?? <Silhouette size={Math.round(size * 0.56)} />}
        </span>
    )
}

function Silhouette({ size }: { size: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z" />
        </svg>
    )
}
