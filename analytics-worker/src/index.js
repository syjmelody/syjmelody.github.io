const BOT_UA_RE = /bot|crawl|spider|slurp|preview|headless|wget|curl|python-requests/i;

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: buildCorsHeaders(request, env, true)
      });
    }

    const url = new URL(request.url);

    try {
      if (url.pathname === '/api/visit' && request.method === 'POST') {
        return handleVisit(request, env);
      }

      if (url.pathname === '/api/public-stats' && request.method === 'GET') {
        return handlePublicStats(request, env);
      }

      if (url.pathname === '/api/admin/summary' && request.method === 'GET') {
        return handleAdminSummary(request, env);
      }

      if (url.pathname === '/api/admin/visits' && request.method === 'GET') {
        return handleAdminVisits(request, env);
      }

      return json({ ok: false, error: 'Not found' }, 404, buildCorsHeaders(request, env));
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      return json(
        {
          ok: false,
          error: status === 500 ? 'Internal error' : error.message,
          message: error instanceof Error ? error.message : String(error)
        },
        status,
        buildCorsHeaders(request, env)
      );
    }
  }
};

async function handleVisit(request, env) {
  enforceAllowedOrigin(request, env);

  const userAgent = request.headers.get('user-agent') || '';
  if (!userAgent || BOT_UA_RE.test(userAgent)) {
    const stats = await queryPublicStats(env);
    return json({ ok: true, skipped: true, ...stats }, 200, buildCorsHeaders(request, env));
  }

  const body = await request.json().catch(() => ({}));
  const path = sanitizePath(body.path);
  const title = sanitizeText(body.title, 200);
  const ip = getClientIp(request);
  const ipHash = await hashIp(ip, env.IP_SALT || '');
  const visitedAt = new Date().toISOString();
  const country = request.cf?.country || '';
  const referer = sanitizeText(request.headers.get('referer') || '', 500);
  const storedIp = env.STORE_RAW_IP === 'true' ? ip : null;

  await env.DB.prepare(
    `INSERT INTO visits (visited_at, path, title, ip, ip_hash, country, user_agent, referer)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(visitedAt, path, title, storedIp, ipHash, country, userAgent.slice(0, 500), referer)
    .run();

  const stats = await queryPublicStats(env);
  return json({ ok: true, ...stats }, 200, buildCorsHeaders(request, env));
}

async function handlePublicStats(request, env) {
  const stats = await queryPublicStats(env);
  return json({ ok: true, ...stats }, 200, buildCorsHeaders(request, env));
}

async function handleAdminSummary(request, env) {
  enforceAdmin(request, env);

  const modifier = timezoneModifier(env);
  const overviewQuery = env.DB.prepare(
    `SELECT
      (SELECT COUNT(*) FROM visits) AS total_pv,
      (SELECT COUNT(*) FROM visits WHERE date(visited_at, ?) = date('now', ?)) AS today_pv,
      (SELECT COUNT(DISTINCT ip_hash) FROM visits WHERE date(visited_at, ?) = date('now', ?)) AS today_uv,
      (SELECT COUNT(*) FROM visits WHERE datetime(visited_at) >= datetime('now', '-7 days')) AS last_7d_pv,
      (SELECT COUNT(DISTINCT ip_hash) FROM visits WHERE datetime(visited_at) >= datetime('now', '-7 days')) AS last_7d_uv,
      (SELECT COUNT(*) FROM visits WHERE datetime(visited_at) >= datetime('now', '-30 days')) AS last_30d_pv,
      (SELECT COUNT(DISTINCT ip_hash) FROM visits WHERE datetime(visited_at) >= datetime('now', '-30 days')) AS last_30d_uv`
  ).bind(modifier, modifier, modifier, modifier);

  const dailyQuery = env.DB.prepare(
    `SELECT
      date(visited_at, ?) AS bucket,
      COUNT(*) AS pv,
      COUNT(DISTINCT ip_hash) AS uv
     FROM visits
     WHERE datetime(visited_at) >= datetime('now', '-30 days')
     GROUP BY bucket
     ORDER BY bucket DESC`
  ).bind(modifier);

  const weeklyQuery = env.DB.prepare(
    `SELECT
      strftime('%Y-W%W', visited_at, ?) AS bucket,
      COUNT(*) AS pv,
      COUNT(DISTINCT ip_hash) AS uv
     FROM visits
     WHERE datetime(visited_at) >= datetime('now', '-84 days')
     GROUP BY bucket
     ORDER BY bucket DESC`
  ).bind(modifier);

  const monthlyQuery = env.DB.prepare(
    `SELECT
      strftime('%Y-%m', visited_at, ?) AS bucket,
      COUNT(*) AS pv,
      COUNT(DISTINCT ip_hash) AS uv
     FROM visits
     WHERE datetime(visited_at) >= datetime('now', '-365 days')
     GROUP BY bucket
     ORDER BY bucket DESC`
  ).bind(modifier);

  const countryQuery = env.DB.prepare(
    `SELECT
      CASE
        WHEN country IS NULL OR country = '' THEN 'Unknown'
        ELSE country
      END AS bucket,
      COUNT(*) AS pv,
      COUNT(DISTINCT ip_hash) AS uv
     FROM visits
     WHERE datetime(visited_at) >= datetime('now', '-30 days')
     GROUP BY bucket
     ORDER BY pv DESC, bucket ASC
     LIMIT 20`
  );

  const pageQuery = env.DB.prepare(
    `SELECT
      path AS bucket,
      COUNT(*) AS pv,
      COUNT(DISTINCT ip_hash) AS uv
     FROM visits
     WHERE datetime(visited_at) >= datetime('now', '-30 days')
     GROUP BY path
     ORDER BY pv DESC, path ASC
     LIMIT 20`
  );

  const [overview, daily, weekly, monthly, countries, pages] = await Promise.all([
    overviewQuery.first(),
    dailyQuery.all(),
    weeklyQuery.all(),
    monthlyQuery.all(),
    countryQuery.all(),
    pageQuery.all()
  ]);

  return json(
    {
      ok: true,
      overview: overview || {},
      daily: daily.results || [],
      weekly: weekly.results || [],
      monthly: monthly.results || [],
      countries: countries.results || [],
      pages: pages.results || []
    },
    200,
    buildCorsHeaders(request, env)
  );
}

async function handleAdminVisits(request, env) {
  enforceAdmin(request, env);

  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 50), 1), 200);
  const results = await env.DB.prepare(
    `SELECT visited_at, path, title, ip, country, user_agent, referer
     FROM visits
     ORDER BY visited_at DESC
     LIMIT ?`
  )
    .bind(limit)
    .all();

  return json(
    {
      ok: true,
      visits: (results.results || []).map((row) => ({
        ...row,
        ip: row.ip || '(not stored)'
      }))
    },
    200,
    buildCorsHeaders(request, env)
  );
}

async function queryPublicStats(env) {
  const modifier = timezoneModifier(env);
  const result = await env.DB.prepare(
    `SELECT
      (SELECT COUNT(*) FROM visits) AS totalVisits,
      (SELECT COUNT(*) FROM visits WHERE date(visited_at, ?) = date('now', ?)) AS todayVisits`
  )
    .bind(modifier, modifier)
    .first();

  return {
    totalVisits: Number(result?.totalVisits || 0),
    todayVisits: Number(result?.todayVisits || 0)
  };
}

function buildCorsHeaders(request, env, preflight = false) {
  const origin = request.headers.get('Origin');
  const allowOrigin = isAllowedOrigin(origin, env) ? origin : '*';
  const headers = {
    'Access-Control-Allow-Origin': allowOrigin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json; charset=utf-8'
  };

  if (!preflight && allowOrigin !== '*') {
    headers.Vary = 'Origin';
  }

  return headers;
}

function enforceAllowedOrigin(request, env) {
  const origin = request.headers.get('Origin');
  if (!isAllowedOrigin(origin, env)) {
    throw new HttpError(403, 'Origin not allowed');
  }
}

function isAllowedOrigin(origin, env) {
  const raw = env.PUBLIC_SITE_ORIGINS || '';
  if (!raw.trim()) return true;
  if (!origin) return false;

  const allowlist = raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return allowlist.includes(origin);
}

function enforceAdmin(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const expected = env.ADMIN_TOKEN || '';
  if (!expected || auth !== `Bearer ${expected}`) {
    throw new HttpError(401, 'Unauthorized');
  }
}

function getClientIp(request) {
  const cfIp = request.headers.get('CF-Connecting-IP');
  if (cfIp) return cfIp;

  const forwarded = request.headers.get('X-Forwarded-For');
  if (forwarded) return forwarded.split(',')[0].trim();

  return '0.0.0.0';
}

async function hashIp(ip, salt) {
  const data = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function timezoneModifier(env) {
  const hours = Number(env.TZ_OFFSET_HOURS || 8);
  if (!Number.isFinite(hours) || hours === 0) return '0 hours';
  return `${hours > 0 ? '+' : ''}${hours} hours`;
}

function sanitizePath(path) {
  if (typeof path !== 'string' || !path.startsWith('/')) return '/';
  return path.slice(0, 200);
}

function sanitizeText(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function json(payload, status, headers) {
  return new Response(JSON.stringify(payload), {
    status,
    headers
  });
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
