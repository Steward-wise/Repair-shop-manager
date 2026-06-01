import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length < 2) return []

  // Parse headers — handle quoted headers
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/^"|"$/g, '').trim())

  return lines.slice(1).map((line) => {
    // Simple CSV parse (handles basic quoting)
    const values: string[] = []
    let current = ''
    let inQuote = false
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; continue }
      if (ch === ',' && !inQuote) { values.push(current.trim()); current = ''; continue }
      current += ch
    }
    values.push(current.trim())

    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = values[i] ?? '' })
    return row
  })
}

// Normalise header aliases so suppliers can use various column names
function normalise(row: Record<string, string>) {
  const get = (...keys: string[]) => keys.map((k) => row[k]).find((v) => v != null && v !== '') ?? ''
  return {
    part_name: get('part_name', 'name', 'part name', 'item name', 'item'),
    sku: get('sku', 'part number', 'part_number', 'code', 'ref'),
    supplier: get('supplier', 'vendor', 'brand'),
    supplier_email: get('supplier_email', 'supplier email', 'vendor_email', 'vendor email'),
    cost_price: get('cost_price', 'cost', 'buy price', 'cost price', 'purchase price'),
    sell_price: get('sell_price', 'sell', 'sell price', 'sale price', 'price'),
    quantity: get('quantity', 'qty', 'stock', 'stock qty'),
    reorder_threshold: get('reorder_threshold', 'reorder', 'min stock', 'minimum stock', 'reorder level'),
    description: get('description', 'notes', 'desc'),
  }
}

export async function POST(request: NextRequest) {
  const supabase = createAdminClient()

  let text = ''
  const contentType = request.headers.get('content-type') ?? ''

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    text = await file.text()
  } else {
    // Raw text body
    text = await request.text()
  }

  const rows = parseCSV(text)
  if (rows.length === 0) return NextResponse.json({ error: 'No valid rows found in CSV' }, { status: 400 })

  let imported = 0
  const errors: string[] = []

  for (const [i, rawRow] of rows.entries()) {
    const row = normalise(rawRow)

    if (!row.part_name) {
      errors.push(`Row ${i + 2}: missing part name`)
      continue
    }

    const record: Record<string, unknown> = {
      part_name: row.part_name,
      sku: row.sku || null,
      supplier: row.supplier || null,
      supplier_email: row.supplier_email || null,
      description: row.description || null,
      quantity: row.quantity ? parseInt(row.quantity, 10) || 0 : 0,
      reorder_threshold: row.reorder_threshold ? parseInt(row.reorder_threshold, 10) || 5 : 5,
      cost_price: row.cost_price ? parseFloat(row.cost_price) || null : null,
      sell_price: row.sell_price ? parseFloat(row.sell_price) || null : null,
    }

    // Upsert on sku if present, otherwise insert
    if (record.sku) {
      const { error } = await supabase
        .from('inventory')
        .upsert(record, { onConflict: 'sku', ignoreDuplicates: false })
      if (error) { errors.push(`Row ${i + 2}: ${error.message}`); continue }
    } else {
      const { error } = await supabase.from('inventory').insert(record)
      if (error) { errors.push(`Row ${i + 2}: ${error.message}`); continue }
    }

    imported++
  }

  return NextResponse.json({ imported, errors, total: rows.length })
}
