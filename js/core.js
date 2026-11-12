// Lõi dùng chung: lưu trên máy, nhật ký ẩn danh, định vị, trình phát, đổi lịch âm – dương.

// ---------- Lưu trên máy (trình duyệt có thể chặn nên luôn bọc try/catch) ----------
const P = "hl2:";
export const store = {
  get(k, d) { try { const v = localStorage.getItem(P + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(P + k, JSON.stringify(v)); } catch { /* đầy bộ nhớ hoặc bị chặn */ } },
  del(k) { try { localStorage.removeItem(P + k); } catch { /* bỏ qua */ } },
  clearAll() { try { Object.keys(localStorage).filter((k) => k.startsWith(P)).forEach((k) => localStorage.removeItem(k)); } catch { /* bỏ qua */ } },
};

export const settings = Object.assign(
  { lang: (navigator.language || "vi").startsWith("vi") ? "vi" : (navigator.language || "").startsWith("ko") ? "ko" : "en",
    theme: "auto", size: "vua", speed: 1, autoplay: true, sim: "" },
  store.get("settings", {}),
);
export function saveSettings() { store.set("settings", settings); }

// ---------- Tiến độ của người dùng ----------
export const progress = Object.assign({ listened: {}, arrived: {}, quiz: {}, stamped: {} }, store.get("progress", {}));
export function saveProgress() { store.set("progress", progress); }
export const PASS = (n) => Math.ceil(n * 0.75); // số câu đúng tối thiểu để nhận dấu

export function markListened(stopId) { progress.listened[stopId] = Date.now(); saveProgress(); }
export function markArrived(siteId, method, acc) {
  if (!progress.arrived[siteId]) { progress.arrived[siteId] = { t: Date.now(), method, acc: acc ?? null }; saveProgress(); }
  logEvent("arrive", { site: siteId, method, acc: acc == null ? null : Math.round(acc) });
  return checkStamp(siteId);
}
export function recordQuiz(siteId, score, total) {
  const best = progress.quiz[siteId];
  if (!best || score > best.score) progress.quiz[siteId] = { score, total, t: Date.now() };
  saveProgress();
  logEvent("quiz", { site: siteId, score, total });
  return checkStamp(siteId);
}
export function checkStamp(siteId) {
  const q = progress.quiz[siteId];
  if (progress.stamped[siteId]) return false;
  if (progress.arrived[siteId] && q && q.score >= PASS(q.total)) {
    progress.stamped[siteId] = Date.now(); saveProgress(); logEvent("stamp", { site: siteId });
    return true;
  }
  return false;
}

// ---------- Nhật ký sử dụng ẩn danh ----------
const LOG_MAX = 3000;
let session = store.get("session", null);
if (!session || Date.now() - session.t > 6 * 3600e3) { session = { id: Math.random().toString(36).slice(2, 8), t: Date.now() }; store.set("session", session); }
export function logEvent(type, data = {}) {
  const log = store.get("log", []);
  log.push({ t: new Date().toISOString(), s: session.id, type, lang: settings.lang, ...data });
  if (log.length > LOG_MAX) log.splice(0, log.length - LOG_MAX);
  store.set("log", log);
}
export function logAsCsv() {
  const log = store.get("log", []);
  const cols = ["t", "s", "type", "lang", "site", "stop", "method", "acc", "score", "total", "source", "pct"];
  const q = (v) => (v == null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  return [cols.join(","), ...log.map((e) => cols.map((c) => q(e[c])).join(","))].join("\n");
}

// ---------- Định vị ----------
export const Geo = {
  position: null, accuracy: null, watching: false, listeners: new Set(), error: null,
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
  emit() { this.listeners.forEach((fn) => fn(this.position)); },
  start() {
    if (this.watching || !("geolocation" in navigator)) return;
    this.watching = true;
    navigator.geolocation.watchPosition(
      (p) => { this.position = { lat: p.coords.latitude, lng: p.coords.longitude }; this.accuracy = p.coords.accuracy; this.error = null; this.emit(); },
      (e) => { this.error = e.message; this.watching = e.code !== 1 && this.watching; this.emit(); },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
    );
  },
  simulate(pos) { this.position = pos; this.accuracy = pos ? 5 : null; this.emit(); },
  distance(a, b) {
    const R = 6371000, r = Math.PI / 180;
    const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  },
  fmt(m) { return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0).replace(".", ",")} km`; },
};

// ---------- Trình phát ----------
export const Player = {
  audio: new Audio(), item: null, queue: [], qi: -1, listeners: new Set(), endedHandlers: new Set(),
  init() {
    const a = this.audio;
    a.preload = "none";
    ["play", "pause", "timeupdate", "loadedmetadata"].forEach((ev) => a.addEventListener(ev, () => this.emit()));
    a.addEventListener("ended", () => {
      if (this.item) { markListened(this.item.id); logEvent("complete", { stop: this.item.id, site: this.item.siteId }); }
      const done = this.item;
      if (this.queue.length && this.qi + 1 < this.queue.length) { setTimeout(() => this.playAt(this.qi + 1), 1500); }
      this.emit();
      this.endedHandlers.forEach((fn) => fn(done));
    });
    a.addEventListener("error", () => { this.error = true; this.emit(); });
    if ("mediaSession" in navigator) {
      navigator.mediaSession.setActionHandler("play", () => a.play());
      navigator.mediaSession.setActionHandler("pause", () => a.pause());
      navigator.mediaSession.setActionHandler("seekbackward", () => { a.currentTime = Math.max(0, a.currentTime - 10); });
      navigator.mediaSession.setActionHandler("seekforward", () => { a.currentTime = Math.min(a.duration || 0, a.currentTime + 10); });
      navigator.mediaSession.setActionHandler("nexttrack", () => this.next());
      navigator.mediaSession.setActionHandler("previoustrack", () => this.prev());
    }
  },
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
  onEnded(fn) { this.endedHandlers.add(fn); return () => this.endedHandlers.delete(fn); },
  emit() { this.listeners.forEach((fn) => fn(this)); },
  isPlaying(id) { return this.item && this.item.id === id && !this.audio.paused; },
  play(item, source = "tap") {
    this.queue = []; this.qi = -1;
    this._load(item, source);
  },
  playQueue(items, start = 0, source = "class") { this.queue = items; this.playAt(start, source); },
  playAt(i, source = "class") { this.qi = i; this._load(this.queue[i], source); },
  next() { if (this.qi + 1 < this.queue.length) this.playAt(this.qi + 1); },
  prev() { if (this.qi > 0) this.playAt(this.qi - 1); },
  _load(item, source) {
    this.error = false;
    if (!this.item || this.item.src !== item.src) { this.audio.src = item.src; }
    this.item = item;
    this.audio.playbackRate = settings.speed;
    this.audio.play().catch(() => { /* cần người dùng chạm trước */ });
    logEvent("play", { stop: item.id, site: item.siteId, source });
    if ("mediaSession" in navigator && window.MediaMetadata) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: item.title, artist: item.siteName || "Kinh Bắc Ký Sự", album: "Kinh Bắc Ký Sự",
        artwork: item.art ? [{ src: item.art, sizes: "512x512", type: "image/webp" }] : [{ src: "icons/icon-512.png", sizes: "512x512", type: "image/png" }] });
    }
    this.emit();
  },
  toggle(item) {
    if (item && (!this.item || this.item.id !== item.id)) return this.play(item);
    if (this.audio.paused) this.audio.play().catch(() => {}); else this.audio.pause();
  },
  stop() { this.audio.pause(); this.item = null; this.queue = []; this.emit(); },
  setSpeed(v) { settings.speed = v; saveSettings(); this.audio.playbackRate = v; this.emit(); },
  get pct() { const a = this.audio; return a.duration ? (a.currentTime / a.duration) * 100 : 0; },
};

// ---------- Đổi lịch âm sang lịch dương (thuật toán của Hồ Ngọc Đức, múi giờ +7) ----------
const INT = Math.floor;
function jdFromDate(dd, mm, yy) {
  const a = INT((14 - mm) / 12), y = yy + 4800 - a, m = mm + 12 * a - 3;
  let jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - INT(y / 100) + INT(y / 400) - 32045;
  if (jd < 2299161) jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - 32083;
  return jd;
}
function jdToDate(jd) {
  let a, b, c;
  if (jd > 2299160) { a = jd + 32044; b = INT((4 * a + 3) / 146097); c = a - INT((b * 146097) / 4); } else { b = 0; c = jd + 32082; }
  const d = INT((4 * c + 3) / 1461), e = c - INT((1461 * d) / 4), m = INT((5 * e + 2) / 153);
  return [e - INT((153 * m + 2) / 5) + 1, m + 3 - 12 * INT(m / 10), b * 100 + d - 4800 + INT(m / 10)];
}
function newMoon(k) {
  const T = k / 1236.85, T2 = T * T, T3 = T2 * T, dr = Math.PI / 180;
  let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  Jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
  C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr) - 0.0004 * Math.sin(dr * 3 * Mpr);
  C1 = C1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr)) - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M));
  C1 = C1 - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr)) + 0.001 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));
  const deltat = T < -11 ? 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3 : -0.000278 + 0.000265 * T + 0.000262 * T2;
  return Jd1 + C1 - deltat;
}
function sunLongitude(jdn) {
  const T = (jdn - 2451545.0) / 36525, T2 = T * T, dr = Math.PI / 180;
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  const DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M) + (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.00029 * Math.sin(dr * 3 * M);
  let L = (L0 + DL) * dr;
  L -= Math.PI * 2 * INT(L / (Math.PI * 2));
  return L;
}
const TZ = 7;
const sunLong = (day) => INT((sunLongitude(day - 0.5 - TZ / 24) / Math.PI) * 6);
const newMoonDay = (k) => INT(newMoon(k) + 0.5 + TZ / 24);
function lunarMonth11(yy) {
  const off = jdFromDate(31, 12, yy) - 2415021, k = INT(off / 29.530588853);
  let nm = newMoonDay(k);
  if (sunLong(nm) >= 9) nm = newMoonDay(k - 1);
  return nm;
}
function leapMonthOffset(a11) {
  const k = INT((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let last = 0, i = 1, arc = sunLong(newMoonDay(k + i));
  do { last = arc; i++; arc = sunLong(newMoonDay(k + i)); } while (arc !== last && i < 14);
  return i - 1;
}
export function lunarToSolar(lDay, lMonth, lYear, leap = 0) {
  let a11, b11;
  if (lMonth < 11) { a11 = lunarMonth11(lYear - 1); b11 = lunarMonth11(lYear); } else { a11 = lunarMonth11(lYear); b11 = lunarMonth11(lYear + 1); }
  const k = INT(0.5 + (a11 - 2415021.076998695) / 29.530588853);
  let off = lMonth - 11;
  if (off < 0) off += 12;
  if (b11 - a11 > 365) {
    const leapOff = leapMonthOffset(a11);
    let leapMonth = leapOff - 2;
    if (leapMonth < 0) leapMonth += 12;
    if (leap && lMonth !== leapMonth) return null;
    if (leap || off >= leapOff) off += 1;
  }
  const [d, m, y] = jdToDate(newMoonDay(k + off) + lDay - 1);
  return new Date(y, m - 1, d);
}
/** Ngày dương lịch gần nhất (từ hôm nay trở đi) của một ngày âm lịch lặp lại hằng năm. */
export function nextLunar(day, month, from = new Date()) {
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (let y = today.getFullYear() - 1; y <= today.getFullYear() + 2; y++) {
    const d = lunarToSolar(day, month, y);
    if (d && d >= today) return d;
  }
  return null;
}

/** Ngày gần nhất của một ngày lễ: âm lịch (lunar) hoặc dương lịch (solar). */
export function nextFest(f, from = new Date()) {
  if (!f) return null;
  if (f.lunar) {                     // lunar.days: lễ họp nhiều phiên trong tháng (vd. chợ tranh Đông Hồ)
    const ds = f.lunar.days || [f.lunar.day];
    return ds.map((d) => nextLunar(d, f.lunar.month, from)).sort((a, b) => a - b)[0];
  }
  if (f.solar) {
    const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    let d = new Date(today.getFullYear(), f.solar.month - 1, f.solar.day);
    if (d < today) d = new Date(today.getFullYear() + 1, f.solar.month - 1, f.solar.day);
    return d;
  }
  return null;
}
