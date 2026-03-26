import { useState } from 'react'
import DiffViewer from 'react-diff-viewer-continued'
import { Box, Paper, Tabs, Tab, Alert, Snackbar, IconButton, Tooltip } from '@mui/material'
import { Psychology } from '@mui/icons-material'

import { Toolbar } from './Toolbar.tsx'
import { MetadataPanel } from './MetadataPanel.tsx'
import { AIChatPanel } from './AIChatPanel.tsx'
import { TranslateDialog } from './TranslateDialog.tsx'
import { TranscribeDialog } from './TranscribeDialog.tsx'
import { EditorContentArea } from './EditorContentArea.tsx'
import { EditorStatusBar } from './EditorStatusBar.tsx'

import { useEditorWithPersist } from '../hooks/useEditorWithPersist'
import { useImageDrop } from '../hooks/useImageDrop'
import { useEditorActions } from '../hooks/useEditorActions'
import { useSnackbar } from '../hooks/useSnackbar'
import { ThemeSwitcher, useAppTheme } from '../../../theme'

import '../styles/editor.css'

export default function Editor() {
    const [activeTab, setActiveTab] = useState(0)
    const [isAIPanelOpen, setIsAIPanelOpen] = useState(false)
    const [translateDialogOpen, setTranslateDialogOpen] = useState(false)
    const [transcribeDialogOpen, setTranscribeDialogOpen] = useState(false)
    const [articleId, setArticleId] = useState<string | null>(null)

    const { colors } = useAppTheme()
    const { snackbar, showSnackbar, hideSnackbar } = useSnackbar()

    const { editor, metadata, setMetadata, originalContent, setOriginalContent, clearPersisted } =
        useEditorWithPersist()

    const { isDragging, handleDragOver, handleDragLeave, handleDrop } = useImageDrop(
        editor,
        showSnackbar
    )

    const {
        handleSave,
        handlePublish,
        handleReset,
        handleClear,
        insertBelow,
        getSelectedText,
        isSaving,
        isPublishing,
    } = useEditorActions({
        editor,
        metadata,
        setMetadata,
        originalContent,
        setOriginalContent,
        clearPersisted,
        showSnackbar,
        articleId,
        setArticleId,
    })

    if (!editor) {
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
                Загрузка редактора...
            </Box>
        )
    }

    const wordCount = editor.getText().split(/\s+/).filter(Boolean).length
    const readingTime = Math.max(1, Math.ceil(wordCount / 200))
    const hasOriginal = Boolean(originalContent)

    return (
        <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: colors.bg }}>
            <Box
                sx={{
                    flex: 1,
                    maxWidth: isAIPanelOpen ? 'calc(100% - 380px)' : '100%',
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
                        <ThemeSwitcher />
                    </Box>

                    <MetadataPanel
                        metadata={metadata}
                        onChange={setMetadata}
                        readingTime={metadata.type === 'article' ? readingTime : undefined}
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
                            <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
                                <Tab label="Редактор" />
                                {hasOriginal && <Tab label="Оригинал" />}
                                {hasOriginal && <Tab label="Сравнение" />}
                            </Tabs>
                            <Tooltip
                                title={
                                    isAIPanelOpen ? 'Закрыть AI-помощника' : 'Открыть AI-помощника'
                                }
                            >
                                <IconButton
                                    onClick={() => setIsAIPanelOpen(!isAIPanelOpen)}
                                    sx={{
                                        mr: 1,
                                        color: isAIPanelOpen ? colors.primary : colors.textMuted,
                                        backgroundColor: isAIPanelOpen
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
                            {activeTab === 0 && (
                                <>
                                    <Toolbar
                                        editor={editor}
                                        onTranslateClick={() => setTranslateDialogOpen(true)}
                                        onTranscribeClick={() => setTranscribeDialogOpen(true)}
                                    />
                                    <EditorContentArea
                                        editor={editor}
                                        isDragging={isDragging}
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                    />
                                </>
                            )}

                            {hasOriginal && activeTab === 1 && originalContent && (
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

                            {hasOriginal && activeTab === 2 && originalContent && (
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
                            contentType={metadata.type}
                            wordCount={wordCount}
                            readingTime={readingTime}
                            hasOriginal={hasOriginal}
                            onReset={handleReset}
                            onClear={handleClear}
                            onSave={handleSave}
                            onPublish={handlePublish}
                            isSaving={isSaving}
                            isPublishing={isPublishing}
                        />
                    </Paper>
                </Box>
            </Box>

            <AIChatPanel
                editor={editor}
                isOpen={isAIPanelOpen}
                onClose={() => setIsAIPanelOpen(false)}
            />

            <TranslateDialog
                open={translateDialogOpen}
                onClose={() => setTranslateDialogOpen(false)}
                selectedText={getSelectedText()}
                fullText={editor.getText()}
                onInsert={insertBelow}
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
