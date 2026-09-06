import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from 'react-oidc-context'
import './index.css'
import App from './App.tsx'
import { userManager, onSigninCallback } from './auth/userManager.ts'

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <AuthProvider userManager={userManager} onSigninCallback={onSigninCallback}>
            <App />
        </AuthProvider>
    </StrictMode>
)
