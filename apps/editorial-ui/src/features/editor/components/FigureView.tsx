import React, { useRef, useState } from 'react'
import { Box, Button, Popover, Stack } from '@mui/material'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'

import { CREDIT_KIND_LABELS } from '../constants/creditKinds'
import { captionAnswered, isCaptionAsked, type FigureAttrs } from '../extensions/Figure'
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
    const picture = useRef<HTMLImageElement>(null)
    // a picture just copied in opens its panel at once, see askCaption
    const [isOpen, setIsOpen] = useState(() => isCaptionAsked(editor, attrs.src))
    const [draft, setDraft] = useState<PictureText>(() => textOf(attrs))

    const open = () => {
        if (!editor.isEditable) return
        setDraft(textOf(attrs))
        setIsOpen(true)
    }

    const close = () => {
        setIsOpen(false)
        captionAnswered(editor, attrs.src)
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
            <img
                ref={picture}
                src={attrs.src}
                width={attrs.width ?? undefined}
                height={attrs.height ?? undefined}
                alt={attrs.alt ?? ''}
                onClick={open}
                data-drag-handle
            />
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
                open={isOpen}
                anchorEl={() => picture.current as HTMLElement}
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
