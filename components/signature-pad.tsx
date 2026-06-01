'use client'

import { useRef, useState } from 'react'
import SignatureCanvas from 'react-signature-canvas'

interface SignaturePadProps {
  onSave: (dataUrl: string) => void
  disabled?: boolean
}

export default function SignaturePad({ onSave, disabled }: SignaturePadProps) {
  const padRef = useRef<SignatureCanvas>(null)
  const [isEmpty, setIsEmpty] = useState(true)

  function handleEnd() {
    setIsEmpty(padRef.current?.isEmpty() ?? true)
  }

  function handleClear() {
    padRef.current?.clear()
    setIsEmpty(true)
  }

  function handleSave() {
    if (!padRef.current || padRef.current.isEmpty()) return
    const dataUrl = padRef.current.getTrimmedCanvas().toDataURL('image/png')
    onSave(dataUrl)
  }

  return (
    <div className="space-y-3">
      <div className="border-2 border-border rounded-xl overflow-hidden bg-white">
        <SignatureCanvas
          ref={padRef}
          onEnd={handleEnd}
          penColor="#09090b"
          canvasProps={{
            className: 'w-full',
            style: { height: '200px', touchAction: 'none' },
          }}
        />
      </div>
      <p className="text-xs text-muted text-center">Sign above using your finger or stylus</p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleClear}
          disabled={disabled || isEmpty}
          className="btn-secondary flex-1 text-sm"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={disabled || isEmpty}
          className="btn-primary flex-1 text-sm"
        >
          Confirm signature
        </button>
      </div>
    </div>
  )
}
