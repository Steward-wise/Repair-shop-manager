import { NextResponse } from 'next/server'
import { execSync } from 'child_process'

const TIMEOUT = 8000
// Use absolute paths so the server-side Node process finds the binaries
// regardless of its PATH environment
const ADB = '/usr/bin/adb'
const IDEVICEINFO = '/usr/bin/ideviceinfo'

function run(cmd: string): string {
  try {
    return execSync(cmd, {
      timeout: TIMEOUT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PATH: '/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin' },
    }).trim()
  } catch {
    return ''
  }
}
const adb = (args: string) => run(`${ADB} ${args}`)
const idev = (args: string) => run(`${IDEVICEINFO} ${args}`)

function androidImei(): string | null {
  // Method 1: cmd phone (Android 10+)
  const v1 = adb('shell cmd phone get-imei 0')
  const m1 = v1.match(/IMEI\s*=\s*(\d{14,15})/)
  if (m1) return m1[1]

  // Method 2: getprop (older devices)
  const v2 = adb('shell getprop gsm.imei')
  if (/^\d{14,15}$/.test(v2)) return v2

  // Method 3: dumpsys iphonesubinfo
  const v3 = adb('shell dumpsys iphonesubinfo')
  const m3 = v3.match(/Device ID\s*=\s*(\d{14,15})/)
  if (m3) return m3[1]

  return null
}

function androidImei2(): string | null {
  const v1 = adb('shell cmd phone get-imei 1')
  const m1 = v1.match(/IMEI\s*=\s*(\d{14,15})/)
  if (m1) return m1[1]
  return null
}

export async function GET() {
  // On cloud platforms (Netlify, Vercel etc.) ADB/ideviceinfo binaries are not
  // available. Return immediately so the client can fall back to the local bridge.
  if (process.env.NETLIFY || process.env.VERCEL || process.env.NETLIFY_DEV) {
    return NextResponse.json({
      error: 'Device detection is not available server-side on this platform.',
      hints: [
        'Run local-agent/start.bat on your Windows PC to detect phones plugged into your computer.',
        'The local bridge listens on http://localhost:7777 and is tried automatically by the app.',
        'For Android: ensure adb.exe is in local-agent/ or your PATH.',
        'For iPhone: ensure ideviceinfo.exe is in local-agent/ or your PATH.',
      ],
    }, { status: 404 })
  }

  // Ensure ADB daemon is running before querying devices
  run(`${ADB} start-server`)

  // ── Android via ADB ─────────────────────────────────────
  const adbOut = adb('devices')
  const adbLines = adbOut.split('\n').slice(1).filter(l => l.includes('\tdevice'))
  if (adbLines.length > 0) {
    const manufacturer = adb('shell getprop ro.product.manufacturer')
    const model        = adb('shell getprop ro.product.model')
    const deviceName   = adb('shell getprop ro.product.name')
    const osVersion    = adb('shell getprop ro.build.version.release')
    const serial       = adb('get-serialno')
    const imei         = androidImei()
    const imei2        = androidImei2()

    // Battery
    const battDump     = adb('shell dumpsys battery')
    const levelMatch   = battDump.match(/level:\s*(\d+)/)
    const battLevel    = levelMatch ? parseInt(levelMatch[1]) : null
    const healthMatch  = battDump.match(/health:\s*(\d+)/)
    const healthMap: Record<string, string> = { '2': 'Good', '3': 'Overheat', '4': 'Dead', '5': 'Overvoltage', '7': 'Cold' }
    const battHealth   = healthMatch ? (healthMap[healthMatch[1]] ?? 'Unknown') : 'Unknown'

    // MDM: check for device owner or known MDM packages
    const dpm = adb('shell dpm list-owners 2>/dev/null')
    const mdmPkgs = adb('shell pm list packages 2>/dev/null | grep -iE "(mobileiron|airwatch|jamf|meraki|citrix|soti|intune|knox\\.manage|mdm)" | head -3')
    const hasMdm = dpm.includes('componentInfo=') || mdmPkgs.length > 3

    // FRP: if ADB connects in normal mode, device is not FRP-locked
    // (FRP-locked phones block ADB). We also check provisioned state.
    const provisioned = adb('shell settings get global device_provisioned')

    return NextResponse.json({
      platform: 'android',
      manufacturer: manufacturer || null,
      model: model || null,
      device_name: deviceName || null,
      os_version: osVersion ? `Android ${osVersion}` : null,
      serial_number: serial || null,
      imei: imei,
      imei2: imei2,
      battery_health: battLevel,
      battery_health_label: battHealth,
      frp_status: 'clean',            // ADB connection proves no FRP
      frp_note: provisioned === '1' ? 'Device provisioned — no FRP detected' : 'Provisioning state unknown',
      mdm_status: hasMdm ? 'supervised' : 'clean',
      mdm_packages: mdmPkgs || null,
    })
  }

  // ── iOS via libimobiledevice ─────────────────────────────
  const udid = idev('-k UniqueDeviceID')
  if (udid && udid.length > 10 && !udid.toLowerCase().includes('error') && !udid.toLowerCase().includes('no device')) {
    const imei           = idev('-k InternationalMobileEquipmentIdentity')
    const model          = idev('-k ProductType')
    const deviceName     = idev('-k DeviceName')
    const osVersion      = idev('-k ProductVersion')
    const serial         = idev('-k SerialNumber')
    const activationState = idev('-k ActivationState')
    const isSupervised   = idev('-k IsSupervised')
    const battCapacity   = idev('-k BatteryCurrentCapacity')
    const hwModel        = idev('-k HardwareModel')

    // iCloud lock: 'Activated' = clean, anything else = potentially locked
    const icloudStatus = activationState === 'Activated' ? 'clean'
      : activationState === 'Unactivated' ? 'locked'
      : activationState ? 'unknown' : 'unknown'

    return NextResponse.json({
      platform: 'ios',
      manufacturer: 'Apple',
      model: model || null,
      device_name: deviceName || null,
      os_version: osVersion ? `iOS ${osVersion}` : null,
      serial_number: serial || null,
      imei: imei && /^\d{14,15}$/.test(imei) ? imei : null,
      udid: udid || null,
      hardware_model: hwModel || null,
      battery_health: battCapacity ? parseInt(battCapacity) : null,
      activation_state: activationState || null,
      icloud_status: icloudStatus,
      mdm_status: isSupervised === 'true' ? 'supervised' : 'clean',
      frp_status: 'unknown',   // Not applicable on iOS
    })
  }

  return NextResponse.json({
    error: 'No device detected.',
    hints: [
      '⚠️  The phone must be plugged into the Raspberry Pi via USB — not your computer.',
      'Android: Enable Developer Options → USB Debugging on the phone, then connect to the Pi USB port.',
      'iPhone: Connect to the Pi USB port, then tap "Trust This Computer" when prompted on the iPhone screen.',
      'iPhone: The usbmuxd service starts automatically when the iPhone is plugged in — if it still fails, try unplugging and re-plugging the cable.',
      'If "Trust" prompt never appears, go to Settings → General → Transfer or Reset iPhone → Reset → Reset Location & Privacy, then reconnect.',
    ],
  }, { status: 404 })
}
