import { useContext } from 'react'
import { ThemeContext, type ThemeContextValue } from './themeDefinition'

export function useAppTheme(): ThemeContextValue {
    const ctx = useContext(ThemeContext)
    if (!ctx) throw new Error('useAppTheme must be used within ThemeProvider')
    return ctx
}
