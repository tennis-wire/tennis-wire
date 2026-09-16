export const muted: React.CSSProperties = {
    color: 'var(--tw-text-muted)',
    fontSize: 13,
}

export const linkButton: React.CSSProperties = {
    background: 'none',
    border: 'none',
    padding: 0,
    font: 'inherit',
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
