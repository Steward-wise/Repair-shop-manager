'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import toast, { Toaster } from 'react-hot-toast'

interface ParsedRow {
  part_name: string
  sku: string
  supplier: string
  cost_price: string
  sell_price: string
  quantity: string
  reorder_threshold: string
}

function parseCSVPreview(text: string): ParsedRow[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ''))
  return lines.slice(1, 21).map((line) => { // preview first 20 rows
    const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''))
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = values[i] ?? '' })
    const get = (...keys: string[]) => keys.map((k) => row[k]).find((v) => v) ?? ''
    return {
      part_name: get('part_name', 'name', 'part name', 'item name', 'item'),
      sku: get('sku', 'part number', 'code', 'ref'),
      supplier: get('supplier', 'vendor', 'brand'),
      cost_price: get('cost_price', 'cost', 'buy price', 'purchase price'),
      sell_price: get('sell_price', 'sell', 'sell price', 'price'),
      quantity: get('quantity', 'qty', 'stock'),
      reorder_threshold: get('reorder_threshold', 'reorder', 'min stock'),
    }
  })
}

export default function InventoryImportPage() {
  const [csvText, setCsvText] = useState('')
  const [preview, setPreview] = useState<ParsedRow[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ imported: number; errors: string[]; total: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setCsvText(text)
      setPreview(parseCSVPreview(text))
      setResult(null)
    }
    reader.readAsText(file)
  }

  async function handleImport() {
    if (!csvText) return
    setImporting(true)
    setResult(null)
    try {
      const res = await fetch('/api/inventory/import', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: csvText,
      })
      const data = await res.json()
      setResult(data)
      if (data.imported > 0) toast.success(`Imported ${data.imported} item${data.imported !== 1 ? 's' : ''}`)
      if (data.errors?.length > 0) toast.error(`${data.errors.length} row(s) had errors`)
    } catch {
      toast.error('Import failed')
    } finally {
      setImporting(false)
    }
  }

  return (
    <>
      <Toaster position="top-center" toastOptions={{ style: { background: '#18181b', color: '#fafafa', border: '1px solid #3f3f46' } }} />

      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center gap-3">
          <Link href="/inventory" className="text-muted hover:text-fg transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-fg">Import Inventory</h1>
            <p className="text-muted text-sm mt-0.5">Upload a CSV to bulk-import parts and stock</p>
          </div>
        </div>

        {/* Instructions */}
        <div className="card space-y-3">
          <h2 className="font-semibold text-fg">CSV Format</h2>
          <p className="text-sm text-muted">
            The first row must be a header. Accepted column names (case-insensitive):
          </p>
          <div className="bg-surface-2 rounded-lg p-3 font-mono text-xs text-muted overflow-x-auto">
            part_name, sku, supplier, supplier_email, cost_price, sell_price, quantity, reorder_threshold, description
          </div>
          <p className="text-xs text-muted">
            Aliases accepted: <em>name, item, part number, code, vendor, cost, buy price, sell, price, qty, stock, min stock, reorder, notes</em>
            <br />
            Rows with a matching SKU will be updated (upsert). Rows without SKU will always insert.
          </p>
          <a
            href="data:text/csv;charset=utf-8,part_name,sku,supplier,supplier_email,cost_price,sell_price,quantity,reorder_threshold%0AiPhone%2015%20Screen,SCR-IP15,iFixit,orders@ifixit.com,45.00,89.99,10,3"
            download="inventory-template.csv"
            className="text-primary text-xs hover:underline"
          >
            Download template CSV
          </a>
        </div>

        {/* File upload */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-fg">Upload File</h2>
          <div
            className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
            <svg className="mx-auto text-muted mb-3" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>
            </svg>
            {csvText ? (
              <p className="text-sm text-fg font-medium">{preview.length} rows ready to import</p>
            ) : (
              <p className="text-sm text-muted">Click to choose a CSV file</p>
            )}
          </div>
        </div>

        {/* Preview table */}
        {preview.length > 0 && (
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-fg">Preview ({preview.length} rows)</h2>
              <button
                onClick={handleImport}
                disabled={importing}
                className="btn-primary text-sm"
              >
                {importing ? 'Importing…' : `Import ${preview.length} rows`}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {['Part Name', 'SKU', 'Supplier', 'Cost', 'Sell', 'Qty', 'Reorder'].map((h) => (
                      <th key={h} className="text-left text-xs text-muted font-medium py-2 pr-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-surface-2">
                      <td className="py-2 pr-4 text-fg font-medium">{row.part_name || <span className="text-red-400">missing</span>}</td>
                      <td className="py-2 pr-4 text-muted font-mono text-xs">{row.sku || '—'}</td>
                      <td className="py-2 pr-4 text-muted">{row.supplier || '—'}</td>
                      <td className="py-2 pr-4 text-muted">{row.cost_price ? `£${row.cost_price}` : '—'}</td>
                      <td className="py-2 pr-4 text-muted">{row.sell_price ? `£${row.sell_price}` : '—'}</td>
                      <td className="py-2 pr-4 text-fg">{row.quantity || '0'}</td>
                      <td className="py-2 pr-4 text-muted">{row.reorder_threshold || '5'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className={`card space-y-2 ${result.errors.length > 0 ? 'border-yellow-700' : 'border-green-700'}`}>
            <h2 className="font-semibold text-fg">Import Result</h2>
            <p className="text-sm text-fg">
              ✓ <strong>{result.imported}</strong> of {result.total} rows imported successfully
            </p>
            {result.errors.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-red-400 font-medium">{result.errors.length} error(s):</p>
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs text-muted">{e}</p>
                ))}
              </div>
            )}
            <Link href="/inventory" className="text-primary text-sm hover:underline">
              View inventory →
            </Link>
          </div>
        )}
      </div>
    </>
  )
}
