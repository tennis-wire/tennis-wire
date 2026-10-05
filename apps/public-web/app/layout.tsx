import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider, bootScript, themeCss } from '@/theme'
import { fontVariables } from '@/theme/faces'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import ReaderSessionProvider from '@/components/auth/ReaderSessionProvider'
import { SITE_NAME } from '@/lib/site'

export const metadata: Metadata = {
    title: SITE_NAME,
    description: 'Теннисный новостной сервис',
    // a large picture in Google Discover and image search; without it Google shows a thumbnail
    robots: { 'max-image-preview': 'large' },
    openGraph: { siteName: SITE_NAME, locale: 'ru_RU' },
}

// The boot script puts the look on <html> before hydration, and the server markup has no way of
// knowing it. The suppression covers this element only, one level deep: a mismatch anywhere
// inside the tree still shows up.
export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="ru" className={fontVariables} suppressHydrationWarning>
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
                                flex: 1,
                                width: '100%',
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
