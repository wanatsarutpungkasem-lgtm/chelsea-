// Server-only storage. Never import this module from browser code.
export function createFootballStore({
  env = name => globalThis.Netlify?.env?.get(name),
  fetcher = (...args) => fetch(...args)
} = {}) {
  const base = env('SUPABASE_URL');
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!base || !key) return null;
  const origin = new URL(base);
  if (origin.protocol !== 'https:' || !origin.hostname.endsWith('.supabase.co')) return null;
  async function request(table, query = '', rows) {
    const response = await fetcher(new URL('/rest/v1/' + table + query, origin), {
      method: rows ? 'POST' : 'GET',
      headers: { apikey: key, Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: rows ? JSON.stringify(rows) : undefined,
      signal: AbortSignal.timeout(2500)
    });
    if (!response.ok) throw new Error('Football storage unavailable');
    return rows ? null : response.json();
  }
  return {
    async read(cacheKey, now) {
      try {
        const params = new URLSearchParams({cache_key: 'eq.' + cacheKey, expires_at: 'gt.' + now.toISOString(), select: 'payload', limit: '1'});
        const rows = await request('football_api_cache', '?' + params);
        return rows[0]?.payload || null;
      } catch { return null; }
    },
    async write(cacheKey, result, path, parameters) {
      try {
        if (path === '/fixtures' && result.rows.length) {
          await request('football_fixtures', '?on_conflict=fixture_id', result.rows.map(r => ({
            fixture_id: r.fixture.id, kickoff_at: r.fixture.date, status: r.fixture.status.short,
            league_name: r.league.name, home_name: r.teams.home.name, away_name: r.teams.away.name,
            home_goals: r.goals?.home ?? null, away_goals: r.goals?.away ?? null,
            data: r, fetched_at: result.fetchedAt
          })));
        }
        if (path === '/predictions') {
          const p = result.rows[0]?.predictions?.percent;
          const values = p && ['home','draw','away'].map(k => /^\d+(?:\.\d+)?%?$/.test(String(p[k]).trim()) ? Number(String(p[k]).replace('%','')) : NaN);
          if (values && values.every(v => Number.isFinite(v) && v >= 0 && v <= 100) && Math.abs(values.reduce((a,b)=>a+b,0)-100)<=1) {
            await request('football_predictions', '?on_conflict=fixture_id', [{fixture_id: Number(parameters.fixture),
              home_percent: values[0], draw_percent: values[1], away_percent: values[2], fetched_at: result.fetchedAt}]);
          }
        }
        await request('football_api_cache', '?on_conflict=cache_key', [{cache_key: cacheKey,
          payload: result, fetched_at: result.fetchedAt, expires_at: new Date(result.expires).toISOString()}]);
      } catch { /* Storage failure never invents scores or interrupts provider responses. */ }
    }
  };
}
