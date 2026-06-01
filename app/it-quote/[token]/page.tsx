import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import type { ITQuote } from '@/types'
import ITQuoteClient from './ITQuoteClient'

interface Props { params: Promise<{ token: string }> }

export default async function PublicITQuotePage({ params }: Props) {
  const { token } = await params
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('it_quotes')
    .select('*, client:support_clients(id, company_name, contact_name, contact_email)')
    .eq('quote_token', token)
    .single()

  if (!data) notFound()

  const shopName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Repair Shop'
  const shopPhone = process.env.NEXT_PUBLIC_SHOP_PHONE ?? ''

  return <ITQuoteClient quote={data as ITQuote} token={token} shopName={shopName} shopPhone={shopPhone} />
}
