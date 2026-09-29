import React, { useState } from 'react'
import { Box, Button, Popover, Stack } from '@mui/material'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'

import { CREDIT_KIND_LABELS } from '../constants/creditKinds'
import type { FigureAttrs } from '../extensions/Figure'
import { CaptionFields, type PictureText } from './CaptionFields'

function textOf(attrs: FigureAttrs): PictureText {
    return {
        alt: attrs.alt ?? '',
        caption: attrs.caption ?? '',
        credit: attrs.credit ?? '',
        creditKind: attrs.creditKind,
    }
}

function blankToNull(value: string): string | null {
    const trimmed = value.trim()
    return trimmed ? trimmed : null
}

// A picture as the editor shows it: the caption under it as on the site, and a panel with its
// text on a click. The panel keeps its own copy and writes it into the article once, on close,
// so a caption typed letter by letter is one step to undo, not forty.
export const FigureView: React.FC<NodeViewProps> = ({ node, editor, updateAttributes }) => {
    const attrs = node.attrs as FigureAttrs
    const [anchor, setAnchor] = useState<HTMLElement | null>(null)
    const [draft, setDraft] = useState<PictureText>(() => textOf(attrs))

    const open = (event: React.MouseEvent<HTMLElement>) => {
        if (!editor.isEditable) return
        setDraft(textOf(attrs))
        setAnchor(event.currentTarget)
    }

    const close = () => {
        setAnchor(null)
        const next = {
            alt: blankToNull(draft.alt),
            caption: blankToNull(draft.caption),
            credit: blankToNull(draft.credit),
            creditKind: draft.creditKind,
        }
        const changed = (Object.keys(next) as (keyof typeof next)[]).some(
            (key) => next[key] !== attrs[key]
        )
        if (changed) updateAttributes(next)
    }

    return (
        <NodeViewWrapper as="figure" className="figure-view">
            <img src={attrs.src} alt={attrs.alt ?? ''} onClick={open} data-drag-handle />
            {(attrs.caption || attrs.credit) && (
                <figcaption>
                    {attrs.caption && <span data-caption="">{attrs.caption}</span>}
                    {attrs.credit && (
                        <span data-credit={attrs.creditKind}>
                            {CREDIT_KIND_LABELS[attrs.creditKind]}: {attrs.credit}
                        </span>
                    )}
                </figcaption>
            )}
            <Popover
                open={anchor !== null}
                anchorEl={anchor}
                onClose={close}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                transformOrigin={{ vertical: 'top', horizontal: 'center' }}
            >
                <Stack spacing={2} sx={{ p: 2, width: 420, maxWidth: '100vw' }}>
                    <CaptionFields
                        value={draft}
                        onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
                        autoFocus
                    />
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Button variant="contained" size="small" onClick={close}>
                            Готово
                        </Button>
                    </Box>
                </Stack>
            </Popover>
        </NodeViewWrapper>
    )
}
