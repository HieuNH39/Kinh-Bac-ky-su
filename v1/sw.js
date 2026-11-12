/* sw.js — Service worker: cho ứng dụng chạy được khi mất mạng.
   - Phần khung (giao diện, dữ liệu, phông chữ) được lưu ngay lần mở đầu tiên.
   - Ảnh và âm thanh được lưu khi đã mở/nghe, hoặc khi bấm "Tải về để dùng khi mất mạng".
   - Ô bản đồ nền được lưu khi đã xem (tối đa 400 ô). */
const VERSION = "hl-shell-v3";
const MEDIA = "hl-media-v1";
const TILES = "hl-tiles-v1";
const SHELL = [
  "./", "index.html", "css/app.css", "js/i18n.js", "js/geo.js", "js/player.js", "js/app.js",
  "data/content.json", "data/quiz.json", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png",
  "vendor/leaflet/leaflet.js", "vendor/leaflet/leaflet.css",
  "fonts/be-vietnam-pro-vietnamese-400-normal.woff2", "fonts/be-vietnam-pro-latin-400-normal.woff2",
  "fonts/be-vietnam-pro-vietnamese-600-normal.woff2", "fonts/be-vietnam-pro-latin-600-normal.woff2",
  "fonts/noto-serif-vietnamese-700-normal.woff2", "fonts/noto-serif-latin-700-normal.woff2",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k.startsWith("hl-shell-") && k !== VERSION).map((k) => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

// Safari xin âm thanh theo từng đoạn (Range); trả đúng đoạn được xin từ bản đã lưu
async function rangeResponse(req, res) {
  const range = req.headers.get("range");
  if (!range) return res;
  const buf = await res.arrayBuffer();
  const m = /bytes=(\d+)-(\d*)/.exec(range);
  const start = Number(m[1]), end = m[2] ? Number(m[2]) : buf.byteLength - 1;
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: { "Content-Type": res.headers.get("Content-Type") || "audio/mpeg",
      "Content-Range": `bytes ${start}-${end}/${buf.byteLength}`, "Content-Length": String(end - start + 1),
      "Accept-Ranges": "bytes" },
  });
}

async function trimTiles() {
  const c = await caches.open(TILES); const keys = await c.keys();
  for (let i = 0; i < keys.length - 400; i++) await c.delete(keys[i]);
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Ô bản đồ OpenStreetMap: dùng bản đã lưu nếu có, đồng thời cập nhật
  if (url.hostname.endsWith("tile.openstreetmap.org")) {
    e.respondWith(caches.open(TILES).then(async (c) => {
      const hit = await c.match(req);
      const net = fetch(req).then((r) => { if (r.ok) { c.put(req, r.clone()); trimTiles(); } return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (url.origin !== location.origin) return;

  // Ảnh và âm thanh: ưu tiên bản đã lưu, chưa có thì tải và lưu lại
  if (/\/(img|audio)\//.test(url.pathname)) {
    e.respondWith((async () => {
      const key = url.pathname.replace(/^.*?\/(img|audio)\//, "$1/");
      const c = await caches.open(MEDIA);
      let hit = await c.match(req, { ignoreSearch: true }) || await c.match(key);
      if (!hit) {
        const net = await fetch(url.href);
        if (net.ok) { await c.put(url.href, net.clone()); hit = net; } else return net;
      }
      return rangeResponse(req, hit);
    })().catch(() => fetch(req)));
    return;
  }

  // Phần khung: dùng bản đã lưu, đồng thời lấy bản mới
  e.respondWith(caches.open(VERSION).then(async (c) => {
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
