'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'

interface PhotoUploadProps {
  label?: string
  onUploaded: (url: string) => void
  jobId?: string
  photoType?: string
  accept?: string
}

export default function PhotoUpload({
  label = 'Upload photo',
  onUploaded,
  jobId,
  photoType = 'intake',
  accept = 'image/*',
}: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setError(null)
    setUploading(true)

    const previewUrl = URL.createObjectURL(file)
    setPreview(previewUrl)

    const formData = new FormData()
    formData.append('file', file)
    if (jobId) formData.append('jobId', jobId)
    formData.append('photoType', photoType)

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')
      onUploaded(data.url)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Upload failed'
      setError(msg)
      setPreview(null)
    } finally {
      setUploading(false)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div>
      {label && <span className="label">{label}</span>}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="relative border-2 border-dashed border-border rounded-xl overflow-hidden cursor-pointer hover:border-primary transition-colors"
        style={{ minHeight: '120px' }}
        onClick={() => inputRef.current?.click()}
      >
        {preview ? (
          <div className="relative w-full h-48">
            <Image src={preview} alt="Preview" fill className="object-cover" />
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
              <span className="text-white text-sm font-medium">Change photo</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-8 px-4">
            {uploading ? (
              <>
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-muted">Uploading…</span>
              </>
            ) : (
              <>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
                  <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
                  <circle cx="12" cy="13" r="3"/>
                </svg>
                <span className="text-xs text-muted text-center">
                  Tap to take photo or upload<br />
                  <span className="text-primary">or drag & drop</span>
                </span>
              </>
            )}
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={handleChange}
        />
      </div>
      {error && <p className="text-xs text-primary mt-1">{error}</p>}
    </div>
  )
}
