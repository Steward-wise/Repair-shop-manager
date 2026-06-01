import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const imei = request.nextUrl.searchParams.get('imei')
  if (!imei || !/^\d{14,15}$/.test(imei)) {
    return NextResponse.json({ error: 'Invalid IMEI — must be 14 or 15 digits' }, { status: 400 })
  }

  const apiKey = process.env.IMEI_CHECK_API_KEY

  if (apiKey) {
    try {
      // IMEI.info API v2
      const res = await fetch(`https://api.imei.info/v2/?imei=${imei}&api=${apiKey}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(12000),
      })
      const data = await res.json()

      if ((data.status === '200' || data.status === 200) && data.data) {
        const d = data.data
        const blacklisted = d.blacklist === true || d.blacklisted === true || d.gsma_blacklisted === true
        return NextResponse.json({
          blacklisted,
          status: blacklisted ? 'blacklisted' : 'clean',
          carrier: d.carrier ?? d.network ?? null,
          country: d.country ?? null,
          manufacturer: d.manufacturer ?? null,
          model: d.model_name ?? d.model ?? null,
          sim_lock: d.simlock ?? d.sim_lock ?? null,
          raw: d,
          source: 'imei.info',
        })
      }
      // API responded but with error — fall through
    } catch (err) {
      console.error('IMEI check API error:', err)
    }
  }

  // No API key or API failed — return manual check links
  return NextResponse.json({
    manual: true,
    status: 'unknown',
    message: apiKey ? 'IMEI check API unavailable — use manual links below' : 'No IMEI_CHECK_API_KEY set — use manual links below',
    links: [
      { name: 'IMEI.info', url: `https://www.imei.info/?imei=${imei}`, free: true },
      { name: 'Swappa Blacklist Check', url: `https://swappa.com/esn?imei=${imei}`, free: true },
      { name: 'CheckMend', url: `https://www.checkmend.com/`, free: false },
      { name: 'GSMA Device Check', url: `https://www.gsma.com/aboutus/workprogramme/fraud-security-group/device-security-group/imei-services`, free: true },
    ],
  })
}
