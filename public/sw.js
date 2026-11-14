// v4 (14 Nov 2026, logo JRENG): ikon baru ber-versi (public/brand/*-v2) + logo JRENG header di-precache supaya tetap
// tampil saat offline. Cache v3 dibuang saat activate (pola sama dgn v2->v3). v3 (3 Okt 2026): cache v2 lama dibuang.
const CACHE_NAME = 'vista-pekerja-shell-v4';
// Precache NON-FATAL: diambil satu per satu; berkas yang gagal hanya dilewati (dicatat di konsol SW), SW tetap terpasang.
// Hanya balasan gambar yang disimpan (rewrite SPA Vercel membalas berkas yang tidak ada dgn index.html 200).
const PRECACHE = ['/brand/logo-header-v2.png'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((c) => Promise.allSettled(PRECACHE.map((u) =>
      fetch(u, { cache: 'reload' })
        .then((res) => { if (res && res.ok && (res.headers.get('content-type') || '').startsWith('image/')) return c.put(u, res); throw new Error('bukan gambar / HTTP ' + (res && res.status)); })
        .catch((e) => console.warn('[SW] precache dilewati', u, e && e.message))
    ))).catch((e) => console.warn('[SW] precache gagal total (diabaikan)', e && e.message))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Cuma cache APP SHELL (HTML/JS/CSS/font/icon aplikasi sendiri, same-origin GET) - request ke
// Supabase (origin beda: *.supabase.co) TIDAK PERNAH lewat sini sama sekali, selalu langsung ke
// network apa adanya. Level ini gak pernah nyimpen DATA, cuma KODE aplikasinya biar loading awal
// tetap cepat pas sinyal lemot.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isHashedAsset = url.pathname.startsWith('/assets/');
  if (isHashedAsset) {
    // Nama file dari Vite punya hash konten (mis. index-abc123.js) - begitu ke-cache gak akan
    // pernah stale, aman cache-first biar gak download ulang tiap buka.
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, clone));
        }
        return res;
      }))
    );
    return;
  }

  // index.html/manifest/ikon dll - network-first biar versi APLIKASI TERBARU yang kepakai kalau
  // online, cache cuma fallback pas sinyal lemot/putus biar shell tetap kebuka (bukan network-only,
  // beda dari sebelumnya yang caches.match-nya gak pernah ke-isi sama sekali).
  // FIX LOOP (3 Okt 2026): halaman (navigate) diambil tanpa cache HTTP browser sama sekali -
  // cache SW cuma dipakai kalau benar-benar offline. (Request mode navigate gak boleh diberi
  // init, jadi fetch lewat URL-nya.)
  const ambil = req.mode === 'navigate' ? fetch(req.url, { cache: 'no-store', credentials: 'same-origin' }) : fetch(req);
  event.respondWith(
    ambil.then((res) => {
      // (14 Nov 2026) Balasan HTML utk permintaan NON-halaman (gambar/manifest yg tidak ada -> rewrite SPA Vercel
      // membalas index.html 200) tidak disimpan, supaya cache offline tidak berisi HTML atas nama PNG.
      const htmlNyasar = req.mode !== 'navigate' && (res.headers.get('content-type') || '').includes('text/html');
      if (res && res.ok && !htmlNyasar) {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, clone));
      }
      return res;
    }).catch(() => caches.match(req))
  );
});

// Push notification (pengingat Maintenance Rutin jatuh tempo, dikirim dari edge function
// maintenance-reminder-check di vista-teknik via Web Push API) - payload JSON {title,body,url}.
self.addEventListener('push', (event) => {
  let payload = { title: 'Vista Pekerja', body: 'Ada pembaruan.', url: '/' };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch { /* payload bukan JSON valid - pakai default */ }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/brand/icon-192-v2.png', // logo JRENG lengkap
      badge: '/brand/badge-96-v2.png', // siluet putih badan maskot (Android hanya memakai alpha-nya)
      data: { url: payload.url },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
