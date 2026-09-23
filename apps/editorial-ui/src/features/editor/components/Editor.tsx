import { useState } from 'react'
import DiffViewer from 'react-diff-viewer-continued'
import { Box, Paper, Tabs, Tab, Alert, Snackbar, IconButton, Tooltip } from '@mui/material'
import { ArrowBack, Psychology } from '@mui/icons-material'
import { Link as RouterLink } from 'react-router-dom'
import { useAuth } from 'react-oidc-context'

import { Toolbar } from './Toolbar.tsx'
import { MetadataPanel } from './MetadataPanel.tsx'
import { AIChatPanel } from './AIChatPanel.tsx'
import { TranslateDialog } from './TranslateDialog.tsx'
import { TranscribeDialog } from './TranscribeDialog.tsx'
import { PollDialog } from './PollDialog.tsx'
import { EditorContentArea } from './EditorContentArea.tsx'
import { EditorStatusBar } from './EditorStatusBar.tsx'

import { useArticleSession, type Mode } from '../hooks/useArticleSession'
import { useImageDrop } from '../hooks/useImageDrop'
import { useEditorActions } from '../hooks/useEditorActions'
import { useLeaveGuard } from '../hooks/useLeaveGuard'
import { useSnackbar } from '../hooks/useSnackbar'
import { dayOf, timeOf } from '../lib/dates'
import type { EditorialArticle } from '../types/content'
import { ThemeSwitcher, useAppTheme } from '../../../theme'
import UserMenu from '../../../auth/UserMenu.tsx'
import { CHIEF_EDITOR, hasRole } from '../../../auth/realmRoles'

import '../styles/editor.css'

type TabKey = 'editor' | 'original' | 'diff' | 'live'

interface Props {
    // null for an article that has not been saved yet
    articleId: string | null
    sessionKey: string
    sub: string
}

function statusOf(mode: Mode, article: EditorialArticle | null, dirty: boolean): string {
    const unsaved = dirty ? ' · есть несохранённые изменения' : ''
    if (article === null) return 'Новый материал · не сохранён'
    if (mode === 'locked') return `Сейчас правит ${article.lockedBy} · только чтение`
    if (article.status === 'draft') {
        const kind = article.firstPublishedAt ? 'Снят с публикации' : 'Черновик'
        return `${kind} · сохранён ${timeOf(article.updatedAt)}${unsaved}`
    }
    const onSite = article.publishedAt ? `На сайте с ${dayOf(article.publishedAt)}` : 'На сайте'
    const edit = article.live ? ` · правка от ${timeOf(article.updatedAt)} ещё не на сайте` : ''
    return `${onSite}${edit}${unsaved}`
}

// One block per line, so the diff shows which paragraph changed rather than one long line
function linesOf(title: string, html: string): string {
    return `${title}\n\n${html.replace(/></g, '>\n<')}`
}

function Screen({ children }: { children: string }) {
    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                color: 'var(--tw-text-muted)',
                fontFamily: 'var(--tw-font-body)',
            }}
        >
            {children}
        </Box>
    )
}

export default function Editor({ articleId, sessionKey, sub }: Props) {
    const [activeTab, setActiveTab] = useState<TabKey>('editor')
    const [isAIPanelOpen, setIsAIPanelOpen] = useState(false)
    const [translateDialogOpen, setTranslateDialogOpen] = useState(false)
    const [translateSession, setTranslateSession] = useState(0)
    const [transcribeDialogOpen, setTranscribeDialogOpen] = useState(false)
    const [pollDialogOpen, setPollDialogOpen] = useState(false)
    // The source text of a parsed item; nothing sets it until parsing arrives
    const [originalContent] = useState<string | undefined>(undefined)

    const { colors } = useAppTheme()
    const auth = useAuth()
    const { snackbar, showSnackbar, hideSnackbar } = useSnackbar()

    const session = useArticleSession({ articleId, sessionKey, sub, showSnackbar })
    const { editor, article, mode, metadata, setMetadata, content, dirty } = session

    useLeaveGuard({
        dirtyRef: session.dirtyRef,
        leavingRef: session.leavingRef,
        onLeave: session.forgetUnsaved,
    })

    const { isDragging, handleDragOver, handleDragLeave, handleDrop } = useImageDrop(
        editor,
        showSnackbar
    )

    const { handleReset, insertBelow, getSelectedText } = useEditorActions({
        editor,
        originalContent,
        showSnackbar,
    })

    if (session.loadState === 'missing') return <Screen>Материал не найден</Screen>
    if (session.loadState === 'forbidden') {
        return <Screen>Этот материал может править только его автор или главный редактор</Screen>
    }
    if (session.loadState === 'failed') return <Screen>Не удалось загрузить материал</Screen>
    if (!editor || session.loadState === 'loading') return <Screen>Загрузка редактора...</Screen>

    const wordCount = editor.getText().split(/\s+/).filter(Boolean).length
    const readingTime = Math.max(1, Math.ceil(wordCount / 200))
    const hasOriginal = Boolean(originalContent)
    const live = article?.live ?? null
    const readOnly = mode === 'locked'
    // it writes into the text, which is not the caller's to change while locked
    const aiOpen = isAIPanelOpen && !readOnly
    const tab: TabKey =
        (activeTab === 'live' && live === null) ||
        ((activeTab === 'original' || activeTab === 'diff') && !hasOriginal)
            ? 'editor'
            : activeTab

    return (
        <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: colors.bg }}>
            <Box
                sx={{
                    flex: 1,
                    maxWidth: aiOpen ? 'calc(100% - 380px)' : '100%',
                    transition: 'max-width 0.3s ease',
                }}
            >
                <Box sx={{ maxWidth: 1200, margin: '0 auto', padding: { xs: 1, md: 3 } }}>
                    {/* Top bar with logo + theme switcher */}
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            mb: 2.5,
                        }}
                    >
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1.5,
                            }}
                        >
                            <Tooltip title="В редакцию">
                                <IconButton
                                    component={RouterLink}
                                    to="/desk"
                                    size="small"
                                    aria-label="В редакцию"
                                >
                                    <ArrowBack fontSize="small" />
                                </IconButton>
                            </Tooltip>
                            <Box
                                component="span"
                                sx={{
                                    fontFamily: 'var(--tw-font-display)',
                                    fontSize: '1.4rem',
                                    fontWeight: 700,
                                    color: colors.primary,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1,
                                }}
                            >
                                <>
                                    <Box
                                        component="img"
                                        src="/logo.svg"
                                        alt=""
                                        sx={{
                                            height: 26,
                                            width: 26,
                                            objectFit: 'contain',
                                        }}
                                    />
                                    Tennis Wire
                                </>
                            </Box>
                            <Box
                                component="span"
                                sx={{
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    color: colors.textMuted,
                                    backgroundColor: colors.tag,
                                    px: 1,
                                    py: 0.3,
                                    borderRadius: '5px',
                                    textTransform: 'uppercase',
                                    letterSpacing: 0.5,
                                }}
                            >
                                Editor
                            </Box>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <ThemeSwitcher />
                            <UserMenu />
                        </Box>
                    </Box>

                    <MetadataPanel
                        metadata={metadata}
                        onChange={setMetadata}
                        onError={(message) => showSnackbar(message, 'error')}
                        readingTime={metadata.type === 'article' ? readingTime : undefined}
                        frozen={article?.firstPublishedAt != null}
                        readOnly={readOnly}
                    />

                    <Paper
                        elevation={0}
                        sx={{
                            mb: 2,
                            borderRadius: '14px',
                            overflow: 'hidden',
                            border: `1px solid ${colors.border}`,
                            backgroundColor: colors.surface,
                            boxShadow: colors.cardShadow,
                        }}
                    >
                        {/* Tabs + AI toggle */}
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                borderBottom: `1px solid ${colors.border}`,
                                backgroundColor: colors.surface,
                            }}
                        >
                            <Tabs value={tab} onChange={(_, v: TabKey) => setActiveTab(v)}>
                                <Tab value="editor" label="Редактор" />
                                {live && <Tab value="live" label="Сравнение с сайтом" />}
                                {hasOriginal && <Tab value="original" label="Оригинал" />}
                                {hasOriginal && <Tab value="diff" label="Сравнение" />}
                            </Tabs>
                            <Tooltip
                                title={aiOpen ? 'Закрыть AI-помощника' : 'Открыть AI-помощника'}
                            >
                                <IconButton
                                    onClick={() => setIsAIPanelOpen(!aiOpen)}
                                    sx={{
                                        mr: 1,
                                        color: aiOpen ? colors.primary : colors.textMuted,
                                        backgroundColor: aiOpen
                                            ? `${colors.primary}14`
                                            : 'transparent',
                                        '&:hover': {
                                            backgroundColor: `${colors.primary}1A`,
                                        },
                                    }}
                                >
                                    <Psychology />
                                </IconButton>
                            </Tooltip>
                        </Box>

                        {/* Tab content */}
                        <Box sx={{ p: 2 }}>
                            {tab === 'editor' && (
                                <>
                                    {!readOnly && (
                                        <Toolbar
                                            editor={editor}
                                            onError={(message) => showSnackbar(message, 'error')}
                                            onTranslateClick={() => {
                                                setTranslateSession((s) => s + 1)
                                                setTranslateDialogOpen(true)
                                            }}
                                            onPollClick={() => setPollDialogOpen(true)}
                                            onTranscribeClick={() => setTranscribeDialogOpen(true)}
                                        />
                                    )}
                                    <EditorContentArea
                                        editor={editor}
                                        isDragging={isDragging}
                                        onDragOver={readOnly ? () => {} : handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={readOnly ? () => {} : handleDrop}
                                    />
                                </>
                            )}

                            {tab === 'live' && live && (
                                <Box
                                    sx={{
                                        border: `1px solid ${colors.border}`,
                                        borderRadius: '10px',
                                        minHeight: 400,
                                        maxHeight: 500,
                                        overflow: 'auto',
                                    }}
                                >
                                    <DiffViewer
                                        oldValue={linesOf(live.title, live.content ?? '')}
                                        newValue={linesOf(metadata.title, content)}
                                        splitView={true}
                                        leftTitle="На сайте"
                                        rightTitle="Правка"
                                        showDiffOnly={false}
                                    />
                                </Box>
                            )}

                            {tab === 'original' && originalContent && (
                                <Box
                                    sx={{
                                        p: 3,
                                        border: `1px solid ${colors.border}`,
                                        borderRadius: '10px',
                                        minHeight: 400,
                                        backgroundColor: colors.bgAlt,
                                    }}
                                >
                                    <div dangerouslySetInnerHTML={{ __html: originalContent }} />
                                </Box>
                            )}

                            {tab === 'diff' && originalContent && (
                                <Box
                                    sx={{
                                        border: `1px solid ${colors.border}`,
                                        borderRadius: '10px',
                                        minHeight: 400,
                                        maxHeight: 500,
                                        overflow: 'auto',
                                    }}
                                >
                                    <DiffViewer
                                        oldValue={originalContent}
                                        newValue={editor.getHTML()}
                                        splitView={true}
                                        leftTitle="Оригинал"
                                        rightTitle="Редакция"
                                        hideLineNumbers={false}
                                        showDiffOnly={false}
                                    />
                                </Box>
                            )}
                        </Box>

                        <EditorStatusBar
                            mode={mode}
                            status={statusOf(mode, article, dirty)}
                            contentType={metadata.type}
                            wordCount={wordCount}
                            readingTime={readingTime}
                            hasOriginal={hasOriginal}
                            hasEdit={live !== null}
                            dirty={dirty}
                            canDelete={mode === 'draft' && !article?.firstPublishedAt}
                            canReset={hasRole(auth.user?.profile, CHIEF_EDITOR)}
                            busy={session.busy}
                            onReset={handleReset}
                            onClear={session.clearNew}
                            onDelete={() => void session.remove()}
                            onDiscardEdit={() => void session.discardEdit()}
                            onSave={() => void session.save()}
                            onPublish={() => void session.publish()}
                        />
                    </Paper>
                </Box>
            </Box>

            <AIChatPanel editor={editor} isOpen={aiOpen} onClose={() => setIsAIPanelOpen(false)} />

            <TranslateDialog
                key={translateSession}
                open={translateDialogOpen}
                onClose={() => setTranslateDialogOpen(false)}
                selectedText={getSelectedText()}
                fullText={editor.getText()}
                onInsert={insertBelow}
            />
            <PollDialog
                open={pollDialogOpen}
                onClose={() => setPollDialogOpen(false)}
                onInsert={(poll) =>
                    editor
                        ?.chain()
                        .focus()
                        .setPoll({
                            pollId: poll.id,
                            question: poll.question,
                            options: poll.options.map((o) => o.text),
                        })
                        .run()
                }
            />
            <TranscribeDialog
                open={transcribeDialogOpen}
                onClose={() => setTranscribeDialogOpen(false)}
                onInsert={insertBelow}
            />

            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={hideSnackbar}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert severity={snackbar.severity} onClose={hideSnackbar} variant="filled">
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    )
}
