import { buildTranslateMessages, cleanTranslation } from './translate-shared';

interface Env {
  AI: Ai;
  TRANSLATE_RL: RateLimit;
}

function json(x: unknown, status = 200): Response {
  return new Response(JSON.stringify(x), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);

      if (request.method !== 'POST' || url.pathname !== '/api/translate') {
        return json({ error: 'not found' }, 404);
      }

      if (request.headers.get('Sec-Fetch-Site') === 'cross-site') {
        return json({ error: 'forbidden' }, 403);
      }

      const { success } = await env.TRANSLATE_RL.limit({
        key: request.headers.get('CF-Connecting-IP') ?? 'anon',
      });
      if (!success) {
        return json({ error: 'rate limited' }, 429);
      }

      let body: { form?: unknown; base?: unknown; features?: unknown } = {};
      try {
        body = await request.json() as { form?: unknown; base?: unknown; features?: unknown };
      } catch {
        return json({ error: 'invalid' }, 400);
      }

      const { form, base, features } = body;

      // Reject forged/abusive payloads while admitting real data: JMdict glosses
      // run to ~130 chars, and a conjugation can stack many (~50) layers.
      if (
        typeof form !== 'string' || form.length === 0 || form.length > 512 ||
        typeof base !== 'string' || base.length === 0 || base.length > 256 ||
        !Array.isArray(features) || features.length > 50 ||
        !features.every((f): f is string => typeof f === 'string' && f.length <= 64)
      ) {
        return json({ error: 'invalid' }, 400);
      }

      const cacheKey = `https://verb-tower.internal/translate?b=${encodeURIComponent(base)}&f=${encodeURIComponent(form)}`;
      const cache = caches.default;
      const cached = await cache.match(cacheKey);
      if (cached) return cached;

      let translation = '';
      try {
        const messages = buildTranslateMessages(base, features, form);
        const out = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', { messages }) as { response?: string };
        translation = cleanTranslation(out.response ?? '');
      } catch {
        return json({ translation: '' });
      }

      const res = json({ translation });
      const responseToCache = new Response(JSON.stringify({ translation }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'cache-control': 'public, max-age=604800',
        },
      });
      ctx.waitUntil(cache.put(cacheKey, responseToCache.clone()));
      return res;
    } catch {
      return json({ error: 'internal error' }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
