'use client'

import { useState } from 'react'

// The reader's photo, or his initial where there is none. The initial also stands in for a photo
// that does not load: an author cache elsewhere can hand out a URL for a while after the object is
// gone. Neutral on purpose: a colour hashed from the id would have to hold its contrast against
// nine looks.
export default function Avatar({
    name,
    src,
    size = 32,
}: {
    name?: string | null
    src?: string | null
    size?: number
}) {
    const [broken, setBroken] = useState<string | null>(null)
    const initial = name?.trim().charAt(0).toUpperCase()
    const photo = src && src !== broken ? src : null

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
            {photo ? (
                // Already a square of the right size from user-service: nothing for next/image to do
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={photo}
                    alt=""
                    width={size}
                    height={size}
                    loading="lazy"
                    decoding="async"
                    onError={() => setBroken(photo)}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
            ) : (
                (initial ?? <Silhouette size={Math.round(size * 0.56)} />)
            )}
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
