/* Service Worker · Conversor EAMR v1.0
   Estrategia: precaché del shell + bibliotecas CDN; cache-first con actualización en segundo plano. */
const VERSION = 'conversor-eamr-v1';
const SHELL = ['./', './index.html'];
const CDN = [
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js',
  'https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.js',
  'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pptxgenjs/3.12.0/pptxgen.bundle.js'
];
const ALLOWED = ['cdn.tailwindcss.com', 'cdnjs.cloudflare.com', 'cdn.jsdelivr.net'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await Promise.allSettled(SHELL.map(u => c.add(u)));
    // Cada biblioteca se guarda por separado: si una falla, las demás se conservan.
    await Promise.allSettled(CDN.map(async u => {
      const r = await fetch(u, { mode: 'cors' });
      if (r.ok) await c.put(u, r);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !ALLOWED.includes(url.hostname)) return;

  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const key = sameOrigin ? req : req.url;
    const hit = await cache.match(key, { ignoreSearch: sameOrigin });
    const refresh = fetch(req).then(r => {
      if (r && (r.ok || r.type === 'opaque')) cache.put(key, r.clone());
      return r;
    });
    if (hit) { refresh.catch(() => {}); return hit; }
    try { return await refresh; }
    catch (err) {
      if (req.mode === 'navigate') { const shell = await cache.match('./index.html'); if (shell) return shell; }
      return new Response('Sin conexión y recurso no guardado.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  })());
});
