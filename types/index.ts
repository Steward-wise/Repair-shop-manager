export type JobStatus =
  | 'intake'
  | 'diagnosed'
  | 'awaiting_approval'
  | 'awaiting_repair'
  | 'waiting_parts'
  | 'in_progress'
  | 'ready'
  | 'collected'

export type DeviceType = 'phone' | 'tablet' | 'computer' | 'console' | 'other'

export type PhotoType = 'intake' | 'damage' | 'repair' | 'completion'

export type NotificationType = 'sms' | 'email' | 'whatsapp'

export type PaymentStatus = 'unpaid' | 'deposit_paid' | 'paid'

export interface Customer {
  id: string
  name: string
  phone: string | null
  email: string | null
  notes: string | null
  marketing_consent: boolean
  created_at: string
  updated_at: string
}

export interface ChecklistItem {
  label: string
  checked: boolean
}

export interface Job {
  id: string
  ticket_number: number
  customer_id: string | null
  customer?: Customer | null
  device_type: DeviceType
  device_make: string
  device_model: string
  imei: string | null
  reported_fault: string
  password: string | null
  backup_required: boolean
  backup_completed: boolean
  status: JobStatus
  technician_name: string | null
  quoted_price: number | null
  final_price: number | null
  notes: string | null
  internal_notes: string | null
  payment_status: PaymentStatus
  deposit_amount: number | null
  deposit_paid: boolean
  payment_method: string | null
  created_at: string
  updated_at: string
  collected_at: string | null
  followup_sent_at: string | null
  rating_token: string | null
  checklist: ChecklistItem[]
  warranty_days: number | null
  warranty_expires_at: string | null
  approval_sent_at: string | null
  approval_price: number | null
  stripe_checkout_session_id: string | null
  stripe_payment_link: string | null
  intake_method: 'drop_off' | 'collection' | null
  intake_date: string | null
  alternate_contact: string | null
  intake_signature_url: string | null
  repair_summary: string | null
  repair_report_sent_at: string | null
  photos?: JobPhoto[]
  signature?: Signature | null
  parts?: JobPart[]
}

export interface JobPhoto {
  id: string
  job_id: string
  url: string
  photo_type: PhotoType
  caption: string | null
  created_at: string
}

export interface Signature {
  id: string
  job_id: string
  signature_url: string
  collected_by: string | null
  customer_name: string | null
  created_at: string
}

export interface InventoryItem {
  id: string
  part_name: string
  sku: string | null
  description: string | null
  quantity: number
  reorder_threshold: number
  cost_price: number | null
  sell_price: number | null
  supplier: string | null
  supplier_email: string | null
  created_at: string
  updated_at: string
}

export interface JobPart {
  id: string
  job_id: string
  inventory_id: string | null
  part_name: string
  quantity: number
  unit_price: number | null
  created_at: string
  inventory?: InventoryItem | null
}

export interface NotificationLog {
  id: string
  job_id: string
  type: NotificationType
  recipient: string
  message: string | null
  status: string
  sent_at: string
}

export interface JobTimeLog {
  id: string
  job_id: string
  technician: string | null
  started_at: string
  ended_at: string | null
  notes: string | null
  created_at: string
  /** Duration in minutes — computed client-side or returned by API */
  duration_minutes?: number
}

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  intake: 'Intake',
  diagnosed: 'Diagnosed',
  awaiting_approval: 'Awaiting Approval',
  awaiting_repair: 'Awaiting Repair',
  waiting_parts: 'Waiting Parts',
  in_progress: 'In Progress',
  ready: 'Ready',
  collected: 'Collected',
}

export const JOB_STATUS_COLORS: Record<JobStatus, string> = {
  intake: 'bg-blue-900/40 text-blue-300 border-blue-700',
  diagnosed: 'bg-purple-900/40 text-purple-300 border-purple-700',
  awaiting_approval: 'bg-pink-900/40 text-pink-300 border-pink-700',
  awaiting_repair: 'bg-cyan-900/40 text-cyan-300 border-cyan-700',
  waiting_parts: 'bg-orange-900/40 text-orange-300 border-orange-700',
  in_progress: 'bg-yellow-900/40 text-yellow-300 border-yellow-700',
  ready: 'bg-green-900/40 text-green-300 border-green-700',
  collected: 'bg-zinc-800 text-zinc-400 border-zinc-600',
}

export const DEVICE_TYPE_LABELS: Record<DeviceType, string> = {
  phone: 'Phone',
  tablet: 'Tablet',
  computer: 'Computer / Laptop',
  console: 'Games Console',
  other: 'Other',
}

export type QuoteStatus = 'pending' | 'sent' | 'accepted' | 'declined' | 'booked' | 'closed'
export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show'

export interface QuoteRule {
  id: string
  name: string
  device_type: string | null
  keywords: string
  min_price: number
  max_price: number | null
  notes: string | null
  is_active: boolean
  sort_order: number
  created_at: string
}

export interface Quote {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  device_type: string | null
  device_make_model: string | null
  problem_description: string
  suggested_price: number | null
  final_price: number | null
  price_notes: string | null
  matched_rule_id: string | null
  status: QuoteStatus
  admin_notes: string | null
  quote_token: string
  sent_at: string | null
  responded_at: string | null
  followup_sent_at: string | null
  created_at: string
}

export interface Availability {
  id: string
  day_of_week: number
  start_time: string
  end_time: string
  slot_duration_mins: number
  is_active: boolean
}

export interface AvailabilityBlock {
  id: string
  block_date: string
  start_time: string | null
  end_time: string | null
  reason: string | null
  created_at: string
}

export interface Appointment {
  id: string
  quote_id: string | null
  customer_name: string
  customer_email: string
  customer_phone: string | null
  appointment_date: string
  appointment_time: string
  duration_mins: number
  device_info: string | null
  notes: string | null
  status: AppointmentStatus
  created_at: string
}

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  pending: 'Pending',
  sent: 'Sent',
  accepted: 'Accepted',
  declined: 'Declined',
  booked: 'Booked',
  closed: 'Closed',
}

export const QUOTE_STATUS_COLORS: Record<QuoteStatus, string> = {
  pending: 'bg-yellow-900/40 text-yellow-300 border-yellow-700',
  sent: 'bg-blue-900/40 text-blue-300 border-blue-700',
  accepted: 'bg-green-900/40 text-green-300 border-green-700',
  declined: 'bg-red-900/40 text-red-300 border-red-700',
  booked: 'bg-purple-900/40 text-purple-300 border-purple-700',
  closed: 'bg-zinc-800 text-zinc-400 border-zinc-600',
}

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No Show',
}

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// ─── Support / IT Desk ───────────────────────────────────────────────────────

export type TicketType = 'service_desk' | 'incident'
export type TicketStatus = 'open' | 'in_progress' | 'pending_client' | 'resolved' | 'closed'
export type TicketPriority = 'p1' | 'p2' | 'p3' | 'p4'
export type ClientType = 'prospect' | 'active' | 'inactive'
export type ITQuoteStatus = 'draft' | 'sent' | 'accepted'
export type MessageDirection = 'outbound' | 'inbound' | 'internal'

export function formatTicketRef(type: TicketType, number: number): string {
  if (type === 'incident') return `INC${String(number).padStart(4, '0')}`
  return `C${String(number).padStart(5, '0')}`
}

export interface Technician {
  id: string
  name: string
  email: string | null
  phone: string | null
  active: boolean
  created_at: string
}

export interface SupportClient {
  id: string
  company_name: string
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  address: string | null
  website: string | null
  client_type: ClientType
  industry: string | null
  notes: string | null
  monthly_value: number | null
  sla_hours: number | null
  created_at: string
}

export interface SupportTicket {
  id: string
  ticket_number: number
  ticket_type: TicketType
  title: string
  description: string | null
  status: TicketStatus
  priority: TicketPriority | null
  client_id: string | null
  client?: SupportClient | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  assigned_to: string | null
  technician_id: string | null
  technician?: Technician | null
  sla_due_at: string | null
  source?: string | null
  created_at: string
  updated_at: string
  resolved_at: string | null
}

export type MessageType = 'message' | 'note' | 'repair_log' | 'call_log' | 'callout'

export interface TicketMessage {
  id: string
  ticket_id: string
  direction: MessageDirection
  from_name: string | null
  from_email: string | null
  body: string
  sent: boolean
  message_type: MessageType
  created_at: string
  email_message_id?: string | null
  email_in_reply_to?: string | null
  attachments?: TicketAttachment[]
}

export interface TicketAttachment {
  id: string
  ticket_id: string
  message_id: string | null
  file_name: string
  file_url: string
  file_size: number | null
  mime_type: string | null
  uploaded_by: string | null
  created_at: string
}

export interface TicketTimelineEvent {
  id: string
  ticket_id: string
  event_type: string
  description: string
  created_at: string
  actor?: string | null
}

export interface PhoneCheck {
  id: string
  job_id: string | null
  platform: 'android' | 'ios' | 'unknown' | null
  device_name: string | null
  manufacturer: string | null
  model: string | null
  os_version: string | null
  serial_number: string | null
  imei: string | null
  imei2: string | null
  udid: string | null
  battery_health: number | null
  frp_status: string
  mdm_status: string
  icloud_status: string
  blacklist_status: string
  blacklist_data: Record<string, unknown> | null
  hardware_info: Record<string, unknown> | null
  tests: import('@/lib/phone-tests').TestItem[]
  video_url: string | null
  notes: string | null
  grade: string | null
  status: 'in_progress' | 'completed'
  purpose: 'repair' | 'valuation'
  created_at: string
  updated_at: string
}

export interface ITQuoteItem {
  description: string
  quantity: number
  unit_price: number
}

export interface ITQuote {
  id: string
  ticket_id: string | null
  client_id: string | null
  client?: SupportClient | null
  title: string
  items: ITQuoteItem[]
  subtotal: number
  vat_rate: number
  total: number
  notes: string | null
  status: ITQuoteStatus
  quote_token: string
  sent_at: string | null
  accepted_at: string | null
  valid_until: string | null
  created_at: string
}

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  pending_client: 'Pending Client',
  resolved: 'Resolved',
  closed: 'Closed',
}

export const TICKET_STATUS_COLORS: Record<TicketStatus, string> = {
  open: 'bg-blue-900/40 text-blue-300 border-blue-700',
  in_progress: 'bg-yellow-900/40 text-yellow-300 border-yellow-700',
  pending_client: 'bg-purple-900/40 text-purple-300 border-purple-700',
  resolved: 'bg-green-900/40 text-green-300 border-green-700',
  closed: 'bg-zinc-800 text-zinc-400 border-zinc-600',
}

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  p1: 'P1 – Critical',
  p2: 'P2 – High',
  p3: 'P3 – Medium',
  p4: 'P4 – Low',
}

export const PRIORITY_COLORS: Record<TicketPriority, string> = {
  p1: 'bg-red-900/60 text-red-300 border-red-600',
  p2: 'bg-orange-900/40 text-orange-300 border-orange-700',
  p3: 'bg-yellow-900/40 text-yellow-300 border-yellow-700',
  p4: 'bg-zinc-800 text-zinc-400 border-zinc-600',
}

export const IT_QUOTE_STATUS_LABELS: Record<ITQuoteStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  accepted: 'Accepted',
}

// ─────────────────────────────────────────────────────────────────────────────

export const STATUS_NOTIFICATION_MESSAGES: Partial<Record<JobStatus, string>> = {
  diagnosed: 'Your device has been assessed. We will be in touch shortly with a quote.',
  waiting_parts: 'We are waiting for parts to arrive. We will update you as soon as they are in.',
  in_progress: 'Great news — we have started working on your device.',
  ready: 'Your device is ready for collection! Please bring this message as reference.',
  collected: 'Thank you for choosing us. We hope to see you again!',
}

export interface JobCustodyEvent {
  id: string
  job_id: string
  event_type: 'intake' | 'return_to_customer' | 'collection'
  direction: 'in' | 'out'
  event_date: string
  signature_url: string | null
  person_name: string | null
  notes: string | null
  created_at: string
}

export interface JobNote {
  id: string
  job_id: string
  content: string
  note_type: 'note' | 'status_change' | 'custody' | 'payment'
  staff_name: string | null
  meta: Record<string, unknown> | null
  created_at: string
}
