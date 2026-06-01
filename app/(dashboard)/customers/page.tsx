import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import type { Customer } from '@/types'

export const metadata = { title: 'Customers' }

interface PageProps {
  searchParams: Promise<{ q?: string }>
}

export default async function CustomersPage({ searchParams }: PageProps) {
  const { q } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('customers')
    .select('*')
    .order('name')
    .limit(200)

  if (q) {
    query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`)
  }

  const { data: customers } = await query

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-fg">Customers</h1>
        <span className="text-muted text-sm">{customers?.length ?? 0} customers</span>
      </div>

      <form>
        <input
          name="q"
          defaultValue={q}
          type="search"
          placeholder="Search by name, phone, or email…"
          className="input max-w-sm"
        />
      </form>

      <div className="card overflow-hidden">
        {!customers?.length ? (
          <div className="text-center py-16 text-muted">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3 opacity-40">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <p>No customers yet. They are created automatically when booking a job.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2">
                  <th className="text-left text-muted font-medium py-3 px-4">Name</th>
                  <th className="text-left text-muted font-medium py-3 px-4 hidden sm:table-cell">Phone</th>
                  <th className="text-left text-muted font-medium py-3 px-4 hidden md:table-cell">Email</th>
                  <th className="text-left text-muted font-medium py-3 px-4 hidden lg:table-cell">Since</th>
                  <th className="text-right text-muted font-medium py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(customers as Customer[]).map((c) => (
                  <tr key={c.id} className="hover:bg-surface-2/50 transition-colors">
                    <td className="py-3 px-4">
                      <Link href={`/customers/${c.id}`} className="text-fg font-medium hover:text-primary transition-colors">
                        {c.name}
                      </Link>
                    </td>
                    <td className="py-3 px-4 hidden sm:table-cell">
                      {c.phone
                        ? <a href={`tel:${c.phone}`} className="text-muted hover:text-primary transition-colors">{c.phone}</a>
                        : <span className="text-muted">—</span>}
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell">
                      {c.email
                        ? <a href={`mailto:${c.email}`} className="text-muted hover:text-primary text-xs transition-colors">{c.email}</a>
                        : <span className="text-muted">—</span>}
                    </td>
                    <td className="py-3 px-4 hidden lg:table-cell text-muted text-xs">{formatDate(c.created_at)}</td>
                    <td className="py-3 px-4 text-right">
                      <Link href={`/customers/${c.id}`} className="text-xs text-primary hover:underline">
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
