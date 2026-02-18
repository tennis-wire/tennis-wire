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

import '../styles/editor.css'

export default function Editor() {
    const [activeTab, setActiveTab] = useState(0)
    const [isAIPanelOpen, setIsAIPanelOpen] = useState(false)
    const [translateDialogOpen, setTranslateDialogOpen] = useState(false)
    const [transcribeDialogOpen, setTranscribeDialogOpen] = useState(false)

    const { snackbar, showSnackbar, hideSnackbar } = useSnackbar()

    const { editor, metadata, setMetadata, originalContent, setOriginalContent, clearPersisted } =
        useEditorWithPersist()

    const { isDragging, handleDragOver, handleDragLeave, handleDrop } = useImageDrop(
        editor,
        showSnackbar
    )

    const { handleSave, handlePublish, handleReset, handleClear, insertBelow, getSelectedText } =
        useEditorActions({
            editor,
            metadata,
            setMetadata,
            originalContent,
            setOriginalContent,
            clearPersisted,
            showSnackbar,
        })

    if (!editor) {
        return <div>Загрузка редактора...</div>
    }

    const wordCount = editor.getText().split(/\s+/).filter(Boolean).length
    const readingTime = Math.max(1, Math.ceil(wordCount / 200))
    const hasOriginal = Boolean(originalContent)

    return (
        <Box sx={{ display: 'flex', minHeight: '100vh' }}>
            <Box
                sx={{
                    flex: 1,
                    maxWidth: isAIPanelOpen ? 'calc(100% - 380px)' : '100%',
                    transition: 'max-width 0.3s ease',
                }}
            >
                <Box sx={{ maxWidth: 1200, margin: '0 auto', padding: { xs: 1, md: 3 } }}>
                    <MetadataPanel
                        metadata={metadata}
                        onChange={setMetadata}
                        readingTime={metadata.type === 'article' ? readingTime : undefined}
                    />

                    <Paper sx={{ mb: 2, borderRadius: 2, overflow: 'hidden' }}>
                        {/* Tabs + AI toggle */}
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                borderBottom: 1,
                                borderColor: 'divider',
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
                                    color={isAIPanelOpen ? 'primary' : 'default'}
                                    sx={{ mr: 1 }}
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
                                        border: '1px solid #e0e0e0',
                                        borderRadius: 1,
                                        minHeight: 400,
                                        backgroundColor: '#f9f9f9',
                                    }}
                                >
                                    <div dangerouslySetInnerHTML={{ __html: originalContent }} />
                                </Box>
                            )}

                            {hasOriginal && activeTab === 2 && originalContent && (
                                <Box
                                    sx={{
                                        border: '1px solid #e0e0e0',
                                        borderRadius: 1,
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
