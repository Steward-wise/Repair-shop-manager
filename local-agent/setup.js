/**
 * 404Fixed Device Bridge — Auto Setup
 * Downloads adb.exe (Android) and ideviceinfo.exe (iPhone) automatically.
 *
 * Run: node setup.js
 * Or double-click: setup.bat
 */

const https  = require('https')
const http   = require('http')
const fs     = require('fs')
const path   = require('path')
const { execSync } = require('child_process')

const DIR = __dirname

function log(msg)  { process.stdout.write(msg + '\n') }
function ok(msg)   { log('  ✓ ' + msg) }
function err(msg)  { log('  ✗ ' + msg) }
function info(msg) { log('  → ' + msg) }

// Download a URL to a file, follow redirects
function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    const proto = url.startsWith('https') ? https : http
    function get(u) {
      proto.get(u, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
          file.destroy()
          get(res.headers.location)
          return
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${u}`))
          return
        }
        res.pipe(file)
        file.on('finish', () => { file.close(); resolve() })
      }).on('error', reject)
    }
    get(url)
  })
}

// Unzip using PowerShell (available on all Windows 10+)
function unzip(zipPath, destDir) {
  execSync(`powershell -command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`, { stdio: 'ignore' })
}

async function setupAdb() {
  const ptDir  = path.join(DIR, 'platform-tools')
  const adbExe = path.join(ptDir, 'adb.exe')

  if (fs.existsSync(adbExe)) {
    ok('adb.exe already present')
    return true
  }

  log('\n[Android] Downloading platform-tools (ADB)...')
  info('Source: https://dl.google.com/android/repository/platform-tools-latest-windows.zip')

  const zipPath = path.join(DIR, '_pt.zip')
  try {
    await download('https://dl.google.com/android/repository/platform-tools-latest-windows.zip', zipPath)
    info('Extracting...')
    unzip(zipPath, DIR)
    fs.unlinkSync(zipPath)
    if (fs.existsSync(adbExe)) {
      ok('adb.exe installed → ' + adbExe)
      return true
    } else {
      err('Extraction failed — adb.exe not found after unzip')
      return false
    }
  } catch (e) {
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath)
    err('Failed to download ADB: ' + e.message)
    log('\n  Manual install:')
    log('  1. Download: https://developer.android.com/tools/releases/platform-tools')
    log('  2. Extract adb.exe into: ' + ptDir)
    return false
  }
}

async function setupIdeviceinfo() {
  const exe = path.join(DIR, 'ideviceinfo.exe')

  if (fs.existsSync(exe)) {
    ok('ideviceinfo.exe already present')
    return true
  }

  log('\n[iPhone] Downloading libimobiledevice tools...')

  // Try to get the latest release from GitHub
  const releasesUrl = 'https://api.github.com/repos/imobiledevice-win32/imobiledevice-net/releases/latest'
  info('Checking latest release from GitHub...')

  try {
    // Get release info
    const releaseJson = await new Promise((resolve, reject) => {
      https.get(releasesUrl, {
        headers: { 'User-Agent': '404fixed-setup' }
      }, (res) => {
        let data = ''
        res.on('data', c => data += c)
        res.on('end', () => {
          try { resolve(JSON.parse(data)) } catch { reject(new Error('Invalid JSON')) }
        })
      }).on('error', reject)
    })

    // Find a Windows x64 zip
    const assets = releaseJson.assets || []
    const zipAsset = assets.find(a =>
      a.name.toLowerCase().includes('win') &&
      a.name.toLowerCase().includes('x64') &&
      a.name.endsWith('.zip')
    ) || assets.find(a => a.name.endsWith('.zip'))

    if (!zipAsset) {
      throw new Error('No Windows zip found in release assets')
    }

    info(`Downloading: ${zipAsset.name}`)
    const zipPath = path.join(DIR, '_idev.zip')
    await download(zipAsset.browser_download_url, zipPath)

    info('Extracting...')
    const extractDir = path.join(DIR, '_idev_tmp')
    fs.mkdirSync(extractDir, { recursive: true })
    unzip(zipPath, extractDir)
    fs.unlinkSync(zipPath)

    // Find ideviceinfo.exe recursively
    function findFile(dir, name) {
      for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        if (f.isDirectory()) {
          const r = findFile(path.join(dir, f.name), name)
          if (r) return r
        } else if (f.name.toLowerCase() === name.toLowerCase()) {
          return path.join(dir, f.name)
        }
      }
      return null
    }

    const found = findFile(extractDir, 'ideviceinfo.exe')
    if (found) {
      // Copy all .exe and .dll files to DIR
      function copyDir(src) {
        for (const f of fs.readdirSync(src, { withFileTypes: true })) {
          const full = path.join(src, f.name)
          if (f.isDirectory()) {
            copyDir(full)
          } else if (f.name.endsWith('.exe') || f.name.endsWith('.dll')) {
            fs.copyFileSync(full, path.join(DIR, f.name))
          }
        }
      }
      copyDir(extractDir)
      fs.rmSync(extractDir, { recursive: true, force: true })

      if (fs.existsSync(exe)) {
        ok('ideviceinfo.exe installed → ' + exe)
        return true
      }
    }

    fs.rmSync(extractDir, { recursive: true, force: true })
    throw new Error('ideviceinfo.exe not found after extraction')

  } catch (e) {
    err('Automatic download failed: ' + e.message)
    log('\n  Manual install:')
    log('  1. Go to: https://github.com/imobiledevice-win32/imobiledevice-net/releases')
    log('  2. Download the latest Windows x64 zip')
    log('  3. Extract ideviceinfo.exe (and all .dll files) into:')
    log('     ' + DIR)
    log('\n  Alternative: Install iTunes from https://www.apple.com/itunes/')
    log('  iTunes installs the Apple Mobile Device driver needed for iPhone detection.')
    return false
  }
}

async function main() {
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  log('  404Fixed Device Bridge — Setup')
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const adbOk  = await setupAdb()
  const idevOk = await setupIdeviceinfo()

  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  log(`  ADB (Android):    ${adbOk  ? '✓ Ready' : '✗ Not installed'}`)
  log(`  ideviceinfo (iPhone): ${idevOk ? '✓ Ready' : '✗ Not installed'}`)
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  if (adbOk || idevOk) {
    log('\n  ✓ Setup complete! Run start.bat to launch the bridge.\n')
  } else {
    log('\n  ⚠ Setup incomplete. See manual install instructions above.\n')
  }
}

main().catch(e => {
  err('Setup failed: ' + e.message)
  process.exit(1)
})
