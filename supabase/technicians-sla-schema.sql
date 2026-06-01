-- ─── Technicians ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS technicians (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  email text,
  phone text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ─── SLA on clients ───────────────────────────────────────────────────────────
ALTER TABLE support_clients ADD COLUMN IF NOT EXISTS sla_hours integer;

-- ─── Ticket enhancements ──────────────────────────────────────────────────────
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS sla_due_at timestamptz;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS technician_id uuid REFERENCES technicians(id) ON DELETE SET NULL;

-- ─── Message type (repair_log, call_log, callout, message, note) ──────────────
ALTER TABLE ticket_messages ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'message';

-- ─── Ticket file attachments ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ticket_attachments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  message_id uuid REFERENCES ticket_messages(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size integer,
  mime_type text,
  uploaded_by text,
  created_at timestamptz DEFAULT now()
);

-- After running this SQL, go to Supabase → Storage and ensure the "repair-media"
-- bucket exists (it should already from job photos). Ticket files will be stored
-- under the tickets/ folder in that same bucket.
