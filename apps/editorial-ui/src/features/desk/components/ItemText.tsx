import { Box, Link } from '@mui/material'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// The text of a foreign article, markdown as the collector extracted it. Raw HTML in it is
// dropped, never rendered; pictures too, since each would be fetched from the foreign site
// with the reader's address. Links open in a new tab and say nothing of where they came from
export default function ItemText({ markdown }: { markdown: string }) {
    return (
        <Box
            sx={{
                lineHeight: 1.6,
                '& > *:first-of-type': { mt: 0 },
                '& > *:last-child': { mb: 0 },
                '& p': { m: 0, mb: 1.5 },
                '& h1, & h2, & h3, & h4, & h5, & h6': {
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    mt: 2.5,
                    mb: 1,
                },
                '& ul, & ol': { pl: 3, mt: 0, mb: 1.5 },
                '& blockquote': {
                    m: 0,
                    mb: 1.5,
                    pl: 2,
                    borderLeft: 3,
                    borderColor: 'divider',
                    color: 'text.secondary',
                },
                '& table': { borderCollapse: 'collapse', mb: 1.5 },
                '& td, & th': { border: 1, borderColor: 'divider', px: 1, py: 0.5 },
            }}
        >
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                skipHtml
                disallowedElements={['img']}
                components={{
                    a: ({ href, children }) => (
                        <Link href={href} target="_blank" rel="noopener noreferrer">
                            {children}
                        </Link>
                    ),
                }}
            >
                {markdown}
            </ReactMarkdown>
        </Box>
    )
}
