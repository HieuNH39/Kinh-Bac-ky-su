/* Service worker: lưu khung ứng dụng để mở được khi không có mạng.
   - Khung (HTML, CSS, JS, phông chữ, logo, danh mục di tích): lưu sẵn khi cài.
   - Dữ liệu di tích, ảnh, giọng đọc: lưu khi người dùng bấm "Tải về máy" (bộ nhớ hl-site-<mã>) hoặc khi đã mở.
   - Ô bản đồ OpenStreetMap: lưu những ô đã xem, tối đa 400 ô. */
const VERSION = "kb-shell-v3-1";
const SHELL = ["./", "index.html", "css/app.css", "js/app.js", "js/core.js", "js/i18n.js", "js/ui.js", "js/views-a.js", "js/views-b.js",
  "vendor/leaflet/leaflet.js", "vendor/leaflet/leaflet.css", "vendor/qrcode.js", "manifest.webmanifest", "data/index.json",
  "img/brand/logo-dau-son.svg", "img/brand/icon-app.svg", "img/brand/goc-khung.svg", "img/brand/song-nuoc.svg", "img/brand/may-cuon.svg",
  "fonts/alegreya-500.woff2", "fonts/alegreya-700.woff2", "fonts/alegreya-800.woff2", "fonts/alegreya-500-italic.woff2",
  "fonts/be-vietnam-pro-400.woff2", "fonts/be-vietnam-pro-500.woff2", "fonts/be-vietnam-pro-600.woff2", "fonts/be-vietnam-pro-700.woff2",
  "icons/icon-192.png", "icons/icon-512.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("kb-shell-") && k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
async function trimTiles(cache) { const keys = await cache.keys(); if (keys.length > 400) for (const k of keys.slice(0, keys.length - 400)) await cache.delete(k); }
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (url.hostname.endsWith("tile.openstreetmap.org")) {
    e.respondWith(caches.open("kb-tiles").then(async (c) => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      try { const r = await fetch(e.request); if (r.ok || r.type === "opaque") { c.put(e.request, r.clone()); trimTiles(c); } return r; } catch { return new Response("", { status: 504 }); }
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  if (e.request.headers.get("range")) return; // âm thanh tua: để trình duyệt tự xử lý
  const isData = url.pathname.endsWith(".json");
  e.respondWith((async () => {
    const hit = await caches.match(e.request, { ignoreSearch: true });
    if (hit && !isData) return hit;
    try {
      const r = await fetch(e.request);
      if (r.ok && (isData || /\.(webp|jpg|png|svg|woff2|js|css)$/.test(url.pathname))) {
        const c = await caches.open(isData ? VERSION : "kb-runtime"); c.put(e.request, r.clone());
      }
      return r;
    } catch {
      return hit || (e.request.mode === "navigate" ? caches.match("index.html") : new Response("", { status: 504 }));
    }
  })());
});
