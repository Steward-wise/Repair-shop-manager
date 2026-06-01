/**
 * 404Fixed Device Bridge — Auto Setup
 * Sets up ADB (Android) and pymobiledevice3 (iPhone).
 *
 * Run: node setup.js
 * Or double-click: setup.bat
 */

const https  = require('https')
const http   = require('http')
const fs     = require('fs')
const path   = require('path')
const { execSync, spawnSync } = require('child_process')

const DIR = __dirname

function log(msg)  { process.stdout.write(msg + '\n') }
function ok(msg)   { log('  ✓ ' + msg) }
function fail(msg) { log('  ✗ ' + msg) }
function info(msg) { log('  → ' + msg) }

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore','pipe','pipe'], shell: true }).trim()
  } catch { return '' }
}

// Download with redirect following
function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    const proto = url.startsWith('https') ? https : http
    function get(u) {
      const mod = u.startsWith('https') ? https : http
      mod.get(u, { headers: { 'User-Agent': '404fixed-setup' } }, (res) => {
        if ([301,302,307,308].includes(res.statusCode)) {
          file.destroy(); fs.unlinkSync(dest); return get(res.headers.location)
        }
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`))
        res.pipe(file)
        file.on('finish', () => { file.close(); resolve() })
      }).on('error', reject)
    }
    get(url)
  })
}

function unzip(zipPath, destDir) {
  execSync(`powershell -NoProfile -command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`, { stdio: 'ignore' })
}

// ── ADB ──────────────────────────────────────────────────────────────────────
async function setupAdb() {
  const adbExe = path.join(DIR, 'platform-tools', 'adb.exe')
  if (fs.existsSync(adbExe)) { ok('adb.exe already installed'); return true }

  log('\n[1/2] Downloading Android platform-tools (adb)...')
  const zipPath = path.join(DIR, '_pt.zip')
  try {
    await download('https://dl.google.com/android/repository/platform-tools-latest-windows.zip', zipPath)
    info('Extracting...')
    unzip(zipPath, DIR)
    fs.unlinkSync(zipPath)
    if (fs.existsSync(adbExe)) { ok('adb.exe installed'); return true }
    fail('Extraction failed')
    return false
  } catch (e) {
    if (fs.existsSync(zipPath)) try { fs.unlinkSync(zipPath) } catch {}
    fail('Download failed: ' + e.message)
    log('\n  Manual: download from https://developer.android.com/tools/releases/platform-tools')
    log('  Extract adb.exe into: ' + path.join(DIR, 'platform-tools'))
    return false
  }
}

// ── Python + pymobiledevice3 ─────────────────────────────────────────────────
function findPython() {
  for (const cmd of ['python', 'python3', 'py']) {
    const r = spawnSync(cmd, ['--version'], { timeout: 5000, stdio: 'pipe', shell: true })
    if (r.status === 0) {
      const v = (r.stdout || r.stderr || '').toString().trim()
      if (v.includes('3.')) return { cmd, version: v }
    }
  }
  return null
}

async function setupPymobiledevice() {
  log('\n[2/2] Setting up iPhone support (pymobiledevice3)...')

  const py = findPython()
  if (!py) {
    fail('Python 3 not found.')
    log('\n  iPhone detection requires Python 3. Install it from:')
    log('  https://www.python.org/downloads/windows/')
    log('  Tick "Add Python to PATH" during install, then re-run setup.bat\n')
    return false
  }
  ok(`Python found: ${py.version} (${py.cmd})`)

  // Check if already installed
  const check = run(`${py.cmd} -c "import pymobiledevice3; print('ok')"`)
  if (check === 'ok') { ok('pymobiledevice3 already installed'); return true }

  info('Installing pymobiledevice3 via pip...')
  try {
    execSync(`${py.cmd} -m pip install --upgrade pymobiledevice3`, {
      stdio: 'inherit',
      shell: true,
      timeout: 120000,
    })
    const verify = run(`${py.cmd} -c "import pymobiledevice3; print('ok')"`)
    if (verify === 'ok') { ok('pymobiledevice3 installed successfully'); return true }
    fail('Installation appeared to succeed but import failed')
    return false
  } catch (e) {
    fail('pip install failed: ' + e.message)
    log('\n  Try manually: ' + py.cmd + ' -m pip install pymobiledevice3\n')
    return false
  }
}

// ── Store Python command for the bridge to use ───────────────────────────────
function savePythonCmd(pyCmd) {
  fs.writeFileSync(path.join(DIR, '.python_cmd'), pyCmd, 'utf8')
}

async function main() {
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  log('  404Fixed Device Bridge — Setup')
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const adbOk  = await setupAdb()
  const pyOk   = await setupPymobiledevice()

  // Save python command so server.js can find it
  if (pyOk) {
    const py = findPython()
    if (py) savePythonCmd(py.cmd)
  }

  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  log(`  ADB (Android):        ${adbOk ? '✓ Ready' : '✗ Not installed'}`)
  log(`  pymobiledevice3 (iPhone): ${pyOk ? '✓ Ready' : '✗ Not installed'}`)
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  if (adbOk || pyOk) {
    log('  ✓ Setup complete! Run start.bat to launch the bridge.\n')
  } else {
    log('  ⚠ Setup incomplete. See instructions above.\n')
  }
}

main().catch(e => { fail('Setup error: ' + e.message); process.exit(1) })
