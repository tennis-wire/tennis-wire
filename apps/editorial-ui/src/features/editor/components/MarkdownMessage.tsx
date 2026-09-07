import React from 'react'
import { Box } from '@mui/material'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useAppTheme } from '../../../theme'

interface Props {
    content: string
}

/**
 * Renders an assistant message as real DOM rather than one text node.
 *
 * That is what makes a partial mouse selection paste into the editor with its
 * formatting intact: for rendered markup the browser puts a text/html flavour
 * on the clipboard and ProseMirror prefers it over text/plain. A pre-wrap text
 * node offers nothing for that flavour to carry.
 */
export const MarkdownMessage: React.FC<Props> = ({ content }) => {
    const { colors } = useAppTheme()

    return (
        <Box
            sx={{
                fontSize: '0.875rem',
                color: colors.text,
                lineHeight: 1.6,
                // The bubble's own padding provides the gap, so the outermost
                // blocks must not add margins of their own on top of it.
                '& > *:first-of-type': { mt: 0 },
                '& > *:last-child': { mb: 0 },
                '& p': { m: 0, mb: 1.5 },
                '& h1, & h2, & h3, & h4': {
                    fontFamily: 'var(--tw-font-display)',
                    fontSize: '1rem',
                    fontWeight: 700,
                    mt: 2,
                    mb: 1,
                },
                '& ul, & ol': { pl: 2.5, mt: 0, mb: 1.5 },
                '& li': { mb: 0.5 },
                '& li > p': { mb: 0 },
                '& strong': { fontWeight: 700 },
                '& a': { color: colors.primary },
                '& blockquote': {
                    m: 0,
                    mb: 1.5,
                    pl: 1.5,
                    borderLeft: `3px solid ${colors.border}`,
                    color: colors.textMuted,
                },
                '& code': {
                    fontFamily: 'monospace',
                    fontSize: '0.8125rem',
                    backgroundColor: colors.bgAlt,
                    px: 0.5,
                    borderRadius: '4px',
                },
                '& pre': {
                    m: 0,
                    mb: 1.5,
                    p: 1,
                    overflow: 'auto',
                    backgroundColor: colors.bgAlt,
                    borderRadius: '8px',
                },
                '& pre code': { backgroundColor: 'transparent', px: 0 },
                '& table': { borderCollapse: 'collapse', mb: 1.5 },
                '& th, & td': {
                    border: `1px solid ${colors.border}`,
                    px: 1,
                    py: 0.5,
                    textAlign: 'left',
                },
            }}
        >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </Box>
    )
}
