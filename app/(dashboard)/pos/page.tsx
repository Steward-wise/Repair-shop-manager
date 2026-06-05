'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

const TILES = [
  {
    label: 'Walk-in Sale',
    href: '/pos/sale',
    color: 'bg-primary hover:bg-primary/90',
    badge: 'NEW',
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/>
        <path d="M16 10a4 4 0 0 1-8 0"/>
      </svg>
    ),
  },
  {
    label: 'New Repair',
    href: '/jobs/new',
    color: 'bg-surface-2 hover:bg-surface border border-border',
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12h14"/><path d="M12 5v14"/>
      </svg>
    ),
  },
  {
    label: 'All Jobs',
    href: '/jobs',
    color: 'bg-surface-2 hover:bg-surface border border-border',
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
      </svg>
    ),
  },
  {
    label: "Today's Jobs",
    href: '/jobs?status=intake',
    color: 'bg-surface-2 hover:bg-surface border border-border',
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>
      </svg>
    ),
  },
  {
    label: 'Ready to Collect',
    href: '/jobs?status=ready',
    color: 'bg-green-900/60 hover:bg-green-900/80 border border-green-700',
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6 9 17l-5-5"/>
      </svg>
    ),
  },
  {
    label: 'Customers',
    href: '/customers',
    color: 'bg-surface-2 hover:bg-surface border border-border',
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    label: 'Inventory',
    href: '/inventory',
    color: 'bg-surface-2 hover:bg-surface border border-border',
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
        <path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>
      </svg>
    ),
  },
  {
    label: 'Reports',
    href: '/reports',
    color: 'bg-surface-2 hover:bg-surface border border-border',
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>
      </svg>
    ),
  },
  {
    label: 'Dashboard',
    href: '/dashboard',
    color: 'bg-surface-2 hover:bg-surface border border-border',
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/>
        <rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>
      </svg>
    ),
  },
]

export default function PosPage() {
  const router = useRouter()
  const shopName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Repair Shop'

  return (
    <div className="min-h-[calc(100vh-56px)] flex flex-col">
      {/* POS header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl bg-surface-2 border border-border text-muted hover:text-fg hover:bg-surface transition-colors active:scale-95"
            aria-label="Go back"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </button>
          <div>
            <h1 className="text-3xl font-bold text-fg">{shopName}</h1>
            <p className="text-muted text-sm mt-0.5">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
        </div>
      </div>

      {/* Tile grid — optimised for iPad landscape (4 columns) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 flex-1">
        {TILES.map((tile) => (
          <Link
            key={tile.href}
            href={tile.href}
            className={`${tile.color} rounded-2xl flex flex-col items-center justify-center gap-4 text-center p-6 transition-all duration-150 select-none active:scale-95 min-h-[140px] relative`}
          >
            {'badge' in tile && tile.badge && (
              <span className="absolute top-3 right-3 text-xs font-bold bg-white/20 text-white px-1.5 py-0.5 rounded-full">
                {tile.badge}
              </span>
            )}
            <span className="text-fg">{tile.icon}</span>
            <span className="text-fg font-semibold text-base leading-tight">{tile.label}</span>
          </Link>
        ))}
      </div>

      <p className="text-center text-xs text-muted mt-6 pb-2">
        Tip: Scan a barcode to jump straight to a job · Use ⌘K to search
      </p>
    </div>
  )
}
