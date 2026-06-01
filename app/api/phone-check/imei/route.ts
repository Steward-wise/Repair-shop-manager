import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const imei = request.nextUrl.searchParams.get('imei')
  if (!imei || !/^\d{14,15}$/.test(imei)) {
    return NextResponse.json({ error: 'Invalid IMEI — must be 14 or 15 digits' }, { status: 400 })
  }

  const apiKey = process.env.IMEI_CHECK_API_KEY
  if (!apiKey) {
    return NextResponse.json({
      manual: true, status: 'unknown',
      message: 'No IMEI_CHECK_API_KEY set',
      links: manualLinks(imei),
    })
  }

  // ── imeicheck.net API ────────────────────────────────────────────────────
  try {
    // Step 1: Submit check
    const submitRes = await fetch('https://api.imeicheck.net/v1/checks', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ deviceId: imei, serviceId: 1 }),
      signal: AbortSignal.timeout(15000),
    })

    if (!submitRes.ok) {
      const errText = await submitRes.text()
      console.error('imeicheck.net submit error:', submitRes.status, errText)
      throw new Error(`API returned ${submitRes.status}`)
    }

    const submitData = await submitRes.json()

    // If check came back immediately with properties
    if (submitData.properties) {
      return NextResponse.json(formatResult(imei, submitData))
    }

    // Step 2: Poll for result if async (status: processing)
    const checkId = submitData.id
    if (!checkId) throw new Error('No check ID returned')

    // Poll up to 10 times with 1s delay
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 1200))
      const pollRes = await fetch(`https://api.imeicheck.net/v1/checks/${checkId}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      })
      if (!pollRes.ok) continue
      const pollData = await pollRes.json()
      if (pollData.status === 'done' || pollData.properties) {
        return NextResponse.json(formatResult(imei, pollData))
      }
      if (pollData.status === 'failed' || pollData.status === 'error') {
        throw new Error(`Check failed: ${pollData.message ?? pollData.status}`)
      }
    }
    throw new Error('Check timed out after polling')

  } catch (err) {
    console.error('imeicheck.net error:', err)
    return NextResponse.json({
      manual: true,
      status: 'unknown',
      message: 'IMEI check failed — use manual links',
      error: String(err),
      links: manualLinks(imei),
    })
  }
}

function formatResult(imei: string, data: Record<string, unknown>) {
  const p = (data.properties ?? {}) as Record<string, unknown>

  // Blacklist status
  const bl = String(p.blacklistStatus ?? p.gsmaStatus ?? '').toLowerCase()
  const blacklisted = bl === 'blacklisted' || bl === 'blocked' || bl === 'reported'
  const clean       = bl === 'clean' || bl === 'not blacklisted' || bl === 'clear'
  const status      = blacklisted ? 'blacklisted' : clean ? 'clean' : 'unknown'

  return {
    imei,
    blacklisted,
    status,
    carrier:      p.carrier      ?? p.network       ?? null,
    country:      p.country      ?? p.countryName   ?? null,
    manufacturer: p.manufacturer ?? p.brand         ?? null,
    model:        p.modelName    ?? p.deviceName     ?? p.model ?? null,
    sim_lock:     p.simLock      ?? p.simlock        ?? null,
    warranty:     p.warrantyStatus ?? p.warranty     ?? null,
    activation:   p.activationStatus ?? null,
    find_my:      p.findMyiPhone ?? p.fmi            ?? null,
    mdm:          p.mdmStatus    ?? p.mdm            ?? null,
    lost:         p.lostMode     ?? null,
    purchase_date:p.purchaseDate ?? p.purchaseCountry ?? null,
    raw: p,
    source: 'imeicheck.net',
  }
}

function manualLinks(imei: string) {
  return [
    { name: 'IMEI.info',       url: `https://www.imei.info/?imei=${imei}`,   free: true },
    { name: 'Swappa',          url: `https://swappa.com/esn?imei=${imei}`,    free: true },
    { name: 'CheckMend',       url: 'https://www.checkmend.com/',              free: false },
  ]
}
