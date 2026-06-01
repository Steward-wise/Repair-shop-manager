/**
 * 404Fixed Local Device Bridge
 * Run this on your Windows PC to enable phone detection from devices
 * plugged into your computer (instead of the Raspberry Pi).
 *
 * Usage: node server.js
 * Or double-click: start.bat
 *
 * Listens on http://localhost:7777
 * Requires: adb in PATH or platform-tools folder here
 *           ideviceinfo in PATH for iPhone support (optional)
 */

const http = require('http')
const { execSync } = require('child_process')
const path = require('path')

const PORT = 7777
const TIMEOUT = 8000

// Allow requests from the repair shop app (and localhost for testing)
// Add your production URL here if needed, or set ALLOWED_ORIGIN env var
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN
  ? [process.env.ALLOWED_ORIGIN]
  : []
).concat([
  'http://localhost:3000',
  'http://localhost:3001',
  'http://192.168.1.196:3000',
])

// Try to find ADB — check local platform-tools first, then PATH
function findAdb() {
  const local = path.join(__dirname, 'platform-tools', 'adb.exe')
  try {
    execSync(`"${local}" version`, { timeout: 3000, stdio: 'ignore' })
    return local
  } catch {}
  try {
    execSync('adb version', { timeout: 3000, stdio: 'ignore' })
    return 'adb'
  } catch {}
  // Common Android SDK locations on Windows
  const candidates = [
    `${process.env.LOCALAPPDATA}\\Android\\Sdk\\platform-tools\\adb.exe`,
    `${process.env.USERPROFILE}\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe`,
    'C:\\platform-tools\\adb.exe',
  ]
  for (const c of candidates) {
    try {
      execSync(`"${c}" version`, { timeout: 3000, stdio: 'ignore' })
      return c
    } catch {}
  }
  return null
}

function findIdeviceinfo() {
  const local = path.join(__dirname, 'ideviceinfo.exe')
  try {
    execSync(`"${local}" --version`, { timeout: 3000, stdio: 'ignore' })
    return local
  } catch {}
  try {
    execSync('ideviceinfo --version', { timeout: 3000, stdio: 'ignore' })
    return 'ideviceinfo'
  } catch {}
  return null
}

function run(cmd) {
  try {
    return execSync(cmd, {
      timeout: TIMEOUT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  } catch {
    return ''
  }
}

function detectDevice(ADB, IDEV) {
  // ── Android ──────────────────────────────────────────────
  if (ADB) {
    run(`"${ADB}" start-server`)
    const adbOut = run(`"${ADB}" devices`)
    const adbLines = adbOut.split('\n').slice(1).filter(l => l.includes('\tdevice'))

    if (adbLines.length > 0) {
      const adb = (args) => run(`"${ADB}" ${args}`)

      const manufacturer = adb('shell getprop ro.product.manufacturer')
      const model        = adb('shell getprop ro.product.model')
      const deviceName   = adb('shell getprop ro.product.name')
      const osVersion    = adb('shell getprop ro.build.version.release')
      const serial       = adb('get-serialno')

      // IMEI
      let imei = null, imei2 = null
      const v1 = adb('shell cmd phone get-imei 0')
      const m1 = v1.match(/IMEI\s*=\s*(\d{14,15})/)
      if (m1) imei = m1[1]
      if (!imei) {
        const v2 = adb('shell getprop gsm.imei')
        if (/^\d{14,15}$/.test(v2)) imei = v2
      }
      if (!imei) {
        const v3 = adb('shell dumpsys iphonesubinfo')
        const m3 = v3.match(/Device ID\s*=\s*(\d{14,15})/)
        if (m3) imei = m3[1]
      }
      const v4 = adb('shell cmd phone get-imei 1')
      const m4 = v4.match(/IMEI\s*=\s*(\d{14,15})/)
      if (m4) imei2 = m4[1]

      // Battery
      const battDump    = adb('shell dumpsys battery')
      const levelMatch  = battDump.match(/level:\s*(\d+)/)
      const battLevel   = levelMatch ? parseInt(levelMatch[1]) : null
      const healthMatch = battDump.match(/health:\s*(\d+)/)
      const healthMap   = { '2': 'Good', '3': 'Overheat', '4': 'Dead', '5': 'Overvoltage', '7': 'Cold' }
      const battHealth  = healthMatch ? (healthMap[healthMatch[1]] ?? 'Unknown') : 'Unknown'

      // MDM
      const dpm     = adb('shell dpm list-owners 2>/dev/null')
      const mdmPkgs = adb('shell pm list packages 2>/dev/null | findstr /i "mobileiron airwatch jamf meraki citrix soti intune mdm"')
      const hasMdm  = dpm.includes('componentInfo=') || mdmPkgs.length > 3
      const provisioned = adb('shell settings get global device_provisioned')

      return {
        platform: 'android',
        manufacturer: manufacturer || null,
        model: model || null,
        device_name: deviceName || null,
        os_version: osVersion ? `Android ${osVersion}` : null,
        serial_number: serial || null,
        imei,
        imei2,
        battery_health: battLevel,
        battery_health_label: battHealth,
        frp_status: 'clean',
        frp_note: provisioned === '1' ? 'Device provisioned — no FRP detected' : 'Provisioning state unknown',
        mdm_status: hasMdm ? 'supervised' : 'clean',
        mdm_packages: mdmPkgs || null,
      }
    }
  }

  // ── iOS ───────────────────────────────────────────────────
  if (IDEV) {
    const idev = (args) => run(`"${IDEV}" ${args}`)
    const udid = idev('-k UniqueDeviceID')

    if (udid && udid.length > 10 && !udid.toLowerCase().includes('error') && !udid.toLowerCase().includes('no device')) {
      const imei            = idev('-k InternationalMobileEquipmentIdentity')
      const model           = idev('-k ProductType')
      const deviceName      = idev('-k DeviceName')
      const osVersion       = idev('-k ProductVersion')
      const serial          = idev('-k SerialNumber')
      const activationState = idev('-k ActivationState')
      const isSupervised    = idev('-k IsSupervised')
      const battCapacity    = idev('-k BatteryCurrentCapacity')
      const hwModel         = idev('-k HardwareModel')

      const icloudStatus = activationState === 'Activated' ? 'clean'
        : activationState === 'Unactivated' ? 'locked'
        : 'unknown'

      return {
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
        frp_status: 'unknown',
      }
    }
  }

  return null
}

const ADB  = findAdb()
const IDEV = findIdeviceinfo()

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log(' 404Fixed Local Device Bridge')
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
console.log(` ADB:        ${ADB  ?? '✗ Not found — Android detection unavailable'}`)
console.log(` ideviceinfo:${IDEV ?? ' ✗ Not found — iPhone detection unavailable'}`)
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
if (!ADB && !IDEV) {
  console.log('\n⚠  No tools found. See setup instructions below.\n')
  console.log('  Android: Download platform-tools from:')
  console.log('    https://developer.android.com/tools/releases/platform-tools')
  console.log('  Extract adb.exe next to this script, or add to PATH.\n')
  console.log('  iPhone: Download libimobiledevice for Windows from:')
  console.log('    https://github.com/libimobiledevice-win32/imobiledevice-net/releases')
  console.log('  Place ideviceinfo.exe next to this script, or add to PATH.\n')
}
console.log(` Listening on http://localhost:${PORT}`)
console.log(' Keep this window open while using Phone Check.\n')

const server = http.createServer((req, res) => {
  const origin = req.headers.origin || ''
  const corsOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]

  res.setHeader('Access-Control-Allow-Origin', corsOrigin)
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Content-Type', 'application/json')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  if (req.url === '/device' && req.method === 'GET') {
    console.log(`[${new Date().toLocaleTimeString()}] Device detect request`)
    const result = detectDevice(ADB, IDEV)

    if (result) {
      console.log(`  → Found: ${result.platform} / ${result.device_name ?? result.model ?? 'unknown'}`)
      res.writeHead(200)
      res.end(JSON.stringify(result))
    } else {
      const hints = []
      if (!ADB && !IDEV) {
        hints.push('Neither adb nor ideviceinfo found. Install platform-tools (Android) or libimobiledevice (iPhone).')
      } else {
        if (ADB)  hints.push('Android: Enable USB Debugging on the phone, then connect via USB.')
        if (IDEV) hints.push('iPhone: Connect via USB and tap "Trust This Computer" on the phone screen.')
        hints.push('Make sure the USB cable supports data transfer (not just charging).')
      }
      res.writeHead(404)
      res.end(JSON.stringify({ error: 'No device detected.', hints }))
    }
    return
  }

  if (req.url === '/status' && req.method === 'GET') {
    res.writeHead(200)
    res.end(JSON.stringify({ ok: true, adb: !!ADB, ideviceinfo: !!IDEV, port: PORT }))
    return
  }

  res.writeHead(404)
  res.end(JSON.stringify({ error: 'Not found' }))
})

server.listen(PORT, '127.0.0.1', () => {
  // already logged above
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n✗ Port ${PORT} is already in use. The bridge may already be running.`)
    console.error('  Close the other instance or change PORT in this file.\n')
  } else {
    console.error('Server error:', err)
  }
  process.exit(1)
})
