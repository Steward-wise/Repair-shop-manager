export type TestResult = 'pass' | 'fail' | 'skip' | null

export interface PhoneTestDef {
  id: string
  name: string
  category: 'security' | 'hardware' | 'connectivity' | 'condition'
  auto?: boolean
  platforms?: ('android' | 'ios')[]
  description?: string
}

export interface TestItem {
  id: string
  name: string
  category: string
  result: TestResult
  notes: string
  value?: string  // e.g. battery %, battery health label
  selected: boolean
}

export const ALL_TESTS: PhoneTestDef[] = [
  // Security (automated where possible)
  { id: 'imei_blacklist', name: 'IMEI Blacklist Check', category: 'security', auto: true },
  { id: 'frp', name: 'FRP / Google Account Lock', category: 'security', auto: true, platforms: ['android'] },
  { id: 'icloud', name: 'iCloud Activation Lock', category: 'security', auto: true, platforms: ['ios'] },
  { id: 'mdm', name: 'MDM / Device Management', category: 'security', auto: true },

  // Hardware
  { id: 'battery_health', name: 'Battery Health', category: 'hardware', auto: true },
  { id: 'screen', name: 'Screen / Display', category: 'hardware' },
  { id: 'dead_pixels', name: 'Dead Pixels', category: 'hardware' },
  { id: 'touch', name: 'Touch Screen', category: 'hardware' },
  { id: 'front_camera', name: 'Front Camera', category: 'hardware' },
  { id: 'rear_camera', name: 'Rear Camera', category: 'hardware' },
  { id: 'speaker', name: 'Speaker', category: 'hardware' },
  { id: 'microphone', name: 'Microphone', category: 'hardware' },
  { id: 'charging', name: 'Charging Port', category: 'hardware' },
  { id: 'headphone', name: 'Headphone Jack (3.5mm)', category: 'hardware' },
  { id: 'biometrics', name: 'Face ID / Fingerprint', category: 'hardware' },
  { id: 'power_btn', name: 'Power Button', category: 'hardware' },
  { id: 'volume_btns', name: 'Volume Buttons', category: 'hardware' },
  { id: 'mute_switch', name: 'Mute / Silent Switch', category: 'hardware' },
  { id: 'home_btn', name: 'Home Button', category: 'hardware' },
  { id: 'vibration', name: 'Vibration Motor', category: 'hardware' },

  // Connectivity
  { id: 'wifi', name: 'Wi-Fi', category: 'connectivity' },
  { id: 'bluetooth', name: 'Bluetooth', category: 'connectivity' },
  { id: 'cellular', name: 'Cellular / SIM', category: 'connectivity' },
  { id: 'gps', name: 'GPS', category: 'connectivity' },

  // Physical condition
  { id: 'screen_condition', name: 'Screen Physical Condition', category: 'condition' },
  { id: 'body_condition', name: 'Body / Frame Condition', category: 'condition' },
  { id: 'water_damage', name: 'Water Damage Indicator', category: 'condition' },
]

export function buildDefaultTests(platform?: string | null): TestItem[] {
  return ALL_TESTS
    .filter(t => !t.platforms || !platform || t.platforms.includes(platform as 'android' | 'ios'))
    .map(t => ({ id: t.id, name: t.name, category: t.category, result: null, notes: '', selected: true }))
}

/** Calculate an overall grade from test results */
export function calcGrade(tests: TestItem[], blacklistStatus: string, frpStatus: string, icloudStatus: string, mdmStatus: string): 'A' | 'B' | 'C' | 'D' | 'F' {
  // F for any hard security lock
  if (blacklistStatus === 'blacklisted') return 'F'
  if (frpStatus === 'locked') return 'F'
  if (icloudStatus === 'locked') return 'F'

  const selected = tests.filter(t => t.selected && t.result !== null && t.result !== 'skip')
  const fails = selected.filter(t => t.result === 'fail').length
  const passes = selected.filter(t => t.result === 'pass').length

  if (selected.length === 0) return 'A'
  if (fails === 0 && mdmStatus !== 'supervised') return 'A'
  if (fails <= 1) return 'B'
  if (fails <= 3) return 'C'
  if (fails <= 5) return 'D'
  return 'F'
}

export const GRADE_COLORS: Record<string, string> = {
  A: 'bg-green-900/40 text-green-300 border-green-700',
  B: 'bg-blue-900/40 text-blue-300 border-blue-700',
  C: 'bg-yellow-900/40 text-yellow-300 border-yellow-700',
  D: 'bg-orange-900/40 text-orange-300 border-orange-700',
  F: 'bg-red-900/40 text-red-300 border-red-700',
}
