/* Service Worker — مصاريفي */
const CACHE_VERSION = 'v2.2.0';
const CACHE_NAME = `masarify-cache-${CACHE_VERSION}`;
const STATIC_ASSETS = [
  './',
  './index.html',
  './admin.html',
  './manifest.json',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js',
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Baloo+Bhaijaan+2:wght@500;700;800&display=swap',
];

// التثبيت: تخزين الموارد الثابتة
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// التفعيل: تنظيف الكاشات القديمة
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// الاستجابة: Cache First للثابتة، Network First للبيانات
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // تجاهل طلبات POST (Firestore writes)
  if (req.method !== 'GET') return;

  // تجاهل الطلبات غير http(s)
  if (!url.protocol.startsWith('http')) return;

  // CDN Firebase و Google Fonts: Cache First
  if (url.hostname === 'www.gstatic.com' || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        }
        return res;
      }).catch(() => caches.match(req)))
    );
    return;
  }

  // ملفات التطبيق المحلية (HTML/JS/CSS): Cache First
  if (url.origin === self.location.origin && (req.destination === 'document' || req.destination === 'script' || req.destination === 'style' || req.destination === 'manifest')) {
    event.respondWith(
      caches.match(req).then(cached => {
        const fetchPromise = fetch(req).then(res => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          }
          return res;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // باقي الطلبات: Network First
  event.respondWith(
    fetch(req).catch(() => caches.match(req).then(cached =>
      cached || (req.destination === 'document' ? caches.match('./index.html') : null)
    ))
  );
});

// استقبال رسالة لتحديث الكاش
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});