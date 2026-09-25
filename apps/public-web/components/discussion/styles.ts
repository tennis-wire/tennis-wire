export const muted: React.CSSProperties = {
    color: 'var(--tw-text-muted)',
    fontSize: 13,
}

export const linkButton: React.CSSProperties = {
    background: 'none',
    border: 'none',
    padding: 0,
    fontSize: 13,
    color: 'var(--tw-primary)',
    cursor: 'pointer',
}

// Under a comment: reply, show the thread, retry. Quiet, because the comment is the thing to
// read. Except for the one that opens a thread, which is the reader's way further in.
export const action: React.CSSProperties = {
    ...linkButton,
    color: 'var(--tw-text-secondary)',
    fontWeight: 500,
}

// The way in, wherever the reader is asked to sign in first
export const signInLink: React.CSSProperties = {
    color: 'var(--tw-primary)',
    fontWeight: 600,
}

// Nobody to draw: a placeholder is not signed, and the invitation to sign in has no one yet
export const blankFace: React.CSSProperties = {
    width: 36,
    height: 36,
    flexShrink: 0,
    borderRadius: '50%',
    border: '1px dashed var(--tw-border)',
}
