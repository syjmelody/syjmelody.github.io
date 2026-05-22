# Deploy analytics for this homepage

This repository now contains:

- public counter in the homepage footer
- a Cloudflare Worker backend
- a D1 database schema
- a lightweight admin dashboard

## 1) Prerequisites

- a Cloudflare account
- Node.js / npm
- access to this repo

## 2) Install Wrangler

From any directory:

```bash
npx wrangler --version
```

If you prefer a local install:

```bash
npm install -D wrangler
```

## 3) Login to Cloudflare

```bash
npx wrangler login
```

## 4) Create the D1 database

Run inside `analytics-worker/`:

```bash
npx wrangler d1 create homepage-analytics
```

Cloudflare will print a `database_id` and a `[[d1_databases]]` snippet.
Copy the returned `database_id` into:

- `analytics-worker/wrangler.toml`

## 5) Initialize the schema

Still inside `analytics-worker/`:

```bash
npx wrangler d1 execute homepage-analytics --file=./schema.sql
```

## 6) Configure secrets

Set the admin token:

```bash
npx wrangler secret put ADMIN_TOKEN
```

Set the IP hashing salt:

```bash
npx wrangler secret put IP_SALT
```

Suggested values:

- `ADMIN_TOKEN`: long random string
- `IP_SALT`: another long random string

For local development only, you can also create:

```text
analytics-worker/.dev.vars
```

using `analytics-worker/.dev.vars.example` as the template.

## 7) Review worker config

Edit `analytics-worker/wrangler.toml`:

- `PUBLIC_SITE_ORIGINS = "https://syjmelody.github.io"`
- `TZ_OFFSET_HOURS = "8"` or your preferred timezone offset
- `STORE_RAW_IP = "true"` if you want raw IP saved

If you later want multiple allowed origins, use comma-separated values:

```toml
PUBLIC_SITE_ORIGINS = "https://syjmelody.github.io,https://www.syjmelody.github.io"
```

## 8) Deploy the Worker

Inside `analytics-worker/`:

```bash
npx wrangler deploy
```

After deploy, Cloudflare will return a Worker URL like:

```text
https://homepage-analytics.<subdomain>.workers.dev
```

## 9) Connect the homepage to the Worker

Open `index.html` and fill:

```html
<script>
  window.HOMEPAGE_ANALYTICS = {
    endpoint: 'https://homepage-analytics.<subdomain>.workers.dev'
  };
</script>
```

Then commit and push your homepage repo.

## 10) Open the admin dashboard

After GitHub Pages updates, open:

```text
https://syjmelody.github.io/analytics-dashboard.html
```

Enter:

- Worker endpoint
- `ADMIN_TOKEN`

You will then see:

- total / today / 7d / 30d PV & UV
- daily / weekly / monthly trends
- top countries
- top pages
- recent visits with IP

## 11) Privacy note

The current implementation stores raw IP addresses because you requested it.
If you later want a privacy-safer mode:

1. set `STORE_RAW_IP = "false"`
2. redeploy the Worker

Then the dashboard will still support UV statistics through hashed IPs.

## 12) Recommended first test

1. deploy Worker
2. fill endpoint in `index.html`
3. push homepage
4. open your homepage in a browser
5. verify footer counters increase
6. open `analytics-dashboard.html`
7. verify your visit appears in Recent Visits
