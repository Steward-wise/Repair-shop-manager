# Repair Shop — Open Source Repair Shop Management System

A full-featured repair shop management platform built with Next.js 14, Supabase, and Resend. Manage jobs, customers, inventory, quotes, appointments, POS, staff, and more.

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/oddlywiredwebdesign/404fixed)

---

## Features

- **Job management** — intake, diagnosis, repair tracking, chain of custody, digital signatures
- **Quote system** — instant pricing rules, customer-facing quote acceptance, Stripe payment links
- **Appointments** — online booking calendar with availability management
- **Customer portal** — customers can track their repair progress
- **Inventory** — stock tracking, purchase orders, reorder alerts
- **POS** — walk-in sales with till receipts
- **Support tickets** — IT support / service desk
- **Reports** — revenue, margin, conversion rates
- **Staff management** — technician workload, roles (manager/technician)
- **Business board** — internal kanban + to-do list
- **Email notifications** — Resend-powered transactional emails
- **GDPR compliant** — data export, erasure, privacy notice, audit log
- **Health monitoring** — `/api/health` endpoint for uptime monitors

---

## Quick Start

### 1. Deploy to Netlify

Click the **Deploy to Netlify** button above, or:

1. Fork this repository to your GitHub account
2. Log in to [netlify.com](https://netlify.com) and click **Add new site → Import an existing project**
3. Select your forked repository
4. Leave build settings as-is — Netlify auto-detects Next.js
5. Click **Deploy site**

### 2. Set up Supabase

1. Create a free project at [supabase.com](https://supabase.com)
2. Choose a region close to your users (e.g. `eu-west-2` for UK)
3. Note your **Project URL**, **Anon Key**, and **Service Role Key** from Settings → API

### 3. Set up Resend

1. Create a free account at [resend.com](https://resend.com)
2. Add and verify your domain (e.g. `yourshop.co.uk`)
3. Create an API key
4. Set your from address (e.g. `repairs@yourshop.co.uk`)

### 4. Configure environment variables

In **Netlify → Site configuration → Environment variables**, add:

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public anon key | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase secret service role key | ✅ |
| `RESEND_API_KEY` | Your Resend API key | ✅ |
| `RESEND_FROM_EMAIL` | Verified sender email (e.g. `repairs@yourshop.co.uk`) | ✅ |
| `RESEND_FROM_NAME` | Sender display name (e.g. `Cardiff Repairs`) | ✅ |
| `NEXT_PUBLIC_APP_NAME` | Your shop name | ✅ |
| `NEXT_PUBLIC_APP_URL` | Your full site URL (e.g. `https://myshop.netlify.app`) | ✅ |
| `OWNER_EMAIL` | Your email for new booking/enquiry alerts | ✅ |
| `NEXT_PUBLIC_SHOP_PHONE` | Your shop phone number | Optional |
| `STRIPE_SECRET_KEY` | Stripe secret key (for payment links) | Optional |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret | Optional |

After adding env vars, go to **Deploys → Trigger deploy → Deploy site**.

### 5. Run SQL migrations

Open your **Supabase dashboard → SQL Editor** and run each file from the `supabase/` folder in this order:

**Required (run these first):**
1. `schema.sql` — core tables (jobs, customers, inventory, quotes…)
2. `support-schema.sql` — support tickets
3. `additions.sql` — warranty, checklist, additional fields
4. `ticket-email-schema.sql` — email and ticket settings

**Recommended:**
5. `intake-fields-migration.sql` — drop-off/collection, signatures
6. `custody-notes-migration.sql` — chain of custody, job notes
7. `timelog-and-repair-summary-migration.sql` — time tracking
8. `feature-batch-migration.sql` — POS, audit log, app settings
9. `business-tasks-migration.sql` — business board / kanban
10. `performance-indexes.sql` — database performance indexes
11. `quotes-delete-policy.sql` — quote RLS policies
12. `fix-appointments-quote-fk.sql` — appointment foreign key fix

**Optional:**
- `technicians-sla-schema.sql` — SLA tracking
- `phone-check-schema.sql` — IMEI / phone check
- `hardware-info-migration.sql` — hardware info fields

### 6. Run the setup wizard

Visit `https://yoursite.netlify.app/setup` and follow the guided wizard — it will walk you through env vars, SQL migrations, and a live health check.

### 7. Sign in

Go to `https://yoursite.netlify.app/login` and sign in with your Supabase credentials. The first time you log in, create a user in **Supabase → Authentication → Users**.

---

## Setting up the booking form on your website

Go to **Settings** in your dashboard. You'll find an embeddable HTML snippet to add to your website. Customers fill in the form, you get an email notification, and if instant pricing matches their device, they automatically receive a quote with a booking link.

---

## Uptime monitoring (recommended)

Set up a free monitor at [uptimerobot.com](https://uptimerobot.com):

- **URL:** `https://yoursite.netlify.app/api/health`
- **Type:** Keyword monitor
- **Keyword:** `healthy`
- **Interval:** 5 minutes

You'll be emailed within 5 minutes of any outage.

---

## Setting up Stripe (optional)

To accept online payments for repair quotes:

1. Create a [Stripe](https://stripe.com) account
2. Add `STRIPE_SECRET_KEY` to your Netlify env vars
3. In Stripe, create a webhook pointing to `https://yoursite.netlify.app/api/stripe/webhook` for the `checkout.session.completed` event
4. Add the webhook signing secret as `STRIPE_WEBHOOK_SECRET`

---

## Staff roles

Users default to **manager** role (full access). To create technician accounts:

1. Create the user in **Supabase → Authentication → Users**
2. In **Supabase → Table Editor → auth.users**, edit their `raw_user_meta_data` to add `{ "role": "technician" }`

Technicians see jobs, inventory, support, and their own workload. Managers see everything.

---

## Tech stack

- **Framework:** Next.js 14 (App Router)
- **Database:** Supabase (PostgreSQL)
- **Email:** Resend
- **Payments:** Stripe
- **Hosting:** Netlify
- **Language:** TypeScript

---

## Support

- Setup wizard: `/setup` on your deployment
- Issues & feature requests: [GitHub Issues](https://github.com/oddlywiredwebdesign/404fixed/issues)

---

## License

MIT — free to use, modify, and deploy. See [LICENSE](LICENSE).
