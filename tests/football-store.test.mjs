import test from 'node:test';
import assert from 'node:assert/strict';
import { createFootballStore } from '../netlify/functions/football-store.mjs';
import { createFootballHandler } from '../netlify/functions/football.mjs';

test('storage is disabled without server credentials', () => {
  assert.equal(createFootballStore({env: () => undefined}), null);
});
test('database read failures fall back without exposing credentials', async () => {
  const store = createFootballStore({env: k => k === 'SUPABASE_URL' ? 'https://test.supabase.co' : 'server-only',
    fetcher: async () => new Response('', {status: 403})});
  assert.equal(await store.read('/fixtures?date=2026-10-27', new Date()), null);
});
test('a fresh shared cache avoids a provider request', async () => {
  const now = new Date('2026-10-27T12:00:00Z');
  const handler = createFootballHandler({getKey: () => 'test-only', now: () => now,
    fetcher: () => assert.fail('provider must not be called'),
    store: {read: async () => ({rows: [], fetchedAt: now.toISOString(), expires: now.getTime()+60000})}});
  const r = await handler(new Request('https://test.invalid/?date=2026-10-27'));
  assert.equal(r.status, 200);
  assert.equal((await r.json()).total, 0);
});
test('cache writes never include provider authentication', async () => {
  let stored;
  const now = new Date('2026-10-27T12:00:00Z');
  const handler = createFootballHandler({getKey: () => 'provider-secret', now: () => now,
    fetcher: async () => Response.json({errors: [], response: []}),
    store: {read: async () => null, write: async (...args) => {stored=args;}}});
  await handler(new Request('https://test.invalid/?date=2026-10-27'));
  assert.ok(stored);
  assert.equal(JSON.stringify(stored).includes('provider-secret'), false);
});
