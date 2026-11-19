// A section of the draw: "1/4 финала", "Группа А". Set in the body font, as the labels of the
// tournament page are, not in the display font headings otherwise get.
export const label: React.CSSProperties = {
    fontFamily: 'var(--tw-font-body)',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: 'var(--tw-text-secondary)',
    paddingBottom: 8,
    borderBottom: '2px solid var(--tw-text)',
    margin: 0,
}

// Chips to choose from, as the sort of comments has them
export const chips: React.CSSProperties = {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
    flexWrap: 'wrap',
    margin: '0 0 16px',
}

export const chip = (chosen: boolean): React.CSSProperties => ({
    fontSize: 13,
    padding: '4px 12px',
    borderRadius: 14,
    border: `1px solid ${chosen ? 'var(--tw-primary)' : 'var(--tw-border)'}`,
    background: chosen ? 'var(--tw-tag)' : 'transparent',
    color: chosen ? 'var(--tw-primary)' : 'var(--tw-text)',
    cursor: chosen ? 'default' : 'pointer',
})

// One of a few, as a switch: the draws of a tournament, the real draw or the reader's own
export const segments: React.CSSProperties = {
    display: 'inline-flex',
    flexWrap: 'wrap',
    gap: 2,
    padding: 2,
    background: 'var(--tw-bg-alt)',
    borderRadius: 9,
    fontSize: 14,
}

export const segment = (chosen: boolean): React.CSSProperties => ({
    padding: '7px 16px',
    border: 'none',
    borderRadius: 7,
    background: chosen ? 'var(--tw-surface)' : 'transparent',
    boxShadow: chosen ? '0 1px 2px rgba(0, 0, 0, 0.12)' : 'none',
    color: chosen ? 'var(--tw-text)' : 'var(--tw-text-secondary)',
    fontWeight: chosen ? 600 : 400,
    cursor: chosen ? 'default' : 'pointer',
})
