'use client'

import { useEffect, useState, useCallback, useRef, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { PhoneCheck } from '@/types'
import { type TestItem, ALL_TESTS, buildDefaultTests, calcGrade, GRADE_COLORS } from '@/lib/phone-tests'

type SecurityStatus = 'clean' | 'locked' | 'supervised' | 'blacklisted' | 'unknown'

const SEC_BADGE: Record<string, string> = {
  clean:      'bg-green-900/40 text-green-300 border-green-700',
  locked:     'bg-red-900/40 text-red-300 border-red-700',
  supervised: 'bg-yellow-900/40 text-yellow-300 border-yellow-700',
  blacklisted:'bg-red-900/40 text-red-300 border-red-700',
  unknown:    'bg-zinc-800 text-zinc-400 border-zinc-700',
}
const SEC_LABEL: Record<string, string> = {
  clean: 'Clean', locked: 'Locked', supervised: 'Supervised', blacklisted: 'Blacklisted', unknown: 'Unknown',
}
const CAT_LABELS: Record<string, string> = {
  security: '🔒 Security', hardware: '🔧 Hardware', connectivity: '📡 Connectivity', condition: '🔍 Condition',
}
const CAT_ORDER = ['security', 'hardware', 'connectivity', 'condition']

function SecBadge({ status, label }: { status: string; label: string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <span className="text-xs text-zinc-400">{label}</span>
      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${SEC_BADGE[status] ?? SEC_BADGE.unknown}`}>
        {SEC_LABEL[status] ?? status}
      </span>
    </div>
  )
}

function HardwarePanel({ hw, batteryHealth }: { hw: Record<string, unknown> | null; batteryHealth: number | null }) {
  const h = hw ?? {}

  type Row = { label: string; value: string; colour?: string }
  const rows: Row[] = []

  // Battery health — prefer hw value, fall back to top-level batteryHealth
  const bh = (h.battery_health as number | null) ?? batteryHealth
  const bhColour = bh == null ? '' : bh >= 80 ? 'text-green-400' : bh >= 60 ? 'text-yellow-400' : 'text-red-400'
  if (bh != null) rows.push({ label: 'Battery Health', value: `${bh}%${h.battery_health_label ? ` — ${h.battery_health_label}` : ''}`, colour: bhColour })
  if (h.battery_current != null) rows.push({ label: 'Charge Level', value: `${h.battery_current}%` })
  if (h.battery_cycles != null)  rows.push({ label: 'Cycle Count',  value: String(h.battery_cycles) })
  if (h.battery_temperature != null) rows.push({ label: 'Batt Temp', value: `${h.battery_temperature}°C` })
  if (h.battery_voltage != null)     rows.push({ label: 'Voltage',   value: `${h.battery_voltage}mV` })

  if (h.storage_total) rows.push({ label: 'Storage', value: `${h.storage_total}${h.storage_available ? ` (${h.storage_available} free)` : ''}` })
  if (h.ram_total)     rows.push({ label: 'RAM',     value: `${h.ram_total}${h.ram_available ? ` (${h.ram_available} free)` : ''}` })

  if (h.display_resolution) {
    const parts = [h.display_resolution, h.display_density ? `${h.display_density}dpi` : null, h.display_refresh ? `${h.display_refresh}Hz` : null].filter(Boolean)
    rows.push({ label: 'Display', value: parts.join(' · ') as string })
  }
  if (h.cpu_arch)       rows.push({ label: 'CPU Arch',   value: String(h.cpu_arch) })
  if (h.wifi_mac)       rows.push({ label: 'WiFi MAC',   value: String(h.wifi_mac) })
  if (h.bluetooth_mac)  rows.push({ label: 'BT MAC',     value: String(h.bluetooth_mac) })
  if (h.phone_number)   rows.push({ label: 'Phone No.',  value: String(h.phone_number) })
  if (h.region)         rows.push({ label: 'Region',     value: String(h.region) })
  if (Array.isArray(h.cameras) && h.cameras.length > 0)
    rows.push({ label: 'Cameras', value: (h.cameras as string[]).join(', ') })
  if (Array.isArray(h.sensors) && h.sensors.length > 0)
    rows.push({ label: 'Sensors', value: (h.sensors as string[]).slice(0, 6).join(', ') })

  if (rows.length === 0) return null

  return (
    <div className="pt-2 border-t border-zinc-800">
      <p className="text-xs font-semibold text-zinc-400 mb-2">📊 Hardware Details</p>
      <dl className="space-y-1.5">
        {rows.map(r => (
          <div key={r.label} className="flex justify-between gap-2">
            <dt className="text-xs text-zinc-500 flex-shrink-0">{r.label}</dt>
            <dd className={`text-xs text-right truncate max-w-[160px] ${r.colour ?? 'text-fg'}`}>{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function fmtTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

export default function PhoneCheckPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [check, setCheck] = useState<PhoneCheck | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [detectError, setDetectError] = useState('')
  const [setupDiag, setSetupDiag] = useState<Record<string, unknown> | null>(null)
  const [imeiChecking, setImeiChecking] = useState(false)
  const [imeiResult, setImeiResult] = useState<Record<string, unknown> | null>(null)
  const [tests, setTests] = useState<TestItem[]>([])
  const [expandedNote, setExpandedNote] = useState<string | null>(null)
  const [jobs, setJobs] = useState<{ id: string; ticket_number: number; title: string }[]>([])
  const [completing, setCompleting] = useState(false)

  // Manual device entry
  const [manualMode, setManualMode] = useState(false)
  const [manualForm, setManualForm] = useState({ imei: '', model: '', manufacturer: '', platform: 'unknown' as string })

  // Webcam
  const videoRef = useRef<HTMLVideoElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [recording, setRecording] = useState(false)
  const [recordSecs, setRecordSecs] = useState(0)
  const [videoReady, setVideoReady] = useState(false)
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [camError, setCamError] = useState('')
  const [cameraOn, setCameraOn] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/phone-check/${id}`)
    const json = await res.json()
    if (json.check) {
      setCheck(json.check)
      // Merge saved tests with any new default tests (in case defaults changed)
      const saved = (json.check.tests ?? []) as TestItem[]
      const savedIds = new Set(saved.map((t: TestItem) => t.id))
      const merged = [
        ...saved,
        ...buildDefaultTests(json.check.platform).filter(t => !savedIds.has(t.id)),
      ]
      setTests(merged)
    }
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    // Load recent jobs for attachment
    fetch('/api/jobs?limit=50').then(r => r.json()).then(j => setJobs(j.jobs ?? []))
  }, [])

  // ── Auto-save tests whenever they change ──────────────────
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  function schedSave(newTests: TestItem[]) {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      await fetch(`/api/phone-check/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tests: newTests }),
      })
    }, 800)
  }

  function setTestResult(testId: string, result: TestItem['result']) {
    setTests(prev => {
      const next = prev.map(t => t.id === testId ? { ...t, result } : t)
      schedSave(next)
      return next
    })
  }
  function setTestNote(testId: string, notes: string) {
    setTests(prev => {
      const next = prev.map(t => t.id === testId ? { ...t, notes } : t)
      schedSave(next)
      return next
    })
  }
  function toggleTestSelected(testId: string) {
    setTests(prev => {
      const next = prev.map(t => t.id === testId ? { ...t, selected: !t.selected } : t)
      schedSave(next)
      return next
    })
  }
  function toggleAll(on: boolean) {
    setTests(prev => {
      const next = prev.map(t => ({ ...t, selected: on }))
      schedSave(next)
      return next
    })
  }

  // ── Device detection ──────────────────────────────────────
  async function detectDevice() {
    setDetecting(true)
    setDetectError('')
    try {
      // Try local bridge first (phone plugged into this computer)
      // Falls back to Pi server API (phone plugged into Pi)
      let res: Response | null = null
      let source = 'local'
      try {
        res = await fetch('http://localhost:7777/device', { signal: AbortSignal.timeout(3000) })
      } catch {
        // Local bridge not running — fall back to server
        source = 'server'
        res = await fetch('/api/phone-check/device')
      }
      const json = await res.json()
      if (!res.ok) {
        setDetectError(json.error ?? 'Detection failed')
        // Fetch setup diagnostics from local bridge to show helpful info
        if (source === 'local') {
          try {
            const diagRes = await fetch('http://localhost:7777/setup', { signal: AbortSignal.timeout(3000) })
            const diag = await diagRes.json()
            setSetupDiag(diag)
          } catch {}
        } else {
          setDetectError((json.error ?? 'Detection failed') + '\n\nTip: Run local-agent/start.bat on this computer to detect phones plugged in here.')
        }
        setManualMode(true)
        return
      }
      setSetupDiag(null)
      // Apply detected info to check record
      const patch: Record<string, unknown> = {
        platform:      json.platform      ?? null,
        manufacturer:  json.manufacturer  ?? null,
        model:         json.model         ?? null,
        device_name:   json.device_name   ?? null,
        os_version:    json.os_version    ?? null,
        serial_number: json.serial_number ?? null,
        imei:          json.imei          ?? null,
        imei2:         json.imei2         ?? null,
        udid:          json.udid          ?? null,
        battery_health: json.battery_health ?? null,
        frp_status:    json.frp_status    ?? 'unknown',
        mdm_status:    json.mdm_status    ?? 'unknown',
        icloud_status: json.icloud_status ?? 'unknown',
        // Store all extended hardware data in dedicated jsonb column
        hardware_info: {
          battery_health_label: json.battery_health_label ?? null,
          battery_current:      json.battery_current      ?? null,
          battery_cycles:       json.battery_cycles       ?? null,
          battery_temperature:  json.battery_temperature  ?? null,
          battery_voltage:      json.battery_voltage      ?? null,
          display_resolution:   json.display_resolution   ?? null,
          display_density:      json.display_density      ?? null,
          display_refresh:      json.display_refresh      ?? null,
          ram_total:            json.ram_total            ?? null,
          ram_available:        json.ram_available        ?? null,
          storage_total:        json.storage_total        ?? null,
          storage_available:    json.storage_available    ?? null,
          wifi_mac:             json.wifi_mac             ?? null,
          bluetooth_mac:        json.bluetooth_mac        ?? null,
          wifi_enabled:         json.wifi_enabled         ?? null,
          bluetooth_enabled:    json.bluetooth_enabled    ?? null,
          sensors:              json.sensors              ?? null,
          cameras:              json.cameras              ?? null,
          cpu_arch:             json.cpu_arch             ?? null,
          android_id:           json.android_id           ?? null,
          phone_number:         json.phone_number         ?? null,
          region:               json.region               ?? null,
          device_color:         json.device_color         ?? null,
        },
      }
      const pRes = await fetch(`/api/phone-check/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const pJson = await pRes.json()
      if (pJson.check) {
        setCheck(pJson.check)
        // Rebuild tests with new platform
        const cur = tests.length ? tests : buildDefaultTests(json.platform)
        setTests(cur)
        // Auto-apply security results to tests
        const secUpdated = cur.map(t => {
          if (t.id === 'frp' && json.frp_status) return { ...t, result: json.frp_status === 'clean' ? 'pass' as const : json.frp_status === 'locked' ? 'fail' as const : t.result, value: json.frp_note ?? '' }
          if (t.id === 'mdm' && json.mdm_status) return { ...t, result: json.mdm_status === 'clean' ? 'pass' as const : json.mdm_status === 'supervised' ? 'fail' as const : t.result }
          if (t.id === 'icloud' && json.icloud_status) return { ...t, result: json.icloud_status === 'clean' ? 'pass' as const : json.icloud_status === 'locked' ? 'fail' as const : t.result }
          if (t.id === 'battery_health' && json.battery_health != null) return { ...t, result: json.battery_health >= 80 ? 'pass' as const : 'fail' as const, value: `${json.battery_health}% (${json.battery_health_label ?? ''})` }
          return t
        })
        setTests(secUpdated)
        schedSave(secUpdated)
      }
    } finally {
      setDetecting(false)
    }
  }

  async function applyManual() {
    const patch: Record<string, unknown> = {
      platform: manualForm.platform,
      imei: manualForm.imei || null,
      model: manualForm.model || null,
      manufacturer: manualForm.manufacturer || null,
    }
    const res = await fetch(`/api/phone-check/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const json = await res.json()
    if (json.check) {
      setCheck(json.check)
      setManualMode(false)
    }
  }

  // ── IMEI blacklist check ──────────────────────────────────
  async function checkImei() {
    const imei = check?.imei
    if (!imei) return
    setImeiChecking(true)
    setImeiResult(null)
    const res = await fetch(`/api/phone-check/imei?imei=${imei}`)
    const json = await res.json()
    setImeiResult(json)

    // Update check record + blacklist test
    const status: string = json.manual ? 'unknown' : json.blacklisted ? 'blacklisted' : 'clean'
    await fetch(`/api/phone-check/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blacklist_status: status, blacklist_data: json }),
    })
    setCheck(prev => prev ? { ...prev, blacklist_status: status, blacklist_data: json } : prev)

    if (!json.manual) {
      setTests(prev => {
        const next = prev.map(t => t.id === 'imei_blacklist' ? { ...t, result: status === 'clean' ? 'pass' as const : status === 'blacklisted' ? 'fail' as const : t.result, value: json.carrier ? `Carrier: ${json.carrier}` : '' } : t)
        schedSave(next)
        return next
      })
    }
    setImeiChecking(false)
  }

  // ── Webcam ────────────────────────────────────────────────
  async function startCamera() {
    setCamError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: true })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
      setCameraOn(true)
    } catch (e) {
      setCamError(`Camera error: ${e instanceof Error ? e.message : 'Permission denied'}`)
    }
  }

  function stopCamera() {
    if (recording) stopRecording()
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraOn(false)
  }

  function startRecording() {
    if (!streamRef.current) return
    chunksRef.current = []
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' : 'video/webm'
    const recorder = new MediaRecorder(streamRef.current, { mimeType })
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    recorder.onstop = () => { setVideoReady(true) }
    recorderRef.current = recorder
    recorder.start(1000)
    setRecording(true)
    setRecordSecs(0)
    timerRef.current = setInterval(() => setRecordSecs(s => s + 1), 1000)
  }

  function stopRecording() {
    recorderRef.current?.stop()
    if (timerRef.current) clearInterval(timerRef.current)
    setRecording(false)
  }

  async function uploadRecording() {
    if (!chunksRef.current.length) return
    setUploadingVideo(true)
    const blob = new Blob(chunksRef.current, { type: 'video/webm' })
    const fd = new FormData()
    fd.append('video', blob, 'recording.webm')
    const res = await fetch(`/api/phone-check/${id}/video`, { method: 'POST', body: fd })
    const json = await res.json()
    if (json.url) {
      setCheck(prev => prev ? { ...prev, video_url: json.url } : prev)
      setVideoReady(false)
    }
    setUploadingVideo(false)
  }

  // ── Complete check ────────────────────────────────────────
  async function completeCheck() {
    if (!check) return
    setCompleting(true)
    const grade = calcGrade(tests, check.blacklist_status, check.frp_status, check.icloud_status, check.mdm_status)
    await fetch(`/api/phone-check/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tests, grade, status: 'completed' }),
    })
    setCheck(prev => prev ? { ...prev, grade, status: 'completed' } : prev)
    setCompleting(false)
  }

  async function patchCheck(field: string, value: unknown) {
    setSaving(true)
    const res = await fetch(`/api/phone-check/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
    const json = await res.json()
    if (json.check) setCheck(json.check)
    setSaving(false)
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-zinc-500 text-sm">Loading…</div>
  if (!check) return <div className="flex items-center justify-center h-64 text-red-400 text-sm">Check not found</div>

  const selectedTests = tests.filter(t => t.selected)
  const doneTests = selectedTests.filter(t => t.result && t.result !== 'skip')
  const passTests = doneTests.filter(t => t.result === 'pass')
  const failTests = doneTests.filter(t => t.result === 'fail')

  const grouped = CAT_ORDER.reduce<Record<string, TestItem[]>>((acc, cat) => {
    acc[cat] = tests.filter(t => t.category === cat)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/phone-check" className="text-zinc-400 hover:text-fg transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-lg">{check.platform === 'ios' ? '🍎' : check.platform === 'android' ? '🤖' : '📱'}</span>
            <h1 className="text-xl font-bold text-fg">
              {check.device_name ?? check.model ?? 'Unknown Device'}
            </h1>
            {check.grade && (
              <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold border ${GRADE_COLORS[check.grade]}`}>
                {check.grade}
              </span>
            )}
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
              check.status === 'completed' ? 'bg-green-900/30 text-green-300 border-green-800' : 'bg-yellow-900/30 text-yellow-300 border-yellow-800'
            }`}>{check.status === 'completed' ? 'Completed' : 'In Progress'}</span>
            <span className="text-xs text-zinc-500 capitalize">{check.purpose}</span>
          </div>
          {check.imei && <p className="text-xs text-zinc-500 font-mono">IMEI: {check.imei}</p>}
        </div>
        {check.status !== 'completed' && (
          <button onClick={completeCheck} disabled={completing} className="btn-primary text-sm">
            {completing ? 'Saving…' : '✓ Complete Check'}
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="card py-3 px-4">
        <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
          <span>{doneTests.length} / {selectedTests.length} tests done</span>
          <span className="flex gap-3">
            <span className="text-green-400">{passTests.length} passed</span>
            {failTests.length > 0 && <span className="text-red-400">{failTests.length} failed</span>}
          </span>
        </div>
        <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          {selectedTests.length > 0 && (
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(doneTests.length / selectedTests.length) * 100}%` }} />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">

        {/* ── LEFT — Tests ─────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Test controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-zinc-400 font-medium">Tests:</span>
            <button onClick={() => toggleAll(true)} className="text-xs text-zinc-500 hover:text-fg border border-zinc-700 rounded px-2 py-1 transition-colors">Select All</button>
            <button onClick={() => toggleAll(false)} className="text-xs text-zinc-500 hover:text-fg border border-zinc-700 rounded px-2 py-1 transition-colors">Deselect All</button>
          </div>

          {/* Test categories */}
          {CAT_ORDER.map(cat => {
            const items = grouped[cat] ?? []
            if (items.length === 0) return null
            return (
              <div key={cat} className="card space-y-1 py-3 px-4">
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">{CAT_LABELS[cat]}</h3>
                {items.map(test => {
                  const def = ALL_TESTS.find(d => d.id === test.id)
                  const isNoteOpen = expandedNote === test.id
                  return (
                    <div key={test.id} className={`rounded-lg border transition-colors ${
                      !test.selected ? 'opacity-40 border-transparent' :
                      test.result === 'pass' ? 'border-green-800/50 bg-green-900/10' :
                      test.result === 'fail' ? 'border-red-800/50 bg-red-900/10' :
                      test.result === 'skip' ? 'border-zinc-700/30 bg-zinc-800/20' :
                      'border-zinc-800 bg-zinc-800/20'
                    }`}>
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          checked={test.selected}
                          onChange={() => toggleTestSelected(test.id)}
                          className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-primary cursor-pointer flex-shrink-0"
                        />

                        {/* Name */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-fg font-medium">{test.name}</span>
                            {def?.auto && (
                              <span className="text-xs text-zinc-500 border border-zinc-700 rounded px-1.5 py-0.5">auto</span>
                            )}
                            {test.value && (
                              <span className="text-xs text-zinc-400 font-mono">{test.value}</span>
                            )}
                          </div>
                          {isNoteOpen && (
                            <input
                              type="text"
                              placeholder="Add note…"
                              value={test.notes}
                              onChange={e => setTestNote(test.id, e.target.value)}
                              className="mt-1.5 w-full text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-300 focus:outline-none focus:ring-1 focus:ring-primary"
                              autoFocus
                            />
                          )}
                        </div>

                        {/* Result buttons */}
                        {test.selected && (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() => setTestResult(test.id, test.result === 'pass' ? null : 'pass')}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-colors ${
                                test.result === 'pass' ? 'bg-green-600 text-white' : 'bg-zinc-800 text-zinc-500 hover:bg-green-900/50 hover:text-green-400'
                              }`}
                              title="Pass"
                            >✓</button>
                            <button
                              onClick={() => setTestResult(test.id, test.result === 'fail' ? null : 'fail')}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-colors ${
                                test.result === 'fail' ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-500 hover:bg-red-900/50 hover:text-red-400'
                              }`}
                              title="Fail"
                            >✕</button>
                            <button
                              onClick={() => setTestResult(test.id, test.result === 'skip' ? null : 'skip')}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-colors ${
                                test.result === 'skip' ? 'bg-zinc-600 text-white' : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300'
                              }`}
                              title="N/A"
                            >—</button>
                            <button
                              onClick={() => setExpandedNote(isNoteOpen ? null : test.id)}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs transition-colors ${
                                test.notes ? 'text-yellow-400 bg-yellow-900/30' : 'text-zinc-600 hover:text-zinc-400 bg-zinc-800'
                              }`}
                              title="Add note"
                            >✏</button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* ── RIGHT — Camera + Device info ─────────────────────── */}
        <div className="space-y-4">

          {/* Webcam recording */}
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-fg text-sm">📹 Session Recording</h3>
              {recording && (
                <span className="flex items-center gap-1.5 text-xs text-red-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  REC {fmtTime(recordSecs)}
                </span>
              )}
            </div>

            {/* Video preview */}
            <div className="relative bg-zinc-900 rounded-xl overflow-hidden aspect-video">
              <video
                ref={videoRef}
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              {!cameraOn && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-zinc-600">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m22 8-6 4 6 4V8z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/>
                  </svg>
                  <span className="text-xs">Camera off</span>
                </div>
              )}
              {check.video_url && !cameraOn && (
                <div className="absolute bottom-2 right-2">
                  <a href={check.video_url} target="_blank" rel="noopener noreferrer"
                    className="text-xs bg-zinc-800 border border-zinc-700 px-2 py-1 rounded text-zinc-300 hover:text-fg transition-colors">
                    ▶ View Recording
                  </a>
                </div>
              )}
            </div>

            {camError && <p className="text-xs text-red-400">{camError}</p>}

            <div className="flex gap-2 flex-wrap">
              {!cameraOn ? (
                <button onClick={startCamera} className="btn-secondary text-xs flex items-center gap-1.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>
                  Start Camera
                </button>
              ) : (
                <>
                  {!recording ? (
                    <button onClick={startRecording} className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors">
                      <span className="w-2 h-2 rounded-full bg-white" />
                      Record
                    </button>
                  ) : (
                    <button onClick={stopRecording} className="bg-zinc-700 hover:bg-zinc-600 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors">
                      <span className="w-2.5 h-2.5 rounded-sm bg-white" />
                      Stop
                    </button>
                  )}
                  <button onClick={stopCamera} className="btn-secondary text-xs">
                    Turn Off
                  </button>
                </>
              )}
              {videoReady && !recording && (
                <button onClick={uploadRecording} disabled={uploadingVideo} className="btn-primary text-xs">
                  {uploadingVideo ? 'Uploading…' : '↑ Save Recording'}
                </button>
              )}
            </div>
            {check.video_url && (
              <p className="text-xs text-green-400 flex items-center gap-1">
                <span>✓</span> Recording saved
                <a href={check.video_url} target="_blank" rel="noopener noreferrer" className="underline ml-1">View</a>
              </p>
            )}
          </div>

          {/* Device info / detection */}
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-fg text-sm">📱 Device Info</h3>
              <button onClick={detectDevice} disabled={detecting}
                className="btn-secondary text-xs py-1 px-2.5 flex items-center gap-1.5">
                {detecting ? (
                  <><span className="w-3 h-3 border border-zinc-400 border-t-transparent rounded-full animate-spin" />Detecting…</>
                ) : (
                  <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>Detect</>
                )}
              </button>
            </div>

            {detectError && (
              <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-3 space-y-2">
                <p className="text-xs text-red-400 font-medium">{detectError}</p>

                {setupDiag && (
                  <div className="space-y-2 pt-1">
                    {/* ADB status */}
                    <div className="flex items-center gap-2 text-xs">
                      <span className={(setupDiag.adb as {found:boolean})?.found ? 'text-green-400' : 'text-red-400'}>
                        {(setupDiag.adb as {found:boolean})?.found ? '✓' : '✗'} ADB
                      </span>
                      {(setupDiag.adb as {found:boolean,devices:{status:string}[]})?.devices?.length > 0 ? (
                        <span className="text-zinc-400">
                          {(setupDiag.adb as {devices:{status:string}[]}).devices.map((d:{status:string}) =>
                            d.status === 'unauthorized' ? '⚠ Device unauthorized — tap Allow on phone' :
                            d.status === 'authorized'   ? '✓ Device connected' : `⚠ ${d.status}`
                          ).join(', ')}
                        </span>
                      ) : (setupDiag.adb as {found:boolean})?.found ? (
                        <span className="text-zinc-500">No Android device detected</span>
                      ) : null}
                    </div>
                    {/* ideviceinfo status */}
                    <div className="flex items-center gap-2 text-xs">
                      <span className={(setupDiag.idev as {found:boolean})?.found ? 'text-green-400' : 'text-zinc-500'}>
                        {(setupDiag.idev as {found:boolean})?.found ? '✓' : '–'} ideviceinfo (iPhone)
                      </span>
                      {(setupDiag.idev as {found:boolean,devices:{name:string}[]})?.devices?.length > 0 && (
                        <span className="text-green-400">✓ {(setupDiag.idev as {devices:{name:string}[]}).devices[0].name} connected</span>
                      )}
                    </div>
                    {/* Instructions */}
                    {(setupDiag.instructions as {android?:string,iphone?:string})?.android && (
                      <p className="text-xs text-yellow-400">{(setupDiag.instructions as {android:string}).android}</p>
                    )}
                    {(setupDiag.instructions as {android?:string,iphone?:string})?.iphone && (
                      <p className="text-xs text-zinc-500">{(setupDiag.instructions as {iphone:string}).iphone}</p>
                    )}
                  </div>
                )}

                {!setupDiag && (
                  <p className="text-xs text-zinc-500">Make sure local-agent/start.bat is running on this computer.</p>
                )}
                <button onClick={() => setManualMode(true)} className="text-xs text-zinc-400 underline">Enter manually instead</button>
              </div>
            )}

            {manualMode && (
              <div className="space-y-2 border border-zinc-700 rounded-xl p-3 bg-surface-2">
                <p className="text-xs text-zinc-400 font-medium">Manual Entry</p>
                <select value={manualForm.platform} onChange={e => setManualForm(f => ({ ...f, platform: e.target.value }))} className="input text-xs py-1.5 w-full">
                  <option value="unknown">Unknown Platform</option>
                  <option value="android">Android</option>
                  <option value="ios">iOS</option>
                </select>
                <input type="text" placeholder="IMEI (15 digits)" value={manualForm.imei} onChange={e => setManualForm(f => ({ ...f, imei: e.target.value }))} className="input text-xs py-1.5 w-full font-mono" />
                <input type="text" placeholder="Model (e.g. iPhone 15 Pro)" value={manualForm.model} onChange={e => setManualForm(f => ({ ...f, model: e.target.value }))} className="input text-xs py-1.5 w-full" />
                <input type="text" placeholder="Manufacturer" value={manualForm.manufacturer} onChange={e => setManualForm(f => ({ ...f, manufacturer: e.target.value }))} className="input text-xs py-1.5 w-full" />
                <div className="flex gap-2">
                  <button onClick={applyManual} className="btn-primary text-xs py-1.5 flex-1">Apply</button>
                  <button onClick={() => setManualMode(false)} className="btn-secondary text-xs py-1.5">Cancel</button>
                </div>
              </div>
            )}

            <dl className="space-y-1.5 text-sm">
              {[
                { label: 'Platform', value: check.platform ? (check.platform === 'ios' ? '🍎 iOS' : check.platform === 'android' ? '🤖 Android' : check.platform) : null },
                { label: 'Make / Model', value: [check.manufacturer, check.model].filter(Boolean).join(' ') || null },
                { label: 'Name', value: check.device_name },
                { label: 'OS', value: check.os_version },
                { label: 'Serial', value: check.serial_number, mono: true },
                { label: 'IMEI', value: check.imei, mono: true },
                { label: 'IMEI 2', value: check.imei2, mono: true },
                { label: 'UDID', value: check.udid ? `${check.udid.slice(0, 8)}…` : null, mono: true },
              ].filter(r => r.value).map(r => (
                <div key={r.label} className="flex justify-between gap-2">
                  <dt className="text-xs text-zinc-500 flex-shrink-0">{r.label}</dt>
                  <dd className={`text-xs text-fg truncate ${r.mono ? 'font-mono' : ''}`}>{r.value}</dd>
                </div>
              ))}
              {!check.model && !check.imei && (
                <p className="text-xs text-zinc-600 italic">No device connected. Click Detect or enter manually.</p>
              )}
            </dl>

            <HardwarePanel hw={check.hardware_info} batteryHealth={check.battery_health} />
          </div>

          {/* Security panel */}
          <div className="card space-y-2">
            <h3 className="font-semibold text-fg text-sm">🔒 Security</h3>
            <SecBadge status={check.blacklist_status} label="Blacklist" />
            {check.platform !== 'ios' && <SecBadge status={check.frp_status} label="FRP / Google Lock" />}
            {check.platform !== 'android' && <SecBadge status={check.icloud_status} label="iCloud Activation" />}
            <SecBadge status={check.mdm_status} label="MDM / Supervision" />

            {/* IMEI check */}
            <div className="pt-2 border-t border-zinc-800 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-zinc-400">IMEI Blacklist Check</span>
                <button onClick={checkImei} disabled={imeiChecking || !check.imei}
                  className="btn-secondary text-xs py-1 px-2.5">
                  {imeiChecking ? 'Checking…' : check.imei ? 'Run Check' : 'No IMEI'}
                </button>
              </div>

              {imeiResult && (
                <div className={`rounded-lg p-3 text-xs space-y-1 border ${
                  imeiResult.manual ? 'bg-zinc-800/50 border-zinc-700' :
                  imeiResult.blacklisted ? 'bg-red-900/20 border-red-800' :
                  'bg-green-900/20 border-green-800'
                }`}>
                  {imeiResult.manual ? (
                    <>
                      <p className="text-zinc-400">{String(imeiResult.message)}</p>
                      <div className="space-y-1 mt-2">
                        {((imeiResult.links ?? []) as { name: string; url: string; free: boolean }[]).map(l => (
                          <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-primary hover:underline">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                            {l.name} {l.free && <span className="text-zinc-500">(free)</span>}
                          </a>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <p className={imeiResult.blacklisted ? 'text-red-400 font-semibold' : 'text-green-400 font-semibold'}>
                        {imeiResult.blacklisted ? '✕ BLACKLISTED' : '✓ Clean — not blacklisted'}
                      </p>
                      {imeiResult.carrier && <p className="text-zinc-400">Carrier: {String(imeiResult.carrier)}</p>}
                      {imeiResult.country && <p className="text-zinc-400">Country: {String(imeiResult.country)}</p>}
                      {imeiResult.model && <p className="text-zinc-400">Model: {String(imeiResult.model)}</p>}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Attach to job */}
          <div className="card space-y-2">
            <h3 className="font-semibold text-fg text-sm">🔗 Attach to Job</h3>
            <select
              value={check.job_id ?? ''}
              onChange={e => patchCheck('job_id', e.target.value || null)}
              className="input text-sm w-full"
              disabled={saving}
            >
              <option value="">— Standalone / Valuation —</option>
              {jobs.map(j => (
                <option key={j.id} value={j.id}>
                  #{j.ticket_number} — {j.title}
                </option>
              ))}
            </select>
          </div>

          {/* Notes + grade */}
          <div className="card space-y-3">
            <h3 className="font-semibold text-fg text-sm">📋 Notes & Grade</h3>
            <textarea
              placeholder="Additional notes about this device…"
              defaultValue={check.notes ?? ''}
              onBlur={e => patchCheck('notes', e.target.value)}
              rows={3}
              className="input text-sm w-full resize-none"
            />
            <div>
              <label className="text-xs text-zinc-400 block mb-2">Override Grade</label>
              <div className="flex gap-1.5">
                {(['A', 'B', 'C', 'D', 'F'] as const).map(g => (
                  <button key={g} onClick={() => patchCheck('grade', g)}
                    className={`w-9 h-9 rounded-lg text-sm font-bold border transition-colors ${
                      check.grade === g ? GRADE_COLORS[g] : 'bg-zinc-800 text-zinc-500 border-zinc-700 hover:border-zinc-500'
                    }`}>{g}</button>
                ))}
                {check.grade && (
                  <button onClick={() => patchCheck('grade', null)}
                    className="w-9 h-9 rounded-lg text-xs text-zinc-500 border border-zinc-700 bg-zinc-800 hover:text-zinc-300 transition-colors">✕</button>
                )}
              </div>
              <p className="text-xs text-zinc-600 mt-1.5">Auto-calculated on complete. Override here if needed.</p>
            </div>
          </div>

          {/* ADB setup hints */}
          <div className="card bg-zinc-800/30 space-y-2">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Setup Tips</h3>
            <div className="text-xs text-zinc-500 space-y-1">
              <p><span className="text-zinc-300">Android:</span> Enable Developer Options → USB Debugging. Run: <code className="bg-zinc-800 px-1 rounded">sudo apt install adb</code></p>
              <p><span className="text-zinc-300">iOS:</span> Tap "Trust" when prompted. Run: <code className="bg-zinc-800 px-1 rounded">sudo apt install libimobiledevice-utils usbmuxd</code></p>
              <p><span className="text-zinc-300">IMEI API:</span> Set <code className="bg-zinc-800 px-1 rounded">IMEI_CHECK_API_KEY</code> in .env.local for automated blacklist checks. Get a key at <a href="https://imei.info/api/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">imei.info/api</a></p>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
