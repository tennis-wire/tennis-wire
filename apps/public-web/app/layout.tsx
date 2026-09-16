import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider, bootScript, themeCss } from '@/theme'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import ReaderSessionProvider from '@/components/auth/ReaderSessionProvider'

export const metadata: Metadata = {
    title: 'Tennis Wire',
    description: 'Теннисный новостной сервис',
}

// The boot script puts the look on <html> before hydration, and the server markup has no way of
// knowing it. The suppression covers this element only, one level deep: a mismatch anywhere
// inside the tree still shows up.
export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="ru" suppressHydrationWarning>
            <body>
                {/* Every look, and the line that picks one, both before the page is drawn */}
                <style dangerouslySetInnerHTML={{ __html: themeCss() }} />
                <script dangerouslySetInnerHTML={{ __html: bootScript() }} />
                <ThemeProvider>
                    <ReaderSessionProvider>
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
                    </ReaderSessionProvider>
                </ThemeProvider>
            </body>
        </html>
    )
}
