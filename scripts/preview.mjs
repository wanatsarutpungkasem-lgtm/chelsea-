import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createFootballHandler } from '../netlify/functions/football.mjs';
import { bangkokDate } from '../dist/assets/js/football-query.mjs';

const root = path.resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const testData = process.argv.includes('--test-data');
const sample = status => ({
  fixture: { id: status === 'NS' ? 9001 : 9002, date: bangkokDate() + 'T23:00:00+07:00', status: { short: status, elapsed: null } },
  league: { name: 'UI Test League · ไม่ใช่ข้อมูลจริง', country: 'Test', round: '' },
  teams: { home: { id: 1, name: 'Test Alpha' }, away: { id: 2, name: 'Test Beta' } },
  goals: { home: status === 'NS' ? null : 0, away: status === 'NS' ? null : 0 },
  score: { penalty: { home: null, away: null } }
});
const football = testData ? createFootballHandler({
  getKey: () => 'local-ui-test-only',
  fetcher: async url => {
    const u = new URL(url);
    const rows = u.pathname === '/predictions' ? [{ predictions: { percent: { home: '45%', draw: '30%', away: '25%' } } }]
      : u.searchParams.has('id') ? [sample(u.searchParams.get('id') === '9002' ? 'FT' : 'NS')] : [sample('NS'), sample('FT')];
    return Response.json({ errors: [], response: rows, paging: { current: 1, total: 1 } });
  }
}) : createFootballHandler({ getKey: () => process.env.FOOTBALL_API_KEY });
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript', '.mjs': 'application/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };
const port = Number(process.env.PORT || 4173);
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    if (url.pathname === '/.netlify/functions/football') {
      const result = await football(new Request(url, { method: req.method }));
      res.writeHead(result.status, Object.fromEntries(result.headers)); res.end(Buffer.from(await result.arrayBuffer())); return;
    }
    let relative = decodeURIComponent(url.pathname);
    if (relative === '/') relative = '/index.html';
    if (relative === '/dashboard') relative = '/dashboard.html';
    const file = path.resolve(root, '.' + relative);
    if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403); res.end(); return; }
    let bytes = await readFile(file);
    if (testData && file.endsWith('.html')) bytes = Buffer.from(bytes.toString().replace('<body', '<body').replace(/(<body[^>]*>)/, '$1<aside role="note">LOCAL UI TEST — ทีมและเปอร์เซ็นต์ในหน้านี้เป็นข้อมูลทดสอบ ไม่ใช่ผลบอลจริง</aside>'));
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }); res.end(bytes);
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.listen(port, '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${port}${testData ? ' (synthetic UI test data)' : ''}`));
process.on('SIGINT', () => server.close(() => process.exit(0)));
