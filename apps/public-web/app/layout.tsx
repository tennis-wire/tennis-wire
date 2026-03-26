import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/theme'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
    title: 'Tennis Wire',
    description: 'Теннисный новостной сервис',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="ru">
            <body>
                <ThemeProvider>
                    <Header />
                    <main
                        style={{
                            maxWidth: 1200,
                            margin: '0 auto',
                            padding: '24px 20px',
                            minHeight: 'calc(100vh - 180px)',
                        }}
                    >
                        {children}
                    </main>
                    <Footer />
                </ThemeProvider>
            </body>
        </html>
    )
}
