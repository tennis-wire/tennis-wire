'use client'

import { useEffect, useRef, useState } from 'react'
import Cropper from 'react-easy-crop'

import Avatar from '@/components/Avatar'
import {
    ACCEPTED_TYPES,
    MIN_SIDE,
    outputSide,
    refuseCrop,
    refuseSource,
    uploadError,
    type Area,
} from '@/lib/avatar'

import { useReaderSession } from './ReaderSessionProvider'

const button: React.CSSProperties = {
    font: 'inherit',
    fontSize: 14,
    padding: '9px 18px',
    borderRadius: 7,
    border: '1px solid var(--tw-primary)',
    background: 'var(--tw-primary)',
    color: '#fff',
    cursor: 'pointer',
}

const quiet: React.CSSProperties = {
    ...button,
    background: 'transparent',
    color: 'var(--tw-text)',
    borderColor: 'var(--tw-border)',
}

const hint: React.CSSProperties = {
    fontSize: 13,
    color: 'var(--tw-text-muted)',
    margin: '8px 0 0',
}

// url for the cropper to show, bitmap for the canvas to cut from. The bitmap is upright whatever
// the EXIF says; the cropper's <img> is too, since browsers apply the orientation to images.
type Source = { url: string; bitmap: ImageBitmap }

export default function AvatarForm({
    displayName,
    avatarLargeUrl,
}: {
    displayName: string
    avatarLargeUrl: string | null
}) {
    const { session, setSession } = useReaderSession()
    const input = useRef<HTMLInputElement>(null)
    const [source, setSource] = useState<Source | null>(null)
    const [crop, setCrop] = useState({ x: 0, y: 0 })
    const [zoom, setZoom] = useState(1)
    const [area, setArea] = useState<Area | null>(null)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(
        () => () => {
            if (source) {
                URL.revokeObjectURL(source.url)
                source.bitmap.close()
            }
        },
        [source]
    )

    function show(avatarUrl: string | null, avatarLarge: string | null) {
        if (session?.authenticated)
            setSession({ ...session, avatarUrl, avatarLargeUrl: avatarLarge })
    }

    async function pick(file: File | undefined) {
        if (!file) return
        setError(null)
        const refused = refuseSource(file)
        if (refused) {
            setError(refused)
            return
        }
        let bitmap: ImageBitmap
        try {
            bitmap = await decode(file)
        } catch {
            setError(uploadError(422))
            return
        }
        if (Math.min(bitmap.width, bitmap.height) < MIN_SIDE) {
            bitmap.close()
            setError(`Нужно хотя бы ${MIN_SIDE} точек по каждой стороне`)
            return
        }
        setCrop({ x: 0, y: 0 })
        setZoom(1)
        setArea(null)
        setSource({ url: URL.createObjectURL(file), bitmap })
    }

    async function save() {
        if (!source || !area) return
        const refused = refuseCrop(area)
        if (refused) {
            setError(refused)
            return
        }
        setBusy(true)
        setError(null)
        try {
            const body = new FormData()
            body.append('file', await render(source.bitmap, area), 'avatar.jpg')
            const response = await fetch('/api/users/me/avatar', { method: 'POST', body })
            if (!response.ok) {
                setError(uploadError(response.status, await errorCode(response)))
                return
            }
            const profile = await response.json()
            show(profile.avatarUrl ?? null, profile.avatarLargeUrl ?? null)
            setSource(null)
        } catch {
            setError(uploadError(0))
        } finally {
            setBusy(false)
        }
    }

    async function remove() {
        setBusy(true)
        setError(null)
        try {
            const response = await fetch('/api/users/me/avatar', { method: 'DELETE' })
            if (!response.ok) {
                setError(uploadError(response.status, await errorCode(response)))
                return
            }
            show(null, null)
        } catch {
            setError(uploadError(0))
        } finally {
            setBusy(false)
        }
    }

    return (
        <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 14px' }}>Фото</h2>

            {source ? (
                <>
                    <div
                        style={{
                            position: 'relative',
                            width: '100%',
                            maxWidth: 320,
                            height: 320,
                            borderRadius: 10,
                            overflow: 'hidden',
                            background: 'var(--tw-bg-alt)',
                        }}
                    >
                        <Cropper
                            image={source.url}
                            crop={crop}
                            zoom={zoom}
                            maxZoom={4}
                            aspect={1}
                            cropShape="round"
                            showGrid={false}
                            onCropChange={setCrop}
                            onZoomChange={setZoom}
                            onCropComplete={(_, pixels) => setArea(pixels)}
                        />
                    </div>
                    <input
                        type="range"
                        min={1}
                        max={4}
                        step={0.01}
                        value={zoom}
                        onChange={(event) => setZoom(Number(event.target.value))}
                        aria-label="Масштаб"
                        style={{ width: '100%', maxWidth: 320, marginTop: 12 }}
                    />
                    <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                        <button
                            type="button"
                            onClick={save}
                            disabled={busy || !area}
                            style={button}
                        >
                            {busy ? 'Сохраняем…' : 'Сохранить'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setSource(null)}
                            disabled={busy}
                            style={quiet}
                        >
                            Отмена
                        </button>
                    </div>
                </>
            ) : (
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Avatar name={displayName} src={avatarLargeUrl} size={96} />
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <button
                            type="button"
                            onClick={() => input.current?.click()}
                            disabled={busy}
                            style={button}
                        >
                            {avatarLargeUrl ? 'Заменить' : 'Загрузить'}
                        </button>
                        {avatarLargeUrl && (
                            <button type="button" onClick={remove} disabled={busy} style={quiet}>
                                Удалить
                            </button>
                        )}
                    </div>
                    <input
                        ref={input}
                        type="file"
                        accept={ACCEPTED_TYPES.join(',')}
                        hidden
                        onChange={(event) => {
                            void pick(event.target.files?.[0])
                            // the same file picked again after a cancel must fire again
                            event.target.value = ''
                        }}
                    />
                </div>
            )}

            {error && (
                <p style={{ ...hint, color: 'var(--tw-live)' }} role="alert">
                    {error}
                </p>
            )}
            <p style={hint}>JPEG, PNG или WebP. Фото видно всем, кто видит ваши комментарии.</p>
        </section>
    )
}

async function decode(file: File): Promise<ImageBitmap> {
    try {
        return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
        // An older Safari knows only 'none' and 'flipY' and throws on the value
        return createImageBitmap(file)
    }
}

async function render(bitmap: ImageBitmap, area: Area): Promise<Blob> {
    const side = outputSide(area)
    const canvas = document.createElement('canvas')
    canvas.width = side
    canvas.height = side
    const context = canvas.getContext('2d')
    if (!context) throw new Error('no 2d context')
    // JPEG has no alpha: a transparent PNG would otherwise come out black
    context.fillStyle = '#fff'
    context.fillRect(0, 0, side, side)
    context.imageSmoothingQuality = 'high'
    context.drawImage(bitmap, area.x, area.y, area.width, area.height, 0, 0, side, side)
    return new Promise((resolve, reject) =>
        canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error('canvas gave no blob'))),
            'image/jpeg',
            0.92
        )
    )
}

async function errorCode(response: Response): Promise<string | undefined> {
    try {
        const body = await response.json()
        return body.error ?? body.code
    } catch {
        return undefined
    }
}
