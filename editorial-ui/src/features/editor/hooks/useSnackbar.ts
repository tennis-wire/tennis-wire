import { useState, useCallback } from 'react'

type Severity = 'success' | 'error' | 'warning' | 'info'

export interface SnackbarState {
    open: boolean
    message: string
    severity: Severity
}

export function useSnackbar() {
    const [snackbar, setSnackbar] = useState<SnackbarState>({
        open: false,
        message: '',
        severity: 'success',
    })

    const showSnackbar = useCallback((message: string, severity: Severity) => {
        setSnackbar({ open: true, message, severity })
    }, [])

    const hideSnackbar = useCallback(() => {
        setSnackbar((prev) => ({ ...prev, open: false }))
    }, [])

    return { snackbar, showSnackbar, hideSnackbar }
}
