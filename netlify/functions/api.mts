import type { Config } from '@netlify/functions';
import { search, weatherPayload, comparison } from '../lib/weather.mts';

export default async (request: Request) => {
  if (request.method !== 'GET') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: { Allow: 'GET' } });
  const { pathname, searchParams } = new URL(request.url);
  try {
    let data;
    switch (pathname.replace(/\/$/, '')) {
      case '/api/search': data = await search(searchParams.get('q') || ''); break;
      case '/api/weather': data = await weatherPayload(searchParams); break;
      case '/api/compare': data = await comparison(searchParams); break;
      default: return Response.json({ error: 'Endpoint not found' }, { status: 404 });
    }
    return Response.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error instanceof RangeError ? error.message : 'Unable to load weather data. Please try again.' },
      { status: error instanceof RangeError ? 400 : 502 });
  }
};

export const config: Config = { path: '/api/*' };
