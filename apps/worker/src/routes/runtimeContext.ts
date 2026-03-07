import { Hono } from 'hono';

import type { Env } from '../index.ts';

export const runtimeContextRoute = new Hono<{ Bindings: Env }>();

function resolveLocaleFromCountry(country: string | null | undefined): 'en' | 'ko' | 'ja' {
  const normalized = (country ?? '').trim().toUpperCase();
  if (normalized === 'KR' || normalized === 'KOR') return 'ko';
  if (normalized === 'JP' || normalized === 'JPN') return 'ja';
  return 'en';
}

runtimeContextRoute.get('/', (c) => {
  const country = c.req.header('cf-ipcountry') ?? null;
  return c.json({
    country,
    locale: resolveLocaleFromCountry(country),
  });
});
