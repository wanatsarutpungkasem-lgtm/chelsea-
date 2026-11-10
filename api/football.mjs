import { createFootballHandler } from '../netlify/functions/football.mjs';
import { createFootballStore } from '../netlify/functions/football-store.mjs';

const handler = createFootballHandler({
  getKey: () => process.env.FOOTBALL_API_KEY,
  store: createFootballStore({ env: name => process.env[name] })
});

export default async function football(req, res) {
  const url = new URL(req.url, 'https://ohm-fanchelsea.vercel.app');
  url.searchParams.set('league', '39');
  const request = new Request(url, { method: req.method });
  const response = await handler(request);
  res.statusCode = response.status;
  response.headers.forEach((value, name) => {
    if (!name.toLowerCase().startsWith('netlify-')) res.setHeader(name, value);
  });
  res.end(await response.text());
}
