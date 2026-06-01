const { createClient } = require('@supabase/supabase-js')

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  }

  let body
  try {
    body = JSON.parse(event.body)
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }

  const { first_name, last_name, email, phone, device_type, device_make_model, problem_description, marketing_consent } = body

  if (!first_name || !last_name || !email || !problem_description) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) }
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )

  // Load quote rules for auto-matching
  const { data: rules } = await supabase
    .from('quote_rules')
    .select('*')
    .order('sort_order', { ascending: true })

  let suggested_price = null
  let matched_rule_id = null

  if (rules && rules.length > 0) {
    const text = `${device_type ?? ''} ${device_make_model ?? ''} ${problem_description}`.toLowerCase()
    let bestScore = 0

    for (const rule of rules) {
      let score = 0
      if (rule.device_type && device_type &&
          device_type.toLowerCase().includes(rule.device_type.toLowerCase())) {
        score += 10
      }
      if (rule.keywords) {
        const kws = rule.keywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean)
        for (const kw of kws) {
          if (text.includes(kw)) score += 5
        }
      }
      if (score > bestScore) {
        bestScore = score
        if (rule.min_price != null) {
          suggested_price = rule.max_price != null
            ? Math.round((rule.min_price + rule.max_price) / 2)
            : rule.min_price
        }
        matched_rule_id = rule.id
      }
    }
  }

  const { error } = await supabase.from('quotes').insert({
    first_name: first_name.trim(),
    last_name: last_name.trim(),
    email: email.trim().toLowerCase(),
    phone: phone?.trim() || null,
    device_type: device_type?.trim() || null,
    device_make_model: device_make_model?.trim() || null,
    problem_description: problem_description.trim(),
    marketing_consent: marketing_consent === true || marketing_consent === 'true',
    suggested_price,
    matched_rule_id,
    status: 'new',
  })

  if (error) {
    console.error('Supabase insert error:', error)
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to save quote request' }) }
  }

  return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) }
}
