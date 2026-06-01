import twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const fromNumber = process.env.TWILIO_PHONE_NUMBER
const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER

function normaliseUK(number: string) {
  return number.replace(/^0/, '+44').replace(/\s/g, '')
}

export async function sendSMS(to: string, message: string): Promise<boolean> {
  if (!accountSid || !authToken || !fromNumber) {
    console.warn('Twilio env vars not set — skipping SMS')
    return false
  }

  try {
    const client = twilio(accountSid, authToken)
    await client.messages.create({ body: message, from: fromNumber, to: normaliseUK(to) })
    return true
  } catch (err) {
    console.error('SMS send failed:', err)
    return false
  }
}

export async function sendWhatsApp(to: string, message: string): Promise<boolean> {
  if (!accountSid || !authToken || !whatsappNumber) {
    console.warn('Twilio WhatsApp env vars not set — skipping WhatsApp')
    return false
  }

  try {
    const client = twilio(accountSid, authToken)
    await client.messages.create({
      body: message,
      from: `whatsapp:${whatsappNumber}`,
      to: `whatsapp:${normaliseUK(to)}`,
    })
    return true
  } catch (err) {
    console.error('WhatsApp send failed:', err)
    return false
  }
}
