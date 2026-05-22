# Homepage Analytics Worker

This worker is designed for a static GitHub Pages homepage:

- public footer shows **total visits** and **today's visits**
- backend stores **IP / hashed IP / country / user agent / path / referer**
- admin APIs provide **daily / weekly / monthly** PV/UV summaries
- `analytics-dashboard.html` can be used as a lightweight admin page

## Endpoints

- `POST /api/visit`  
  Record one visit and return:
  - `totalVisits`
  - `todayVisits`

- `GET /api/public-stats`  
  Read-only public counters.

- `GET /api/admin/summary`  
  Requires `Authorization: Bearer <ADMIN_TOKEN>`.

- `GET /api/admin/visits?limit=50`  
  Requires `Authorization: Bearer <ADMIN_TOKEN>`.

## Setup

1. Create a D1 database.
2. Put the returned `database_id` into `wrangler.toml`.
3. Initialize the schema:

   ```bash
   wrangler d1 execute homepage-analytics --file=./schema.sql
   ```

4. Set secrets:

   ```bash
   wrangler secret put ADMIN_TOKEN
   wrangler secret put IP_SALT
   ```

5. Deploy:

   ```bash
   wrangler deploy
   ```

## Frontend wiring

After deploy, copy the Worker URL and set it in the homepage:

```html
<script>
  window.HOMEPAGE_ANALYTICS = {
    endpoint: 'https://your-worker-name.your-subdomain.workers.dev'
  };
</script>
```

## Notes

- `STORE_RAW_IP = "true"` means raw IPs are saved in D1.
- If you only want anonymous unique-visitor analytics later, set it to `"false"`.
- `TZ_OFFSET_HOURS = "8"` makes "today" use UTC+8.
- Open `analytics-dashboard.html` in your deployed site, then enter:
  - Worker endpoint
  - `ADMIN_TOKEN`
