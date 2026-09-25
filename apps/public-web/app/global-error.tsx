'use client'

// Replaces the root layout when the layout itself fails, so neither the theme nor the fonts are
// here: plain colours that follow the system, and a plain link home past a router that may be
// what broke
const css = `
body { margin: 0; font: 16px/1.5 system-ui, sans-serif; background: #f7f5f0; color: #1a1a1a; }
main { max-width: 560px; margin: 0 auto; padding: 64px 20px; }
h1 { font: 700 30px/1.2 Georgia, serif; margin: 0 0 12px; }
p { color: #555; margin: 0 0 22px; }
button { font: inherit; font-size: 14px; padding: 9px 18px; border-radius: 7px; cursor: pointer;
    border: 1px solid #1b6b3a; background: #1b6b3a; color: #fff; }
a { color: #1b6b3a; font-weight: 600; margin-left: 20px; }
small { display: block; margin-top: 28px; font-size: 12px; color: #888; }
@media (prefers-color-scheme: dark) {
    body { background: #111; color: #eee; }
    p { color: #aaa; }
    a { color: #3da65e; }
}
`

export default function GlobalError({
    error,
    retry,
}: {
    error: Error & { digest?: string }
    retry: () => void
}) {
    return (
        <html lang="ru">
            <body>
                <title>Не удалось загрузить страницу — Tennis Wire</title>
                <style dangerouslySetInnerHTML={{ __html: css }} />
                <main>
                    <h1>Не удалось загрузить страницу</h1>
                    <p>
                        Похоже, что-то сломалось на нашей стороне. Попробуйте ещё раз через минуту.
                    </p>
                    <button type="button" onClick={retry}>
                        Попробовать ещё раз
                    </button>
                    {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                    <a href="/">На главную</a>
                    {error.digest && <small>Код ошибки: {error.digest}</small>}
                </main>
            </body>
        </html>
    )
}
