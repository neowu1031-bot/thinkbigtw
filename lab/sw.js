// MoneyRadar v186 PWA Service Worker (minimal)
const CACHE = 'mr-v186';
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => self.clients.claim());
self.addEventListener('fetch', e => {
  // Pass-through，不做激進 cache（避免股市資料卡舊）
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
