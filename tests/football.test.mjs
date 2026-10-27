import test from 'node:test';
import assert from 'node:assert/strict';
import { bangkokDate, validDate, parseFootballQuestion } from '../dist/assets/js/football-query.mjs';
import { createFootballHandler, mapFixture, parsePercentages } from '../netlify/functions/football.mjs';

const CLOCK = new Date('2026-10-27T18:30:00Z');
function fixture(id = 101, status = 'NS', home = 'Test Home', away = 'Test Away') {
  return { fixture: { id, date: '2026-10-28T14:00:00+07:00', status: { short: status, elapsed: status === '2H' ? 65 : null } },
    league: { name: 'Test League', country: 'Test Country', round: 'Test round' },
    teams: { home: { id: id * 2, name: home }, away: { id: id * 2 + 1, name: away } },
    goals: { home: status === 'NS' ? null : 0, away: status === 'NS' ? null : 0 },
    score: { penalty: { home: null, away: null } } };
}
function mockProvider(rows, prediction = { home: '45%', draw: '30%', away: '25%' }) {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url: String(url), options });
    const data = new URL(url).pathname === '/predictions' ? [{ predictions: { percent: prediction } }] : rows;
    return Response.json({ errors: [], response: data, paging: { current: 1, total: 1 } });
  };
  const handler = createFootballHandler({ getKey: () => 'unit-test-secret', fetcher, now: () => CLOCK });
  const run = async query => {
    const response = await handler(new Request('https://example.invalid/.netlify/functions/football?' + new URLSearchParams(query)));
    return { response, body: await response.json() };
  };
  return { calls, handler, run };
}

test('dates use Bangkok day across UTC midnight and year rollover', () => {
  assert.equal(bangkokDate(CLOCK), '2026-10-28');
  assert.equal(bangkokDate(new Date('2026-12-31T18:00:00Z'), 1), '2027-01-02');
  assert.equal(parseFootballQuestion('ผลบอลเมื่อวาน', CLOCK).date, '2026-10-27');
  assert.equal(parseFootballQuestion('ผลบอลเมื่อคืน', CLOCK).date, '2026-10-27');
  assert.equal(parseFootballQuestion('บอลพรุ่งนี้', CLOCK).date, '2026-10-29');
});
test('rejects impossible dates instead of rolling them into another month', () => {
  assert.equal(validDate('2026-02-30'), false);
  assert.equal(validDate('2028-02-29'), true);
  assert.equal(parseFootballQuestion('ผลบอล 2026-13-02', CLOCK).valid, false);
});
test('Thai club aliases and Buddhist-year dates are parsed without forwarding raw chat', () => {
  const q = parseFootballQuestion('เชลซี พบ อาร์เซนอล คาดการณ์ 28/10/2569', CLOCK);
  assert.deepEqual(q.teams, ['chelsea', 'arsenal']);
  assert.equal(q.date, '2026-10-28');
  assert.equal(q.prediction, true);
});
test('unlisted English club pairs can be searched', () => {
  assert.deepEqual(parseFootballQuestion('Ajax vs PSV 2026-11-01', CLOCK).teams, ['ajax', 'psv']);
  assert.equal(parseFootballQuestion('วันนี้มีใครเตะบ้าง', CLOCK).sport, true);
  assert.equal(parseFootballQuestion('เกมนี้จบเท่าไหร่', CLOCK).sport, true);
});
test('actual zero scores and unplayed null scores stay distinct', () => {
  assert.deepEqual(mapFixture(fixture(1, 'FT')).goals, { home: 0, away: 0 });
  assert.deepEqual(mapFixture(fixture(1, 'NS')).goals, { home: null, away: null });
  assert.equal(mapFixture(fixture(1, 'PST')).finished, false);
});
test('valid percentages include zero and malformed totals are not invented', () => {
  assert.deepEqual(parsePercentages({ home: '100%', draw: '0%', away: '0%' }), { home: 100, draw: 0, away: 0 });
  assert.equal(parsePercentages({ home: '70%', draw: '70%', away: '0%' }), null);
  assert.equal(parsePercentages({ home: '', draw: '50%', away: '50%' }), null);
  assert.equal(parsePercentages({ home: '-5%', draw: '55%', away: '50%' }), null);
  assert.equal(parsePercentages(null), null);
});
test('missing key is a clear setup response and never calls the provider', async () => {
  const handler = createFootballHandler({ getKey: () => '', fetcher: () => assert.fail('unexpected upstream request') });
  const response = await handler(new Request('https://test.invalid/?date=2026-10-28'));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'FOOTBALL_NOT_CONFIGURED');
  assert.equal(response.headers.get('Netlify-CDN-Cache-Control'), 'no-store');
});
test('date and method validation happen before spending API quota', async () => {
  const api = mockProvider([]);
  assert.equal((await api.run({ date: '2026-02-30' })).response.status, 400);
  assert.equal((await api.run({ date: '2026-10-28', page: '-1' })).response.status, 400);
  assert.equal((await api.run({ teams: 'not-json' })).response.status, 400);
  assert.equal((await api.handler(new Request('https://test.invalid/', { method: 'POST' }))).status, 405);
  assert.equal(api.calls.length, 0);
});
test('daily results are paginated, cached and do not expose keys', async () => {
  const api = mockProvider(Array.from({ length: 12 }, (_, i) => fixture(i + 1)));
  const first = await api.run({ date: '2026-10-28' });
  const second = await api.run({ date: '2026-10-28', page: '2' });
  assert.equal(first.body.total, 12); assert.equal(first.body.fixtures.length, 10); assert.equal(first.body.hasMore, true);
  assert.equal(second.body.fixtures.length, 2); assert.equal(second.body.hasMore, false);
  assert.equal(api.calls.length, 1);
  assert.match(first.response.headers.get('Netlify-CDN-Cache-Control'), /durable/);
  assert.equal(JSON.stringify(first.body).includes('unit-test-secret'), false);
  assert.equal(api.calls[0].options.headers['x-apisports-key'], 'unit-test-secret');
});
test('two-team search distinguishes opponents and also accepts a zero-result search', async () => {
  const api = mockProvider([fixture(1, 'FT', 'Chelsea', 'Arsenal'), fixture(2, 'FT', 'Chelsea', 'Test Away')]);
  const result = await api.run({ date: '2026-10-28', teams: JSON.stringify(['chelsea', 'arsenal']) });
  assert.equal(result.body.total, 1);
  assert.equal((await api.run({ date: '2026-10-28', teams: JSON.stringify(['ajax']) })).body.total, 0);
});
test('live and finished filters use actual provider status', async () => {
  const api = mockProvider([fixture(1, 'FT'), fixture(2, '2H'), fixture(3, 'NS')]);
  assert.equal((await api.run({ date: '2026-10-28', finished: '1' })).body.total, 1);
  await api.run({ live: '1' });
  assert.equal(new URL(api.calls.at(-1).url).searchParams.get('live'), 'all');
});
test('pregame predictions preserve the provider breakdown', async () => {
  const api = mockProvider([fixture()]);
  const { body } = await api.run({ mode: 'prediction', fixture: '101' });
  assert.equal(body.available, true);
  assert.deepEqual(body.percentages, { home: 45, draw: 30, away: 25 });
  assert.match(body.note, /ไม่ใช่โมเดลที่ Bot Chelsea คำนวณเอง/);
});
test('finished and live matches never show an outdated pregame prediction', async () => {
  for (const state of ['FT', 'PEN', '2H', 'PST']) {
    const api = mockProvider([fixture(101, state)]);
    const { body } = await api.run({ mode: 'prediction', fixture: '101' });
    assert.equal(body.available, false);
    assert.equal(api.calls.length, 1);
  }
});
test('incomplete prediction data is unavailable instead of guessed', async () => {
  const api = mockProvider([fixture()], { home: null, draw: '40%', away: '60%' });
  const { body } = await api.run({ mode: 'prediction', fixture: '101' });
  assert.equal(body.available, false); assert.equal(body.percentages, null);
});
test('quota and plan errors inside HTTP 200 are not interpreted as no matches', async () => {
  for (const [errors, status, code] of [
    [{ requests: 'Daily request limit reached' }, 429, 'PROVIDER_QUOTA'],
    [{ plan: 'Season not available in your subscription' }, 503, 'PROVIDER_COVERAGE']
  ]) {
    const handler = createFootballHandler({ getKey: () => 'test-secret', fetcher: async () => Response.json({ errors, response: [] }) });
    const response = await handler(new Request('https://test.invalid/?date=2026-10-28'));
    assert.equal(response.status, status); assert.equal((await response.json()).error.code, code);
  }
});
test('provider timeouts and missing fixtures return meaningful errors', async () => {
  const handler = createFootballHandler({ getKey: () => 'test-secret', fetcher: async () => { throw new Error('network'); } });
  assert.equal((await handler(new Request('https://test.invalid/?date=2026-10-28'))).status, 504);
  const api = mockProvider([]);
  const missing = await api.run({ mode: 'fixture', fixture: '101' });
  assert.equal(missing.response.status, 404);
});

test('Liverpool never activates live mode by substring', () => {
  for (const text of ['liverpool เตะวันไหน', 'Liverpool วันนี้', 'chelsea เตะวันไหน', 'ลิเวอร์พูลเตะเมื่อไหร่']) {
    const q = parseFootballQuestion(text, CLOCK);
    assert.equal(q.live, false, text);
  }
  assert.equal(parseFootballQuestion('Liverpool live', CLOCK).live, true);
  assert.equal(parseFootballQuestion('ลิเวอร์พูลกำลังแข่ง', CLOCK).live, true);
});
test('when questions use upcoming search but explicit dates stay date searches', () => {
  assert.equal(parseFootballQuestion('Liverpool เตะวันไหน', CLOCK).upcoming, true);
  assert.equal(parseFootballQuestion('Chelsea เตะเมื่อไหร่', CLOCK).upcoming, true);
  assert.equal(parseFootballQuestion('Liverpool เตะวันไหน 2026-11-01', CLOCK).upcoming, false);
  assert.equal(parseFootballQuestion('Liverpool วันนี้', CLOCK).upcoming, false);
});
test('Free upcoming search checks today and tomorrow, never paid-only next', async () => {
  const api = mockProvider([fixture(101, 'NS', 'Liverpool', 'Test Away')]);
  const {body, response} = await api.run({upcoming:'1', teams: JSON.stringify(['liverpool'])});
  assert.equal(response.status, 200);
  assert.equal(body.upcoming, true);
  assert.match(body.scheduleNote, /Free/);
  assert.equal(api.calls.length, 2);
  assert.deepEqual(api.calls.map(c=>new URL(c.url).searchParams.get('date')), ['2026-10-28','2026-10-29']);
  assert.equal(api.calls.some(c=>new URL(c.url).searchParams.has('next')), false);
});
test('upcoming search supports all teams but rejects conflicting live mode', async () => {
  const api = mockProvider([]);
  assert.equal((await api.run({upcoming:'1',live:'1',teams:'["liverpool"]'})).response.status, 400);
  assert.equal(api.calls.length,0);
  assert.equal((await api.run({upcoming:'1'})).response.status, 200);
});
test('Free date restrictions are explained instead of reported as an empty schedule', async () => {
  const handler = createFootballHandler({getKey:()=> 'test-only', fetcher:async()=>Response.json({errors:{plan:'Free plans do not have access to this date, try from 2026-10-26 to 2026-10-28.'},response:[]})});
  const response=await handler(new Request('https://test.invalid/?date=2026-11-01'));
  assert.equal((await response.json()).error.code,'PROVIDER_DATE_COVERAGE');
});

test('Thai pending and completed phrases select separate statuses', () => {
  for(const text of ['ฟุตบอลกำลังจะแข่งขัน','ฟุตบอลกำลังจะเตะ','คู่ที่ยังไม่เตะ']) {
    const p=parseFootballQuestion(text,CLOCK);
    assert.equal(p.sport,true,text); assert.equal(p.scheduled,true,text);
    assert.equal(p.upcoming,true,text); assert.equal(p.live,false,text); assert.equal(p.finished,false,text);
  }
  for(const text of ['ฟุตบอลที่แข่งจบแล้ว','ฟุตบอลเสร็จแล้ว','คู่ที่เตะแล้ว','ฟุตบอลแข่งเสร็จแล้ว']) {
    const p=parseFootballQuestion(text,CLOCK);
    assert.equal(p.finished,true,text); assert.equal(p.live,false,text); assert.equal(p.upcoming,false,text);
  }
});
test('bare club names request schedules and dated requests keep their day', () => {
  for(const text of ['Liverpool','chelsea','ลิเวอร์พูล','เชลซี','Ajax','Everton เตะวันไหน']) {
    const p=parseFootballQuestion(text,CLOCK);
    assert.equal(p.teams.length,1,text); assert.equal(p.upcoming,true,text); assert.equal(p.scheduled,true,text);
  }
  assert.equal(parseFootballQuestion('ฟุตบอลกำลังจะเตะพรุ่งนี้',CLOCK).upcoming,false);
  assert.equal(parseFootballQuestion('ฟุตบอลกำลังจะเตะพรุ่งนี้',CLOCK).scheduled,true);
  assert.equal(parseFootballQuestion('Liverpool แข่งจบแล้ว',CLOCK).finished,true);
});
test('scheduled lists exclude live, completed, postponed and cancelled fixtures', async () => {
  const api=mockProvider(['NS','TBD','1H','HT','FT','PEN','PST','CANC'].map((s,i)=>fixture(i+1,s)));
  const {body}=await api.run({scheduled:'1',date:'2026-10-28'});
  assert.deepEqual(body.fixtures.map(f=>f.status),['NS','TBD']);
  assert.equal(body.scheduled,true);
  const finished=await api.run({finished:'1',date:'2026-10-28'});
  assert.deepEqual(finished.body.fixtures.map(f=>f.status),['FT','PEN']);
  assert.equal(finished.body.finished,true);
});
test('upcoming all-team results contain only unstarted fixtures across both dates', async () => {
  const api=mockProvider([fixture(1,'NS'),fixture(2,'FT'),fixture(3,'2H')]);
  const {body}=await api.run({upcoming:'1'});
  assert.ok(body.fixtures.length>0);
  assert.equal(body.fixtures.every(f=>['NS','TBD'].includes(f.status)),true);
});

test('Al Taee Thai spellings and playing-today questions resolve to the provider team', () => {
  for(const text of ['คู่ อัล ทาอิ เตะไหม','อัลทาอิเตะมั้ย','อัล ทาอี วันนี้','Al Tai เตะไหม','Al Taee เตะไหม']) {
    const p=parseFootballQuestion(text,CLOCK);
    assert.deepEqual(p.teams,['al taee'],text);
    assert.equal(p.sport,true,text);
    assert.equal(p.upcoming,false,text);
    assert.equal(p.scheduled,false,text);
    assert.equal(p.live,false,text);
    assert.equal(p.finished,false,text);
  }
  assert.equal(parseFootballQuestion('อัล ทาอิ เตะวันไหน',CLOCK).upcoming,true);
  assert.equal(parseFootballQuestion('อัล ทาอิ กำลังจะเตะ',CLOCK).scheduled,true);
});
test('playing-today searches do not hide a live or finished Al Taee game', async () => {
  for(const status of ['NS','2H','FT']) {
    const api=mockProvider([fixture(101,status,'Al Taee','Jeddah Club')]);
    const p=parseFootballQuestion('คู่ อัล ทาอิ เตะไหม',CLOCK);
    const {body}=await api.run({date:p.date,teams:JSON.stringify(p.teams),scheduled:p.scheduled?'1':'0',upcoming:p.upcoming?'1':'0'});
    assert.equal(body.total,1,status);
    assert.equal(body.fixtures[0].status,status);
  }
});

test('lineup questions recognize Thai and English without inventing a team name', () => {
  for(const text of ['line up มาตอนไหน','lineup คู่นี้','ไลน์อัพคู่นี้','รายชื่อนักเตะคู่นี้']) {
    const p=parseFootballQuestion(text,CLOCK);
    assert.equal(p.lineup,true,text); assert.equal(p.sport,true,text); assert.deepEqual(p.teams,[],text);
  }
  const p=parseFootballQuestion('Chelsea lineup',CLOCK);
  assert.deepEqual(p.teams,['chelsea']); assert.equal(p.lineup,true); assert.equal(p.upcoming,false);
});
async function lineupTest(rows) {
  const calls=[];
  const f=fixture(101,'NS');
  const handler=createFootballHandler({getKey:()=> 'test-only',now:()=>CLOCK,fetcher:async url=>{
    calls.push(new URL(url));
    return Response.json({errors:[],response:new URL(url).pathname==='/fixtures/lineups'?rows:[f]});
  }});
  const response=await handler(new Request('https://test.invalid/?mode=lineup&fixture=101'));
  return {response,body:await response.json(),calls};
}
const lineupTeam = (id,count=11) => ({team:{id},formation:'4-3-3',coach:{name:'Test Coach'},startXI:Array.from({length:count},(_,i)=>({player:{name:'Test Player '+i,number:i+1,pos:'M'}})),substitutes:[{player:{name:'Test Sub',number:12,pos:'G'}}]});
test('lineups return both starting elevens, bench and an indicative 20–40 minute window',async()=>{
  const {body,response,calls}=await lineupTest([lineupTeam(202),lineupTeam(203)]);
  assert.equal(response.status,200); assert.equal(body.status,'ready');
  assert.equal(body.lineups[0].starters.length,11); assert.equal(body.lineups[1].substitutes.length,1);
  const kickoff=new Date(body.fixture.date).getTime();
  assert.equal(new Date(body.expectedWindow.from).getTime(),kickoff-40*60000);
  assert.equal(new Date(body.expectedWindow.to).getTime(),kickoff-20*60000);
  assert.equal(calls[1].pathname,'/fixtures/lineups'); assert.equal(calls[1].searchParams.get('fixture'),'101');
});
test('empty, one-sided and incomplete lineups are never called fully announced',async()=>{
  assert.equal((await lineupTest([])).body.status,'unavailable');
  assert.equal((await lineupTest([lineupTeam(202)])).body.status,'partial');
  assert.equal((await lineupTest([lineupTeam(202,10),lineupTeam(203)])).body.status,'partial');
});
test('invalid fixture IDs spend no lineup quota',async()=>{
  const handler=createFootballHandler({getKey:()=> 'test-only',fetcher:()=>assert.fail('unexpected provider request')});
  const r=await handler(new Request('https://test.invalid/?mode=lineup&fixture=oops'));
  assert.equal(r.status,400);
});
