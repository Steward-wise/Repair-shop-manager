'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import toast, { Toaster } from 'react-hot-toast'
import { formatCurrency } from '@/lib/utils'
import type { InventoryItem } from '@/types'

interface CartItem {
  inventory_id: string | null
  part_name: string
  sku: string | null
  quantity: number
  unit_price: number
  total: number
}

const PAYMENT_METHODS = ['Cash', 'Card', 'Bank Transfer', 'Other']

export default function POSSalePage() {
  const router = useRouter()
  const searchRef = useRef<HTMLInputElement>(null)

  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [discount, setDiscount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('Cash')
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [createdBy, setCreatedBy] = useState('')
  const [completing, setCompleting] = useState(false)

  // Custom item state
  const [showCustom, setShowCustom] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customPrice, setCustomPrice] = useState('')
  const [customQty, setCustomQty] = useState('1')

  useEffect(() => {
    fetch('/api/inventory')
      .then((r) => r.json())
      .then((d) => setInventory(d.items ?? []))
    searchRef.current?.focus()
  }, [])

  const filteredInventory = inventory.filter((item) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      item.part_name.toLowerCase().includes(q) ||
      (item.sku ?? '').toLowerCase().includes(q)
    )
  }).slice(0, 40)

  function addToCart(item: InventoryItem) {
    const price = item.sell_price ?? 0
    setCart((prev) => {
      const existing = prev.find((c) => c.inventory_id === item.id)
      if (existing) {
        return prev.map((c) =>
          c.inventory_id === item.id
            ? { ...c, quantity: c.quantity + 1, total: (c.quantity + 1) * c.unit_price }
            : c
        )
      }
      return [...prev, { inventory_id: item.id, part_name: item.part_name, sku: item.sku ?? null, quantity: 1, unit_price: price, total: price }]
    })
    setSearch('')
    searchRef.current?.focus()
  }

  function addCustomItem() {
    const price = parseFloat(customPrice) || 0
    const qty = parseInt(customQty) || 1
    if (!customName.trim() || price <= 0) { toast.error('Enter a name and price'); return }
    setCart((prev) => [...prev, { inventory_id: null, part_name: customName.trim(), sku: null, quantity: qty, unit_price: price, total: qty * price }])
    setCustomName(''); setCustomPrice(''); setCustomQty('1'); setShowCustom(false)
    searchRef.current?.focus()
  }

  function updateQty(idx: number, qty: number) {
    if (qty <= 0) { removeFromCart(idx); return }
    setCart((prev) => prev.map((c, i) => i === idx ? { ...c, quantity: qty, total: qty * c.unit_price } : c))
  }

  function removeFromCart(idx: number) {
    setCart((prev) => prev.filter((_, i) => i !== idx))
  }

  const subtotal = cart.reduce((sum, c) => sum + c.total, 0)
  const discountAmt = parseFloat(discount) || 0
  const total = Math.max(0, subtotal - discountAmt)

  async function completeSale() {
    if (cart.length === 0) { toast.error('Cart is empty'); return }
    setCompleting(true)
    try {
      const res = await fetch('/api/pos/sale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart,
          subtotal,
          discount: discountAmt,
          total,
          payment_method: paymentMethod,
          customer_name: customerName.trim() || null,
          customer_email: customerEmail.trim() || null,
          created_by: createdBy.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to complete sale')
      toast.success('Sale complete!')
      router.push(`/pos/receipt/${data.sale.id}`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong')
      setCompleting(false)
    }
  }

  return (
    <>
      <Toaster position="top-center" toastOptions={{ style: { background: '#18181b', color: '#fafafa', border: '1px solid #3f3f46' } }} />

      <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-80px)] max-h-[calc(100vh-80px)]">

        {/* LEFT — Product browser */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => router.back()} className="text-muted hover:text-fg shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <input
              ref={searchRef}
              type="search"
              className="input flex-1"
              placeholder="Search products by name or SKU…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoComplete="off"
            />
            <button
              onClick={() => setShowCustom(!showCustom)}
              className="btn-secondary text-sm shrink-0 flex items-center gap-2"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
              Custom
            </button>
          </div>

          {/* Custom item row */}
          {showCustom && (
            <div className="card flex gap-2 items-end mb-3 flex-wrap">
              <div className="flex-1 min-w-[140px]">
                <label className="label text-xs">Item name *</label>
                <input type="text" className="input text-sm" placeholder="e.g. Phone case" value={customName} onChange={(e) => setCustomName(e.target.value)} />
              </div>
              <div className="w-28">
                <label className="label text-xs">Price (£) *</label>
                <input type="number" className="input text-sm" placeholder="9.99" min="0" step="0.01" value={customPrice} onChange={(e) => setCustomPrice(e.target.value)} />
              </div>
              <div className="w-20">
                <label className="label text-xs">Qty</label>
                <input type="number" className="input text-sm" min="1" value={customQty} onChange={(e) => setCustomQty(e.target.value)} />
              </div>
              <button onClick={addCustomItem} className="btn-primary text-sm px-4">Add</button>
              <button onClick={() => setShowCustom(false)} className="btn-secondary text-sm px-3">✕</button>
            </div>
          )}

          {/* Product grid */}
          <div className="overflow-y-auto flex-1">
            {filteredInventory.length === 0 ? (
              <div className="text-center py-16 text-muted text-sm">
                {search ? `No products matching "${search}"` : 'No inventory items found'}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                {filteredInventory.map((item) => {
                  const outOfStock = item.quantity <= 0
                  return (
                    <button
                      key={item.id}
                      onClick={() => !outOfStock && addToCart(item)}
                      disabled={outOfStock}
                      className={`text-left p-3 rounded-xl border transition-all active:scale-95 ${
                        outOfStock
                          ? 'border-border bg-surface-2 opacity-40 cursor-not-allowed'
                          : 'border-border bg-surface-2 hover:border-primary hover:bg-primary-muted cursor-pointer'
                      }`}
                    >
                      <p className="text-sm font-medium text-fg leading-tight line-clamp-2">{item.part_name}</p>
                      {item.sku && <p className="text-xs text-muted font-mono mt-0.5">{item.sku}</p>}
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-base font-bold text-primary">
                          {item.sell_price != null ? `£${item.sell_price.toFixed(2)}` : '—'}
                        </p>
                        <p className={`text-xs ${item.quantity <= 2 ? 'text-orange-400' : 'text-muted'}`}>
                          {outOfStock ? 'Out of stock' : `${item.quantity} left`}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — Cart */}
        <div className="w-full lg:w-96 flex flex-col gap-3 shrink-0">
          <div className="card flex-1 flex flex-col min-h-0 overflow-hidden">
            <h2 className="font-semibold text-fg mb-3 shrink-0">Cart {cart.length > 0 && <span className="text-muted font-normal text-sm">({cart.length} item{cart.length !== 1 ? 's' : ''})</span>}</h2>

            {cart.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-muted text-sm">
                Add items from the left
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {cart.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 border-b border-border pb-2 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-fg truncate">{item.part_name}</p>
                      <p className="text-xs text-muted">£{item.unit_price.toFixed(2)} each</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => updateQty(idx, item.quantity - 1)} className="w-6 h-6 rounded bg-surface-2 text-muted hover:text-fg text-sm font-bold flex items-center justify-center">−</button>
                      <span className="w-6 text-center text-sm font-medium text-fg">{item.quantity}</span>
                      <button onClick={() => updateQty(idx, item.quantity + 1)} className="w-6 h-6 rounded bg-surface-2 text-muted hover:text-fg text-sm font-bold flex items-center justify-center">+</button>
                    </div>
                    <span className="text-sm font-bold text-fg w-14 text-right shrink-0">£{item.total.toFixed(2)}</span>
                    <button onClick={() => removeFromCart(idx)} className="text-muted hover:text-red-400 ml-1 shrink-0">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Totals + payment */}
          <div className="card space-y-3 shrink-0">
            {/* Subtotal */}
            <div className="flex justify-between text-sm">
              <span className="text-muted">Subtotal</span>
              <span className="text-fg">{formatCurrency(subtotal)}</span>
            </div>

            {/* Discount */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted shrink-0">Discount (£)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="input text-sm flex-1"
                placeholder="0.00"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
              />
            </div>

            {/* Total */}
            <div className="flex justify-between font-bold text-lg border-t border-border pt-2">
              <span className="text-fg">Total</span>
              <span className="text-primary">{formatCurrency(total)}</span>
            </div>

            {/* Payment method */}
            <div>
              <label className="label text-xs">Payment method</label>
              <div className="grid grid-cols-2 gap-1.5">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m}
                    onClick={() => setPaymentMethod(m)}
                    className={`text-xs py-2 px-3 rounded-lg border font-medium transition-colors ${
                      paymentMethod === m ? 'border-primary bg-primary-muted text-primary' : 'border-border text-muted hover:text-fg'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Optional customer details */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label text-xs">Customer name</label>
                <input type="text" className="input text-xs py-1.5" placeholder="Optional" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              </div>
              <div>
                <label className="label text-xs">Staff</label>
                <input type="text" className="input text-xs py-1.5" placeholder="Your name" value={createdBy} onChange={(e) => setCreatedBy(e.target.value)} />
              </div>
            </div>

            <button
              onClick={completeSale}
              disabled={cart.length === 0 || completing}
              className="btn-primary w-full text-base py-3 font-bold"
            >
              {completing ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Processing…
                </span>
              ) : (
                `Complete Sale · ${formatCurrency(total)}`
              )}
            </button>

            <button
              onClick={() => { setCart([]); setDiscount(''); setCustomerName(''); setCreatedBy('') }}
              disabled={cart.length === 0}
              className="btn-secondary w-full text-sm text-muted"
            >
              Clear Cart
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
