# Litecoin Fund

A Next.js application powering the public **`litecoin.com/projects`** and **`litecoin.com/donate`** pages, plus supporting API routes for projects + donations.

## Features

- **Webflow Integration**: Fetch and display projects from Webflow CMS
- **TGB (The Giving Block) Integration**: Handle fiat and crypto donations
- **Project Pages**: Browse and view individual project details
- **Donation Flow**: Complete donation process with TGB API

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── webflow/          # Webflow API routes
│   │   ├── tgb/              # The Giving Block API routes
│   │   └── cache/            # Cache management
│   ├── projects/             # Project pages
│   └── donate/               # Donation page
├── services/
│   ├── webflow/              # Webflow service layer
│   └── tgb/                  # TGB service layer
├── types/                     # TypeScript type definitions
├── lib/                       # Shared libraries (KV, Prisma)
└── utils/                     # Utility functions
```

## Setup

1. **Install dependencies** (Note: Requires Node.js 20.19+ or 22.12+ for Prisma)
   ```bash
   npm install
   ```

2. **Set up environment variables**
   - Create a `.env` file (this repo expects `.env` at runtime, as shown in `next build` output).
   - Provide:
     - Webflow API token / collection IDs
     - The Giving Block credentials
     - KV credentials (if used)
     - `DATABASE_URL` (points at the legacy production DB if you want exact parity)
     - Payload: `USE_PAYLOAD_CMS`, `PAYLOAD_API_URL`, `PAYLOAD_API_TOKEN` (CMS user API key; used only for draft preview)
     - Preview host: `PROJECT_PREVIEW_HOSTS` (default `projectspreview.lite.space`; add `localhost:3000` to preview drafts locally)

3. **Set up Prisma** (after upgrading Node.js)
   ```bash
   npx prisma generate
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

## API Routes

This list reflects the routes produced by `next build` (App Router).

### Webflow
- `GET /api/webflow/projects` - Get all published projects
- `GET /api/webflow/projects/[slug]` - Get project by slug

### The Giving Block
- **Legacy-parity donation endpoints (used by the donation UI)**
  - `POST /api/createFiatDonationPledge`
  - `POST /api/chargeFiatDonationPledge`
  - `POST /api/createDepositAddress`
  - `POST /api/createStockDonationPledge`
  - `POST /api/submitStockDonation`
  - `POST /api/signStockDonation`
- **TGB proxy endpoints**
  - `POST /api/tgb/donations/fiat`
  - `POST /api/tgb/donations/crypto`

### Other APIs
- `GET /api/stats`
- `GET /api/getInfoTGB?slug=...`
- `GET /api/getWidgetSnippet`
- `GET /api/matching-donors-by-project?slug=...`
- `GET /api/contributors`

## Pages

These correspond to the public site routes:

- **`/projects`** → **`litecoin.com/projects`** (project list + donation modal)
- **`/projects/[slug]`** → **`litecoin.com/projects/:slug`** (project detail + donation modal)
- **`/donate`** → **`litecoin.com/donate`** (donation page)
- `/projects/submit` (project submission form)
- `/projects/submitted` (generic confirmation)
- `/projects/submitted/[id]` (council review of one application—Discord link; not for applicants; URL is not secret—see env section)

## Environment Variables

This app expects env vars compatible with the **existing (legacy) production DB** and TGB.

- **Database**
  - **`DATABASE_URL`**: must point at the *existing live DB* (same one used by the old project).
    - The current Prisma client (`litecoin-fund/lib/prisma.ts`) reads **only** `DATABASE_URL`.
    - Do **not** run `prisma migrate` against the live DB.

- **The Giving Block**
  - **`GIVING_BLOCK_LOGIN`**
  - **`GIVING_BLOCK_PASSWORD`**

- **Project submission** (`/projects/submit` → `POST /api/project-applications`)
  - Submissions are stored in PostgreSQL (`project_applications` via Prisma). Apply DDL once: `litecoin-fund/prisma/project_applications.sql` or from `litecoin-fund`: `npx prisma db push`.
  - **`NEXT_PUBLIC_SITE_URL`** or **`APP_PUBLIC_URL`**: Canonical site origin (no trailing slash), e.g. `https://projects.lite.space`. Used for absolute links in Discord (and falls back to `x-forwarded-*` / `Host` when unset).
  - **`DISCORD_WEBHOOK_URL`**: Optional incoming webhook for `#litecoin-donations` — daily/monthly donation digests (embed + PDF), real-time confirmed-donation alerts, and (via backup script) backup status.
  - **`DISCORD_PROJECTS_WEBHOOK_URL`**: Optional incoming webhook for `#litecoin-projects-server` — new project application embeds. Falls back to `DISCORD_WEBHOOK_URL` if unset. Submissions still succeed if neither is set.
  - Applicants only see the generic `/projects/submitted` thank-you page.
  - Anyone with the submission URL can view that application’s details (obscure id, not authenticated). Tighten with auth when the formal council workflow ships.

- **Schema expectations (legacy parity)**
  - Token caching uses the legacy **`tokens`** table with columns:
    - `access_token`, `refresh_token`, `expires_at`, `refreshed_at`
  - Donation persistence uses the legacy **`donations`** table (and `webhook_events` when webhook parity is implemented).

## Note on Node.js Version

This project requires Node.js 20.19+ or 22.12+ for Prisma support. If you're on an older version, you can still develop the frontend and API routes, but Prisma functionality will be disabled until you upgrade.
