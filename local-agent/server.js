/**
 * 404Fixed Local Device Bridge v2
 * ─────────────────────────────────────────────────────────────────────────────
 * Run on your Windows PC. Detects phones plugged in via USB and runs
 * hardware diagnostics — similar to PhoneCheck3.
 *
 * Usage:  node server.js
 *         (or double-click start.bat)
 *
 * Listens: http://localhost:7777
 * Requires: platform-tools/adb.exe  (Android)
 *           ideviceinfo.exe          (iPhone — optional)
 *
 * If platform-tools is missing, run: node setup.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

const http  = require('http')
const { execSync, spawnSync } = require('child_process')
const path  = require('path')
const fs    = require('fs')

const PORT    = 7777
const TIMEOUT = 10000

// ─── CORS: allow all origins (safe — this server only binds to 127.0.0.1) ───
function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin',          '*')
  res.setHeader('Access-Control-Allow-Methods',         'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers',         'Content-Type')
  res.setHeader('Access-Control-Allow-Private-Network', 'true')  // Required: HTTPS page → HTTP localhost
}

// ─── Run a command, return stdout or '' on any error ────────────────────────
function run(cmd, timeoutMs = TIMEOUT) {
  try {
    return execSync(cmd, {
      timeout: timeoutMs,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'], // ignore stderr so Windows doesn't choke
      shell: true,                          // use cmd.exe for pipes on Windows
    }).trim()
  } catch {
    return ''
  }
}

// ─── Find ADB ────────────────────────────────────────────────────────────────
function findAdb() {
  const candidates = [
    path.join(__dirname, 'platform-tools', 'adb.exe'),
    path.join(__dirname, 'adb.exe'),
    `${process.env.LOCALAPPDATA || ''}\\Android\\Sdk\\platform-tools\\adb.exe`,
    `${process.env.USERPROFILE  || ''}\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe`,
    'C:\\platform-tools\\adb.exe',
    'C:\\Android\\platform-tools\\adb.exe',
  ]
  for (const c of candidates) {
    if (fs.existsSync(c)) return c
  }
  // Try PATH
  const r = spawnSync('adb', ['version'], { timeout: 3000, stdio: 'ignore', shell: true })
  if (r.status === 0) return 'adb'
  return null
}

// ─── Find ideviceinfo ────────────────────────────────────────────────────────
function findIdev() {
  const candidates = [
    path.join(__dirname, 'ideviceinfo.exe'),
    path.join(__dirname, 'libimobiledevice', 'ideviceinfo.exe'),
    'C:\\Program Files\\libimobiledevice\\ideviceinfo.exe',
  ]
  for (const c of candidates) {
    if (fs.existsSync(c)) return c
  }
  const r = spawnSync('ideviceinfo', ['--version'], { timeout: 3000, stdio: 'ignore', shell: true })
  if (r.status === 0) return 'ideviceinfo'
  return null
}

const ADB  = findAdb()
const IDEV = findIdev()

// ─── Find Python command (saved by setup.js, or search PATH) ─────────────────
function tryPython(cmd) {
  try {
    const out = execSync(`${cmd} -c "import pymobiledevice3; print('ok')"`, {
      timeout: 8000, encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      shell: true,
    }).trim()
    return out === 'ok'
  } catch { return false }
}

function findPython() {
  // Check if setup.js saved a preferred command
  const savedPath = path.join(__dirname, '.python_cmd')
  if (fs.existsSync(savedPath)) {
    const cmd = fs.readFileSync(savedPath, 'utf8').trim()
    if (tryPython(cmd)) return cmd
  }
  // Try versioned py launcher first, then fallbacks
  for (const cmd of ['py -3.12', 'py -3.11', 'py -3.13', 'py -3.10', 'python3', 'python', 'py']) {
    if (tryPython(cmd)) return cmd
  }
  return null
}
const PYTHON = findPython()
const QUERY_IOS = path.join(__dirname, 'query_ios.py')

// ─── ADB helper ──────────────────────────────────────────────────────────────
function adb(args) {
  if (!ADB) return ''
  return run(`"${ADB}" ${args}`)
}
function idev(args) {
  if (!IDEV) return ''
  return run(`"${IDEV}" ${args}`)
}

// ─── Parse key=value from ADB dump output ────────────────────────────────────
function parseKV(text, key) {
  const m = text.match(new RegExp(key + '\\s*[=:]\\s*(.+)', 'i'))
  return m ? m[1].trim() : null
}

// ─── ANDROID: basic device info ──────────────────────────────────────────────
function androidBasic() {
  const manufacturer = adb('shell getprop ro.product.manufacturer')
  const model        = adb('shell getprop ro.product.model')
  const deviceName   = adb('shell getprop ro.product.name')
  const osVersion    = adb('shell getprop ro.build.version.release')
  const serial       = adb('get-serialno')
  const androidId    = adb('shell settings get secure android_id')

  // IMEI — try multiple methods
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

  return { manufacturer, model, deviceName, osVersion, serial, androidId, imei, imei2 }
}

// ─── ANDROID: battery ────────────────────────────────────────────────────────
function androidBattery() {
  const dump = adb('shell dumpsys battery')
  const level   = parseKV(dump, 'level')
  const health  = parseKV(dump, 'health')
  const temp    = parseKV(dump, 'temperature')
  const voltage = parseKV(dump, 'voltage')
  const status  = parseKV(dump, 'status')
  const tech    = parseKV(dump, 'technology')

  const healthMap = { '1':'Unknown','2':'Good','3':'Overheat','4':'Dead','5':'Overvoltage','6':'Unknown failure','7':'Cold' }
  const statusMap = { '1':'Unknown','2':'Charging','3':'Discharging','4':'Not charging','5':'Full' }

  return {
    level:       level ? parseInt(level) : null,
    health_code: health,
    health:      health ? (healthMap[health] ?? `Code ${health}`) : 'Unknown',
    status:      status ? (statusMap[status] ?? `Code ${status}`) : 'Unknown',
    temperature: temp   ? (parseInt(temp) / 10).toFixed(1) + '°C' : null,
    voltage:     voltage ? (parseInt(voltage) / 1000).toFixed(2) + 'V' : null,
    technology:  tech ?? null,
  }
}

// ─── ANDROID: display ────────────────────────────────────────────────────────
function androidDisplay() {
  const size    = adb('shell wm size')
  const density = adb('shell wm density')
  // physical screen info from dumpsys
  const win = adb('shell dumpsys window displays')
  const refreshM = win.match(/fps=(\d+\.?\d*)/)
  const refresh = refreshM ? parseFloat(refreshM[1]) : null

  const sizeM   = size.match(/Physical size:\s*(\d+x\d+)/)
  const densM   = density.match(/Physical density:\s*(\d+)/)
  return {
    resolution: sizeM   ? sizeM[1] : null,
    density:    densM   ? parseInt(densM[1]) : null,
    refresh_rate: refresh,
  }
}

// ─── ANDROID: storage & RAM ──────────────────────────────────────────────────
function androidStorage() {
  const df      = adb('shell df /data')
  const meminfo = adb('shell cat /proc/meminfo')
  const totalM  = meminfo.match(/MemTotal:\s*(\d+)/)
  const availM  = meminfo.match(/MemAvailable:\s*(\d+)/)

  // df output: Filesystem 1K-blocks Used Available Use% Mounted
  const dfLines = df.split('\n').filter(l => l.includes('/data'))
  let storageTotal = null, storageAvail = null
  if (dfLines.length > 0) {
    const parts = dfLines[0].split(/\s+/)
    if (parts.length >= 4) {
      storageTotal = Math.round(parseInt(parts[1]) / 1024 / 1024) + ' GB'
      storageAvail = Math.round(parseInt(parts[3]) / 1024 / 1024) + ' GB'
    }
  }
  return {
    ram_total: totalM ? Math.round(parseInt(totalM[1]) / 1024) + ' MB' : null,
    ram_available: availM ? Math.round(parseInt(availM[1]) / 1024) + ' MB' : null,
    storage_total: storageTotal,
    storage_available: storageAvail,
  }
}

// ─── ANDROID: connectivity ────────────────────────────────────────────────────
function androidConnectivity() {
  const wifi     = adb('shell dumpsys wifi')
  const bt       = adb('shell dumpsys bluetooth_manager')
  const tel      = adb('shell dumpsys telephony.registry')
  const location = adb('shell dumpsys location')

  // WiFi
  const wifiEnabled = wifi.includes('Wi-Fi is enabled') || wifi.includes('mWifiEnabled=true')
  const ssidM = wifi.match(/mSSID=([^\s,]+)/)
  const wifiMacM = wifi.match(/mMacAddress=([0-9a-fA-F:]{17})/)

  // Bluetooth
  const btEnabled = bt.includes('STATE_ON') || bt.includes('mAdapterState=12')
  const btMacM = bt.match(/mAddress=([0-9a-fA-F:]{17})/)

  // Signal strength
  const sigM = tel.match(/mSignalStrength=.*?(-?\d+)\s*dBm/)

  // GPS
  const gpsEnabled = location.includes('gps') && !location.includes('gps,disabled')

  return {
    wifi_enabled: wifiEnabled,
    wifi_ssid:    ssidM ? ssidM[1].replace(/"/g, '') : null,
    wifi_mac:     wifiMacM ? wifiMacM[1] : null,
    bluetooth_enabled: btEnabled,
    bluetooth_mac: btMacM ? btMacM[1] : null,
    signal_dbm:    sigM ? parseInt(sigM[1]) : null,
    gps_enabled:   gpsEnabled,
  }
}

// ─── ANDROID: sensors ────────────────────────────────────────────────────────
function androidSensors() {
  const dump = adb('shell dumpsys sensorservice')
  const sensors = []
  const sensorNames = [
    'Accelerometer','Gyroscope','Magnetometer','Proximity','Ambient Light',
    'Barometer','Pressure','Gravity','Linear Acceleration','Rotation Vector',
    'Step Counter','Step Detector','Significant Motion',
  ]
  for (const name of sensorNames) {
    if (dump.toLowerCase().includes(name.toLowerCase())) {
      sensors.push(name)
    }
  }
  return sensors
}

// ─── ANDROID: camera ─────────────────────────────────────────────────────────
function androidCameras() {
  const dump = adb('shell dumpsys media.camera')
  const cameras = []
  const backM  = dump.match(/Camera 0.*?facing.*?back/i)
  const frontM = dump.match(/Camera 1.*?facing.*?front/i)
  if (backM)  cameras.push('Rear camera')
  if (frontM) cameras.push('Front camera')
  // Also check via camera2
  const ids = dump.match(/Camera\s+(\d+)\s+/g)
  if (!cameras.length && ids) {
    cameras.push(`${ids.length} camera(s) detected`)
  }
  return cameras
}

// ─── ANDROID: security (MDM/FRP) ────────────────────────────────────────────
function androidSecurity() {
  const dpm         = adb('shell dpm list-owners 2>nul')
  const provisioned = adb('shell settings get global device_provisioned')
  const pkgs        = adb('shell pm list packages')
  const mdmKeywords = ['mobileiron','airwatch','jamf','meraki','citrix','soti','intune','knox.manage','mdm','vmware']
  const mdmFound    = mdmKeywords.filter(k => pkgs.toLowerCase().includes(k))

  return {
    frp_status:   'clean',      // ADB connection proves no FRP lock
    frp_note:     provisioned === '1' ? 'Device provisioned — no FRP detected' : 'Provisioning state unknown',
    mdm_status:   (dpm.includes('componentInfo=') || mdmFound.length > 0) ? 'supervised' : 'clean',
    mdm_packages: mdmFound.length > 0 ? mdmFound.join(', ') : null,
  }
}

// ─── FULL ANDROID DETECTION ──────────────────────────────────────────────────
function detectAndroid() {
  adb('start-server')
  const devices = adb('devices')
  const lines   = devices.split('\n').slice(1).filter(l => l.includes('\tdevice'))
  if (lines.length === 0) return null

  // Check if any device is in "unauthorized" state
  const unauthorized = devices.split('\n').slice(1).filter(l => l.includes('\tunauthorized'))
  if (unauthorized.length > 0 && lines.length === 0) {
    return { _error: 'Device connected but unauthorized. Check your phone and tap "Allow USB debugging".' }
  }

  const basic    = androidBasic()
  const battery  = androidBattery()
  const display  = androidDisplay()
  const storage  = androidStorage()
  const conn     = androidConnectivity()
  const sensors  = androidSensors()
  const cameras  = androidCameras()
  const security = androidSecurity()

  return {
    platform:     'android',
    manufacturer: basic.manufacturer || null,
    model:        basic.model        || null,
    device_name:  basic.deviceName   || null,
    os_version:   basic.osVersion ? `Android ${basic.osVersion}` : null,
    serial_number:basic.serial       || null,
    android_id:   basic.androidId    || null,
    imei:         basic.imei,
    imei2:        basic.imei2,
    // Battery
    battery_health:       battery.level,
    battery_health_label: battery.health,
    battery_status:       battery.status,
    battery_temperature:  battery.temperature,
    battery_voltage:      battery.voltage,
    battery_technology:   battery.technology,
    // Display
    display_resolution: display.resolution,
    display_density:    display.density,
    display_refresh:    display.refresh_rate,
    // Storage / RAM
    ...storage,
    // Connectivity
    ...conn,
    // Hardware
    sensors,
    cameras,
    // Security
    ...security,
  }
}

// ─── iOS BASIC DETECTION via PowerShell (no ideviceinfo needed) ─────────────
// Detects iPhone/iPad presence via Windows PnP device list (requires iTunes driver)
function detectiOSbasic() {
  try {
    const ps = run(
      `powershell -NoProfile -Command "Get-PnpDevice | Where-Object {$_.Present -eq $true -and ($_.FriendlyName -like '*Apple*' -or $_.FriendlyName -like '*iPhone*' -or $_.FriendlyName -like '*iPad*')} | Select-Object FriendlyName,Status | ConvertTo-Json -Compress"`,
      6000
    )
    if (!ps || ps.trim() === '' || ps.includes('error')) return null
    const raw  = ps.trim().startsWith('[') ? JSON.parse(ps) : [JSON.parse(ps)]
    const devs = raw.filter((d) => d && d.FriendlyName)
    if (devs.length === 0) return null
    const name = devs[0].FriendlyName
    const isIpad = name.toLowerCase().includes('ipad')
    return {
      platform:     isIpad ? 'ios' : 'ios',
      manufacturer: 'Apple',
      model:        null,
      device_name:  name,
      os_version:   null,
      serial_number:null,
      imei:         null,
      udid:         null,
      battery_health: null,
      activation_state: 'unknown',
      icloud_status: 'unknown',
      mdm_status:   'unknown',
      frp_status:   'unknown',
      _basic:       true,  // flag: full ideviceinfo not available
      _hint:        'Basic detection only. Run setup.bat to install ideviceinfo for full diagnostics.',
    }
  } catch {
    return null
  }
}

// ─── FULL iOS DETECTION via pymobiledevice3 (Python) ─────────────────────────
function detectiOS() {
  if (!PYTHON || !fs.existsSync(QUERY_IOS)) return null
  try {
    // PYTHON may be "py -3.12" (cmd + arg), so don't quote the whole thing
    const out = execSync(`${PYTHON} "${QUERY_IOS}" 2>&1`, {
      timeout: TIMEOUT,
      encoding: 'utf8',
      shell: true,
    }).trim()
    if (!out) return null
    const data = JSON.parse(out)
    if (data.error) {
      console.log(`  iOS query error: ${data.error}`)
      return null
    }
    return data
  } catch (e) {
    // Log full stderr so we can diagnose
    const msg = (e.stderr || e.message || '').toString().slice(0, 500)
    console.log(`  iOS Python error:\n${msg}`)
    return null
  }
}

// ─── Legacy ideviceinfo detection (fallback if ideviceinfo.exe present) ──────
function detectiOSlegacy() {
  if (!IDEV) return null
  const udid = idev('-k UniqueDeviceID')
  if (!udid || udid.length < 10 || udid.toLowerCase().includes('error')) return null
  const imei = idev('-k InternationalMobileEquipmentIdentity')
  const activationState = idev('-k ActivationState')
  return {
    platform: 'ios', manufacturer: 'Apple',
    model:         idev('-k ProductType')        || null,
    device_name:   idev('-k DeviceName')         || null,
    os_version:    idev('-k ProductVersion') ? `iOS ${idev('-k ProductVersion')}` : null,
    serial_number: idev('-k SerialNumber')        || null,
    imei:          imei && /^\d{14,15}$/.test(imei) ? imei : null,
    udid,
    battery_health: idev('-k BatteryCurrentCapacity') ? parseInt(idev('-k BatteryCurrentCapacity')) : null,
    activation_state: activationState || null,
    icloud_status: activationState === 'Activated' ? 'clean' : activationState === 'Unactivated' ? 'locked' : 'unknown',
    mdm_status:    idev('-k IsSupervised') === 'true' ? 'supervised' : 'clean',
    wifi_mac:      idev('-k WiFiAddress') || null,
    bluetooth_mac: idev('-k BluetoothAddress') || null,
    frp_status:    'unknown',
  }
}

// ─── SETUP DIAGNOSTICS ───────────────────────────────────────────────────────
function getDiagnostics() {
  const adbOk  = !!ADB
  const idevOk = !!IDEV

  let androidDevices = []
  let iosDevices     = []
  let adbError       = null

  if (adbOk) {
    try {
      adb('start-server')
      const devOut = adb('devices')
      const lines  = devOut.split('\n').slice(1).filter(l => l.trim())
      for (const line of lines) {
        if (line.includes('\tdevice'))       androidDevices.push({ serial: line.split('\t')[0], status: 'authorized' })
        if (line.includes('\tunauthorized')) androidDevices.push({ serial: line.split('\t')[0], status: 'unauthorized' })
        if (line.includes('\toffline'))      androidDevices.push({ serial: line.split('\t')[0], status: 'offline' })
      }
    } catch (e) {
      adbError = e.message
    }
  }

  if (idevOk) {
    const udid = idev('-k UniqueDeviceID')
    if (udid && udid.length > 10 && !udid.includes('error')) {
      iosDevices.push({ udid, name: idev('-k DeviceName') || 'iPhone' })
    }
  }

  return {
    ok: true,
    adb:  { found: adbOk,  path: ADB  || null, error: adbError, devices: androidDevices },
    idev: { found: idevOk, path: IDEV || null, devices: iosDevices },
    setup_needed: !adbOk || !idevOk,
    instructions: {
      android: adbOk
        ? (androidDevices.length === 0
          ? 'ADB found but no Android device detected. Connect via USB and enable USB Debugging (Settings → Developer Options).'
          : androidDevices.some(d => d.status === 'unauthorized')
          ? 'Device connected — check your phone and tap "Allow USB Debugging".'
          : null)
        : 'ADB not found. Place adb.exe in local-agent/platform-tools/ or run: node setup.js',
      iphone: idevOk
        ? (iosDevices.length === 0
          ? 'ideviceinfo found but no iPhone detected. Connect via USB and tap "Trust This Computer" on the phone.'
          : null)
        : 'ideviceinfo not found. Download libimobiledevice for Windows and place ideviceinfo.exe in the local-agent folder.',
    },
    port: PORT,
  }
}

// ─── HTTP SERVER ──────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  setCORS(res)
  res.setHeader('Content-Type', 'application/json')

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  const url = req.url?.split('?')[0]
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${url}`)

  // ── GET /status ──────────────────────────────────────────────────────────
  if (url === '/status') {
    res.writeHead(200)
    res.end(JSON.stringify({ ok: true, adb: !!ADB, ideviceinfo: !!IDEV, port: PORT, version: 2 }))
    return
  }

  // ── GET /setup ────────────────────────────────────────────────────────────
  if (url === '/setup') {
    res.writeHead(200)
    res.end(JSON.stringify(getDiagnostics()))
    return
  }

  // ── GET /device ───────────────────────────────────────────────────────────
  if (url === '/device') {
    // Try Android first
    const android = detectAndroid()
    if (android) {
      if (android._error) {
        res.writeHead(404)
        res.end(JSON.stringify({ error: android._error, hints: ['Check your phone screen and tap "Allow USB Debugging".'] }))
        return
      }
      console.log(`  → Android: ${android.manufacturer} ${android.model}`)
      res.writeHead(200)
      res.end(JSON.stringify(android))
      return
    }

    // Try iOS via pymobiledevice3 (Python) — most reliable, supports iOS 16/17/18
    const ios = detectiOS() || detectiOSlegacy()
    if (ios) {
      console.log(`  → iOS: ${ios.device_name} (${ios.model})`)
      res.writeHead(200)
      res.end(JSON.stringify(ios))
      return
    }

    // Try iOS basic (PowerShell PnP — no ideviceinfo needed)
    const iosBasic = detectiOSbasic()
    if (iosBasic) {
      console.log(`  → iOS (basic): ${iosBasic.device_name}`)
      res.writeHead(200)
      res.end(JSON.stringify(iosBasic))
      return
    }

    // Nothing found — give detailed hints
    const diag = getDiagnostics()
    const hints = []
    if (!diag.adb.found)  hints.push('Android: ADB not found. Run node setup.js or place adb.exe in local-agent/platform-tools/')
    if (!diag.idev.found) hints.push('iPhone: ideviceinfo not found. See local-agent folder for setup instructions.')
    if (diag.adb.found  && diag.adb.devices.length === 0)  hints.push('Android: ADB found but no device connected. Enable USB Debugging and connect the cable.')
    if (diag.idev.found && diag.idev.devices.length === 0) hints.push('iPhone: ideviceinfo found but no device. Connect cable and tap "Trust This Computer".')
    if (diag.adb.devices.some(d => d.status === 'unauthorized')) hints.push('Android: Device is connected but not authorized — tap "Allow USB Debugging" on the phone.')

    res.writeHead(404)
    res.end(JSON.stringify({ error: 'No device detected.', diagnostics: diag, hints }))
    return
  }

  res.writeHead(404)
  res.end(JSON.stringify({ error: 'Unknown endpoint. Use /device, /status, or /setup.' }))
})

// ─── STARTUP ──────────────────────────────────────────────────────────────────
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('  404Fixed Local Device Bridge v2')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log(`  ADB (Android):    ${ADB    ? '✓ found' : '✗  Not found — run setup.bat'}`)
console.log(`  Python+pymobile:  ${PYTHON ? '✓ found' : '✗  Not found — run setup.bat'}`)
console.log(`  ideviceinfo:      ${IDEV   ? '✓ found' : '–  Not needed if Python is present'}`)
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

if (!ADB && !PYTHON) {
  console.log('\n  ⚠  Run setup.bat to install required tools.\n')
} else if (!PYTHON && !IDEV) {
  console.log('\n  ⚠  iPhone support not available. Run setup.bat to install Python + pymobiledevice3.\n')
}

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  ✓  Listening on http://localhost:${PORT}`)
  console.log('  Keep this window open while using Phone Check.\n')
  if (ADB) {
    // Start ADB server in background
    try { require('child_process').spawn(ADB, ['start-server'], { stdio: 'ignore', detached: true }) } catch {}
  }
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n✗ Port ${PORT} already in use — bridge may already be running.\n`)
  } else {
    console.error('Server error:', err)
  }
  process.exit(1)
})
