import { bangkokDate, normalize, validDate, TIMEZONE } from '../../dist/assets/js/football-query.mjs';
import { createFootballStore } from './football-store.mjs';

const PROVIDER = 'https://v3.football.api-sports.io';
const FINISHED = new Set(['FT', 'AET', 'PEN', 'AWD', 'WO']);
const PAGE_SIZE = 10;
class FootballError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
const fail = (status, code, message) => { throw new FootballError(status, code, message); };
export function mapFixture(row) {
  return {
    id: row.fixture.id,
    date: row.fixture.date,
    timezone: TIMEZONE,
    status: row.fixture.status.short,
    elapsed: row.fixture.status.elapsed ?? null,
    finished: FINISHED.has(row.fixture.status.short),
    league: { name: row.league.name, country: row.league.country, round: row.league.round ?? '' },
    home: { id: row.teams.home.id, name: row.teams.home.name },
    away: { id: row.teams.away.id, name: row.teams.away.name },
    goals: { home: row.goals?.home ?? null, away: row.goals?.away ?? null },
    penalties: { home: row.score?.penalty?.home ?? null, away: row.score?.penalty?.away ?? null }
  };
}
export function parsePercentages(percent) {
  if (!percent) return null;
  const values = ['home', 'draw', 'away'].map(side => {
    const value = percent[side];
    if (typeof value === 'number') return value;
    if (typeof value !== 'string' || !/^\d+(?:\.\d+)?%?$/.test(value.trim())) return NaN;
    return Number(value.replace('%', '').trim());
  });
  if (values.some(n => !Number.isFinite(n) || n < 0 || n > 100)) return null;
  if (Math.abs(values.reduce((sum, n) => sum + n, 0) - 100) > 1) return null;
  return { home: values[0], draw: values[1], away: values[2] };
}
export function createFootballHandler({
  getKey = () => globalThis.Netlify?.env?.get('FOOTBALL_API_KEY'),
  fetcher = (...args) => fetch(...args), now = () => new Date(), store = createFootballStore()
} = {}) {
  // Warm-instance cache complements the CDN; it is not a global quota counter.
  const cache = new Map();
  async function provider(path, parameters, ttl = 60000) {
    const url = new URL(path, PROVIDER);
    Object.entries(parameters).forEach(([key, value]) => url.searchParams.set(key, String(value)));
    const cached = cache.get(url.href);
    if (cached && cached.expires > now().getTime()) return cached;
    const key = getKey();
    if (!key) fail(503, 'FOOTBALL_NOT_CONFIGURED', 'บริการสกอร์ฟุตบอลยังไม่เปิดใช้งานครับ เจ้าของเว็บกำลังเตรียมเชื่อมผู้ให้บริการข้อมูล');
    const cacheKey = url.pathname + url.search;
    const persisted = await store?.read(cacheKey, now());
    if (persisted && persisted.expires > now().getTime() && Array.isArray(persisted.rows)) return persisted;
    let response;
    try {
      response = await fetcher(url, { headers: { 'x-apisports-key': key }, signal: AbortSignal.timeout(12000) });
    } catch { fail(504, 'PROVIDER_TIMEOUT', 'ติดต่อผู้ให้บริการข้อมูลฟุตบอลไม่สำเร็จ ลองใหม่อีกครั้งครับ'); }
    if (response.status === 429) fail(429, 'PROVIDER_QUOTA', 'โควตาข้อมูลฟุตบอลถึงขีดจำกัดแล้ว กรุณาลองใหม่ภายหลังครับ');
    if (response.status === 401 || response.status === 403) fail(503, 'PROVIDER_ACCESS', 'ผู้ให้บริการไม่อนุญาตคำขอนี้ เจ้าของเว็บต้องตรวจ API key และแพ็กเกจครับ');
    if (response.status === 204) return { rows: [], fetchedAt: now().toISOString() };
    if (!response.ok) fail(502, 'PROVIDER_UNAVAILABLE', 'ผู้ให้บริการข้อมูลฟุตบอลขัดข้องชั่วคราวครับ');
    let data;
    try { data = await response.json(); } catch { fail(502, 'PROVIDER_RESPONSE', 'อ่านข้อมูลฟุตบอลจากผู้ให้บริการไม่สำเร็จครับ'); }
    if (data.errors && Object.keys(data.errors).length) {
      const reason = JSON.stringify(data.errors).toLowerCase();
      if (/limit|quota|rate/.test(reason)) fail(429, 'PROVIDER_QUOTA', 'โควตาข้อมูลฟุตบอลถึงขีดจำกัดแล้ว กรุณาลองใหม่ภายหลังครับ');
      if (/free.*date/.test(reason)) fail(503, 'PROVIDER_DATE_COVERAGE', 'แพ็กเกจ Free ค้นหาวันนี้ เมื่อวาน และพรุ่งนี้ได้เท่านั้นครับ วันที่ไกลกว่านี้ต้องใช้แพ็กเกจที่รองรับ');
      if (/plan|subscription|season|access|token|key/.test(reason)) fail(503, 'PROVIDER_COVERAGE', 'แพ็กเกจหรือสิทธิ์ API ยังไม่รองรับข้อมูลนี้ เจ้าของเว็บต้องตรวจการตั้งค่าครับ');
      fail(502, 'PROVIDER_RESPONSE', 'ผู้ให้บริการยังไม่สามารถส่งข้อมูลตามคำขอนี้ได้ครับ');
    }
    if (!Array.isArray(data.response)) fail(502, 'PROVIDER_RESPONSE', 'รูปแบบข้อมูลฟุตบอลไม่ถูกต้องครับ');
    if (data.paging?.total > 1) fail(502, 'PROVIDER_PAGINATION', 'ข้อมูลชุดนี้มีหลายหน้าจากผู้ให้บริการ กรุณาระบุทีมและวันที่ให้เฉพาะเจาะจงขึ้นครับ');
    const result = { rows: data.response, fetchedAt: now().toISOString(), expires: now().getTime() + ttl };
    if (cache.size >= 64) cache.delete(cache.keys().next().value);
    cache.set(url.href, result);
    await store?.write(cacheKey, result, path, parameters);
    return result;
  }
  function json(value, status = 200, ttl = 0) {
    return Response.json(value, { status, headers: {
      'Cache-Control': 'no-store',
      'Netlify-CDN-Cache-Control': ttl ? `public, durable, max-age=${ttl}` : 'no-store',
      'Netlify-Vary': 'query=mode|date|teams|live|finished|page|fixture|upcoming|scheduled',
      'X-Content-Type-Options': 'nosniff'
    } });
  }
  return async function handler(request) {
    try {
      if (request.method !== 'GET') return new Response(null, { status: 405, headers: { Allow: 'GET' } });
      const p = new URL(request.url).searchParams;
      const mode = p.get('mode') || 'fixtures';
      if (!['fixtures', 'fixture', 'prediction'].includes(mode)) fail(400, 'INVALID_MODE', 'รูปแบบการค้นหาไม่ถูกต้องครับ');
      const base = { source: 'API-Football / API-Sports', timezone: TIMEZONE,
        coverage: 'ข้อมูลครอบคลุมตามลีก ฤดูกาล และแพ็กเกจของผู้ให้บริการ อาจมีความล่าช้า' };
      if (mode === 'fixtures') {
        const date = p.get('date') || bangkokDate(now());
        if (!validDate(date)) fail(400, 'INVALID_DATE', 'กรุณาระบุวันที่จริงในรูปแบบ YYYY-MM-DD ครับ');
        const page = Number(p.get('page') || '1');
        if (!Number.isInteger(page) || page < 1 || page > 1000) fail(400, 'INVALID_PAGE', 'เลขหน้าไม่ถูกต้องครับ');
        let teams;
        try { teams = JSON.parse(p.get('teams') || '[]'); } catch { fail(400, 'INVALID_TEAMS', 'รายชื่อทีมไม่ถูกต้องครับ'); }
        if (!Array.isArray(teams) || teams.length > 2 || teams.some(t => typeof t !== 'string' || !t.trim() || t.length > 80)) fail(400, 'INVALID_TEAMS', 'ค้นหาได้ครั้งละไม่เกินสองทีมครับ');
        const live = p.get('live') === '1';
        const upcoming = p.get('upcoming') === '1';
        const scheduled = p.get('scheduled') === '1' || upcoming;
        const finished = p.get('finished') === '1';
        if ((scheduled && (live || finished)) || (live && finished)) fail(400, 'INVALID_UPCOMING', 'กรุณาเลือกค้นหาคู่ยังไม่เริ่ม คู่กำลังแข่ง หรือคู่จบแล้วทีละสถานะครับ');
        let parameters = live ? { live: 'all', timezone: TIMEZONE } : { date, timezone: TIMEZONE };
        // The current Free subscription supports yesterday/today/tomorrow only.
        // Never call paid-only `next`, or imply this limited window is a full schedule.
        let fetched;
        if (upcoming) {
          const today = await provider('/fixtures', {date: bangkokDate(now()), timezone: TIMEZONE});
          const tomorrow = await provider('/fixtures', {date: bangkokDate(now(), 1), timezone: TIMEZONE});
          fetched = {rows: [...new Map([...today.rows, ...tomorrow.rows].map(row => [row.fixture.id, row])).values()], fetchedAt: [today.fetchedAt, tomorrow.fetchedAt].sort()[0]};
        } else fetched = await provider('/fixtures', parameters);
        const normalizedTeams = teams.map(normalize);
        let fixtures = fetched.rows.map(mapFixture).filter(f => normalizedTeams.every(t => normalize(`${f.home.name} ${f.away.name}`).includes(t)));
        if (scheduled) fixtures = fixtures.filter(f => ['NS', 'TBD'].includes(f.status));
        if (finished) fixtures = fixtures.filter(f => f.finished);
        fixtures.sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
        return json({ ...base, kind: 'fixtures', date, live, upcoming, scheduled, finished, fetchedAt: fetched.fetchedAt,
          scheduleNote: upcoming ? 'ค้นเฉพาะวันนี้และพรุ่งนี้ตามแพ็กเกจ Free ไม่ใช่ตารางนัดถัดไปทั้งหมด หากไม่พบ อาจแข่งหลังจากช่วงนี้ การค้นหาล่วงหน้าหลายวันต้องใช้แพ็กเกจที่รองรับ' : null,
          total: fixtures.length, page, pageSize: PAGE_SIZE,
          hasMore: page * PAGE_SIZE < fixtures.length,
          fixtures: fixtures.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
        }, 200, 60);
      }
      const fixtureId = p.get('fixture');
      if (!/^[1-9]\d{0,11}$/.test(fixtureId || '')) fail(400, 'INVALID_FIXTURE', 'กรุณาเลือกคู่แข่งขันจากรายการก่อนครับ');
      const fetched = await provider('/fixtures', { id: fixtureId, timezone: TIMEZONE });
      if (!fetched.rows.length) fail(404, 'FIXTURE_NOT_FOUND', 'ไม่พบคู่แข่งขันนี้ในข้อมูลผู้ให้บริการครับ');
      const fixture = mapFixture(fetched.rows[0]);
      if (mode === 'fixture') return json({ ...base, kind: 'fixture', fixture, fetchedAt: fetched.fetchedAt }, 200, 60);
      if (fixture.status !== 'NS') return json({ ...base, kind: 'prediction', fixture,
        available: false, reason: fixture.finished ? 'คู่นี้จบการแข่งขันแล้ว แสดงผลจริงแทนการคาดการณ์ครับ' : 'ระบบนี้แสดงค่าคาดการณ์ก่อนเริ่มแข่งเท่านั้น ยังไม่มีโอกาสชนะระหว่างเกมครับ', fetchedAt: fetched.fetchedAt }, 200, 60);
      const prediction = await provider('/predictions', { fixture: fixtureId }, 3600000);
      const percentages = parsePercentages(prediction.rows[0]?.predictions?.percent);
      return json({ ...base, kind: 'prediction', fixture, available: Boolean(percentages), percentages,
        reason: percentages ? null : 'ผู้ให้บริการยังไม่มีค่าคาดการณ์ที่สมบูรณ์สำหรับคู่นี้ครับ',
        model: 'แบบจำลองของ API-Football สำหรับก่อนเริ่มแข่ง ไม่ใช่ราคาเดิมพัน',
        note: 'เปอร์เซ็นต์เป็นค่าคาดการณ์ ไม่ใช่ผลที่รับประกัน และไม่ใช่โมเดลที่ Bot Chelsea คำนวณเอง',
        fetchedAt: prediction.fetchedAt
      }, 200, 60);
    } catch (error) {
      if (error instanceof FootballError) return json({ error: { code: error.code, message: error.message } }, error.status);
      return json({ error: { code: 'FOOTBALL_ERROR', message: 'ระบบข้อมูลฟุตบอลขัดข้อง กรุณาลองใหม่ภายหลังครับ' } }, 500);
    }
  };
}
const handler = createFootballHandler();
export default handler;
export const config = { rateLimit: { action: 'rate_limit', aggregateBy: 'ip', windowSize: 60, windowLimit: 30 } };
