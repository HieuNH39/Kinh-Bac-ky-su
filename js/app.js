// Kinh Bắc Ký Sự – điều khiển chính: tải dữ liệu, chuyển trang theo địa chỉ sau dấu #, định vị, trình phát.
import { LANGS } from "./i18n.js";
import { settings, saveSettings, progress, Geo, Player, logEvent, markArrived, store } from "./core.js";
import { esc, t, L, icon, toast, seekIcon, shareLink } from "./ui.js";
import * as A from "./views-a.js";
import * as B from "./views-b.js";

const view = document.getElementById("view");
export const D = { index: null, sites: {}, byId: {}, routes: {}, food: {} };

// ---------- Dữ liệu ----------
async function loadIndex() {
  const r = await fetch("data/index.json", { cache: "no-cache" }).catch(() => null);
  D.index = r && r.ok ? await r.json() : await (await fetch("data/index.json")).json();
  const drafts = store.get("drafts", []);
  for (const d of drafts) if (!D.index.sites.find((s) => s.id === d.id)) D.index.sites.push({ ...d.summary, draft: true });
  D.index.sites.forEach((s) => { D.byId[s.id] = s; });
  D.index.routes.forEach((r) => { D.routes[r.id] = r; });
  D.food = D.index.food;
}
export async function loadSite(id) {
  if (D.sites[id]) return D.sites[id];
  const draft = store.get("drafts", []).find((d) => d.id === id);
  if (draft) return (D.sites[id] = draft.full);
  const r = await fetch(`data/sites/${id}.json`);
  if (!r.ok) throw new Error("not found");
  return (D.sites[id] = await r.json());
}
export function findStop(stopId) {
  const prefix = stopId.split("-")[0];
  const s = D.index.sites.find((x) => x.prefix === prefix);
  return s ? s.id : null;
}
export function audioItem(site, stop) {
  const src = stop.audio?.[settings.lang] || (settings.lang === "ko" ? stop.audio?.en : null);
  if (!src) return null;
  return { id: stop.id, siteId: site.id, siteName: L(site.name), src, title: `${L(stop.title)}`, href: stop.kind === "intro" ? `#/site/${site.id}` : `#/stop/${stop.id}`, art: stop.photos?.find((p) => p.thumb)?.thumb || site.cover?.thumb || "img/brand/logo-dau-son.svg" };
}

// ---------- Định tuyến ----------
const routes = [
  [/^#?\/?$/, () => A.home()],
  [/^#\/map(?:\?route=([\w-]+))?$/, (m) => A.map(m[1])],
  [/^#\/routes$/, () => A.routesPage()],
  [/^#\/route\/([\w-]+)$/, (m) => A.routePage(m[1])],
  [/^#\/site\/([\w-]+)(?:\/(\w+))?$/, (m) => A.sitePage(m[1], m[2])],
  [/^#\/stop\/([\w-]+?)(\?qr)?$/, (m) => A.stopPage(m[1], !!m[2])],
  [/^#\/quiz\/([\w-]+)$/, (m) => B.quizPage(m[1])],
  [/^#\/passport$/, () => B.passport()],
  [/^#\/timeline$/, () => B.timeline()],
  [/^#\/festivals$/, () => B.festivals()],
  [/^#\/food$/, () => B.food()],
  [/^#\/plan(?:\/([\w-]+))?$/, (m) => B.plan(m[1])],
  [/^#\/class(?:\/([\w-]+))?$/, (m) => B.classPage(m[1])],
  [/^#\/more$/, () => B.more()],
  [/^#\/settings$/, () => B.settingsPage()],
  [/^#\/about$/, () => B.about()],
  [/^#\/qr(?:\/([\w-]+))?$/, (m) => B.qrSheet(m[1])],
  [/^#\/teacher$/, () => B.teacher()],
  [/^#\/so-do$/, () => B.plansIndex()],
];
const navOf = (h) => (h.startsWith("#/map") ? "map" : /^#\/(route|site|stop|quiz)/.test(h) ? "routes" : h.startsWith("#/passport") ? "passport"
  : /^#\/(more|settings|about|qr|teacher|timeline|festivals|food|plan|class|so-do)/.test(h) ? "more" : "home");

// ---------- Nút quay lại (v3.3): có ở mọi trang trừ trang chủ ----------
// Nhớ các trang đã đi qua trong phiên; nếu người dùng mở thẳng một trang (mã QR, đường dẫn), nút đưa về trang "cha".
const trail = [];
function parentOf(h) {
  let m;
  if ((m = h.match(/^#\/stop\/([\w-]+?)(\?qr)?$/))) { const id = findStop(m[1]); return id ? `#/site/${id}` : "#/"; }
  if ((m = h.match(/^#\/quiz\/([\w-]+)$/))) return `#/site/${m[1]}`;
  if ((m = h.match(/^#\/site\/([\w-]+)\/\w+$/))) return `#/site/${m[1]}`;
  if ((m = h.match(/^#\/site\/([\w-]+)$/))) { const s = D.byId[m[1]]; return s?.route && D.routes[s.route] ? `#/route/${s.route}` : "#/"; }
  if (/^#\/route\//.test(h)) return "#/routes";
  if (/^#\/qr\/[\w-]+$/.test(h)) return "#/qr";
  if (/^#\/(settings|about|teacher|so-do)$/.test(h)) return "#/more";
  return "#/";
}
function trackTrail(h) {
  if (trail.length > 1 && trail[trail.length - 2] === h) trail.pop(); // người dùng vừa lùi lại
  else if (trail[trail.length - 1] !== h) trail.push(h);
  if (trail.length > 60) trail.splice(0, trail.length - 60);
}
const isHome = (h) => /^#?\/?$/.test(h);
function drawBack(h) {
  const b = document.getElementById("backBtn");
  if (!b) return;
  b.hidden = isHome(h);
  document.body.classList.toggle("has-back", !isHome(h));
}
document.getElementById("backBtn")?.addEventListener("click", () => {
  const h = location.hash || "#/";
  if (trail.length > 1) history.back();
  else { trail.length = 0; location.replace(parentOf(h)); } // thay trang hiện tại bằng trang cha, tránh vòng lặp khi bấm tiếp
});

let cleanup = null;
export function onLeave(fn) { cleanup = fn; }
async function render() {
  const h = location.hash || "#/";
  trackTrail(h); drawBack(h);
  if (cleanup) { try { cleanup(); } catch { /* bỏ qua */ } cleanup = null; }
  document.querySelectorAll(".nav a").forEach((a) => a.setAttribute("aria-current", a.dataset.nav === navOf(h) ? "page" : "false"));
  for (const [re, fn] of routes) {
    const m = h.match(re);
    if (m) {
      try {
        const html = await fn(m);
        if (typeof html === "string") view.innerHTML = html;
      } catch (e) {
        console.error(e);
        view.innerHTML = `<div class="wrap empty"><p>${navigator.onLine ? t("notFound") : t("offlineMissing")}</p><a class="btn" href="#/">${t("navHome")}</a></div>`;
      }
      if (!h.includes("/site/") || !h.split("/")[3]) window.scrollTo(0, 0);
      A.afterRender?.();
      return;
    }
  }
  view.innerHTML = `<div class="wrap empty"><p>${t("notFound")}</p></div>`;
}
export function rerender() { render(); }

// ---------- Khung: thanh trên, thanh dưới, trình phát nhỏ ----------
function applySettings() {
  document.documentElement.lang = settings.lang;
  document.documentElement.dataset.theme = settings.theme;
  document.documentElement.dataset.size = settings.size;
  const lb = document.getElementById("langBtn"), lab = LANGS.find((l) => l.id === settings.lang).label;
  lb.textContent = lab; lb.setAttribute("aria-label", `${lab} – Ngôn ngữ / Language`);   // tên đọc chứa đúng chữ hiển thị
  document.getElementById("backBtn")?.setAttribute("aria-label", t("back"));
  const lab = { prev: "prevStop", back15: "back15", toggle: "playPause", fwd15: "fwd15", next: "nextStop", vol: "volume", speed: "speedLabel", share: "share", close: "close" };
  Object.entries(lab).forEach(([k, v]) => document.querySelector(`#mini [data-act=${k}]`)?.setAttribute("aria-label", t(v)));
  document.querySelector(".brand b").textContent = t("appName");
  document.querySelector(".brand small").textContent = t("tagline");
  const labels = { home: "navHome", map: "navMap", routes: "navRoutes", passport: "navPassport", more: "navMore" };
  document.querySelectorAll(".nav a").forEach((a) => { a.querySelector("span").textContent = t(labels[a.dataset.nav]); });
}
export function setLang(id) {
  settings.lang = id; saveSettings(); applySettings(); logEvent("lang", {}); render();
}

const mini = document.getElementById("mini");
// ---------- Trình phát (v3.4): điểm trước/sau, ±15 giây, âm lượng, tốc độ, chia sẻ ----------
const fmtT = (x) => { x = Math.max(0, Math.floor(x || 0)); return `${Math.floor(x / 60)}:${String(x % 60).padStart(2, "0")}`; };
mini.querySelector("[data-act=prev]").innerHTML = icon("skipPrev");
mini.querySelector("[data-act=next]").innerHTML = icon("skipNext");
mini.querySelector("[data-act=back15]").innerHTML = seekIcon(-1);
mini.querySelector("[data-act=fwd15]").innerHTML = seekIcon(1);
const seekEl = mini.querySelector(".seek");
const volPop = mini.querySelector(".vol-pop");
let seeking = false, nbFor = null, nb = { prev: null, next: null };

// Tìm điểm dừng trước/sau có bài nghe: theo danh sách đang phát (nghe liền cả bài, nghe ở lớp) hoặc theo thứ tự điểm dừng của di tích
async function neighbor(dir) {
  const it = Player.item;
  if (!it) return null;
  if (Player.queue.length) { const j = Player.qi + dir; return j >= 0 && j < Player.queue.length ? { qi: j, item: Player.queue[j] } : null; }
  try {
    const site = await loadSite(it.siteId);
    const i = site.stops.findIndex((x) => x.id === it.id);
    for (let j = i + dir; j >= 0 && j < site.stops.length; j += dir) { const x = audioItem(site, site.stops[j]); if (x) return { item: x }; }
  } catch { /* chưa tải được dữ liệu di tích */ }
  return null;
}
async function refreshNeighbors() {
  const it = Player.item;
  const key = it ? `${it.id}|${Player.qi}|${Player.queue.length}` : null;
  if (key === nbFor) return;
  nbFor = key;
  nb = { prev: await neighbor(-1), next: await neighbor(1) };
  mini.querySelector("[data-act=prev]").disabled = !nb.prev;
  mini.querySelector("[data-act=next]").disabled = !nb.next;
}
async function step(dir) {
  const n = await neighbor(dir);
  if (!n) { toast(t(dir > 0 ? "lastStop" : "firstStop")); return; }
  const was = Player.item, h = location.hash;
  if (n.qi !== undefined) Player.playAt(n.qi, "player"); else Player.play(n.item, "player");
  // đang xem trang của bài cũ thì theo bài sang trang điểm dừng mới
  if (was && (h === was.href || h === `#/stop/${was.id}` || h === `#/site/${was.siteId}`)) location.hash = Player.item.href;
}
Player.stepHook = step;

function drawVolume() {
  const v = settings.volume ?? 1, muted = Player.audio.muted || v === 0;
  mini.querySelector("[data-act=vol]").innerHTML = icon(muted ? "volumeOff" : "volume");
  if (volPop.hidden) return;
  volPop.innerHTML = Player.volumeAdjustable
    ? `<button type="button" data-act="mute" aria-label="${t("mute")}">${icon(muted ? "volumeOff" : "volume")}</button><input type="range" min="0" max="100" value="${Math.round((muted ? 0 : v) * 100)}" aria-label="${t("volume")}">`
    : `<button type="button" data-act="mute" aria-label="${t("mute")}">${icon(muted ? "volumeOff" : "volume")}</button><p>${t("volumeHint")}</p>`;
}
function drawMini() {
  const it = Player.item;
  mini.classList.toggle("on", !!it);
  document.documentElement.style.setProperty("--player-h", it ? "146px" : "0px");
  if (!it) { volPop.hidden = true; return; }
  const a = Player.audio, playing = !a.paused;
  const art = mini.querySelector(".art");
  if (it.art) { if (art.getAttribute("src") !== it.art) art.src = it.art; art.hidden = false; } else art.hidden = true;
  mini.querySelector(".t").innerHTML = `<a href="${esc(it.href)}"><b>${esc(it.title)}</b><span class="tiny">${esc(it.siteName || "")}${Player.queue.length ? ` · ${Player.qi + 1}/${Player.queue.length}` : ""}</span></a>`;
  if (!seeking) mini.querySelector(".time.now").textContent = fmtT(a.currentTime);
  mini.querySelector(".time.dur").textContent = a.duration ? fmtT(a.duration) : "–:––";
  mini.querySelector("[data-act=toggle]").innerHTML = icon(playing ? "pause" : "play");
  mini.querySelector("[data-act=speed]").textContent = `${String(settings.speed).replace(".", ",")}×`;
  if (!seeking) { seekEl.value = Math.round(Player.pct * 10); seekEl.style.setProperty("--p", `${Player.pct}%`); }
  drawVolume();
  refreshNeighbors();
  document.querySelectorAll("[data-play]").forEach((b) => {
    const on = Player.isPlaying(b.dataset.play);
    b.classList.toggle("is-on", on);
    const ic = b.querySelector("svg path");
    if (ic) ic.setAttribute("d", on ? "M6 5h4v14H6zm8 0h4v14h-4z" : "M8 5v14l11-7z");
    const lab = b.querySelector("span");
    if (lab && b.dataset.label) lab.textContent = on ? t("pause") : b.dataset.label;
  });
  document.querySelectorAll("[data-prog]").forEach((p) => { if (Player.item?.id === p.dataset.prog) p.style.width = `${Player.pct}%`; });
}
seekEl.addEventListener("input", () => { seeking = true; seekEl.style.setProperty("--p", `${seekEl.value / 10}%`); const a = Player.audio; if (a.duration) mini.querySelector(".time.now").textContent = fmtT((seekEl.value / 1000) * a.duration); });
seekEl.addEventListener("change", () => { const a = Player.audio; if (a.duration) a.currentTime = (seekEl.value / 1000) * a.duration; seeking = false; });
volPop.addEventListener("input", (e) => { if (e.target.type === "range") { Player.audio.muted = false; Player.setVolume(e.target.value / 100); } });
mini.addEventListener("click", async (e) => {
  const act = e.target.closest("button")?.dataset.act;
  if (!act) return;
  const it = Player.item;
  if (act === "toggle") Player.toggle();
  if (act === "back15") Player.seek(-15);
  if (act === "fwd15") Player.seek(15);
  if (act === "prev") step(-1);
  if (act === "next") step(1);
  if (act === "speed") { const sp = [0.8, 1, 1.2, 1.5]; Player.setSpeed(sp[(sp.indexOf(settings.speed) + 1) % sp.length] ?? 1); }
  if (act === "vol") { volPop.hidden = !volPop.hidden; mini.querySelector("[data-act=vol]").setAttribute("aria-expanded", String(!volPop.hidden)); drawVolume(); }
  if (act === "mute") { const a = Player.audio; if (a.muted || (settings.volume ?? 1) === 0) { a.muted = false; if (!settings.volume) Player.setVolume(1); } else a.muted = true; drawVolume(); }
  if (act === "share" && it) {
    const r = await shareLink(`${it.title} – ${it.siteName || t("appName")}`, t("shareText", it.siteName || it.title), it.href);
    logEvent("share", { stop: it.id, site: it.siteId, how: r });
  }
  if (act === "close") { volPop.hidden = true; Player.stop(); }
});
// Nút chia sẻ trên trang di tích, điểm dừng (data-share = đường dẫn trong ứng dụng)
document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-share]");
  if (!b) return;
  const title = b.dataset.shareTitle || t("appName");
  const r = await shareLink(title, t("shareText", title), b.dataset.share);
  logEvent("share", { page: b.dataset.share, how: r });
});
document.addEventListener("click", (e) => {
  if (volPop.hidden) return;
  const path = e.composedPath(); // nút có thể vừa được vẽ lại, nên xét cả đường đi của sự kiện
  if (!path.some((el) => el === volPop || el?.dataset?.act === "vol")) { volPop.hidden = true; mini.querySelector("[data-act=vol]").setAttribute("aria-expanded", "false"); }
});

// ---------- Băng báo khi đến gần di tích ----------
const banner = document.getElementById("banner");
const announced = new Set();
export function showBanner(text, actions) {
  banner.hidden = false;
  banner.innerHTML = `<p>${esc(text)}</p>${actions.map((a, i) => `<button class="btn small ${i ? "ghost" : "primary"}" data-i="${i}">${esc(a.label)}</button>`).join("")}`;
  banner.onclick = (e) => { const b = e.target.closest("button"); if (!b) return; banner.hidden = true; actions[+b.dataset.i].fn?.(); };
}
function checkNearby() {
  const p = Geo.position;
  if (!p || !D.index) return;
  // v3.2: 31 di tích, có nơi chỉ cách nhau vài trăm mét (Đồng Kỵ – Phù Khê). Khi sai số GPS làm hai vùng chồng nhau,
  // chọn di tích "gần nhất theo bán kính" (tỉ lệ khoảng cách / bán kính nhỏ nhất) thay vì di tích đứng trước trong danh sách.
  const slack = Math.min(Geo.accuracy || 0, 100);
  let s = null, best = Infinity;
  for (const x of D.index.sites) {
    const r = x.radius || 300, d = Geo.distance(p, x.gps);
    if (d <= r + slack && d / r < best) { s = x; best = d / r; }
  }
  if (!s) return;
  if (!progress.arrived[s.id] || !announced.has(s.id)) {
    const stamped = markArrived(s.id, settings.sim ? "sim" : "gps", Geo.accuracy);
    if (stamped) toast(t("stampEarned"));
  }
  if (announced.has(s.id)) return;
  announced.add(s.id);
  const go = async () => {
    const site = await loadSite(s.id);
    const it = audioItem(site, site.stops[0]);
    location.hash = `#/site/${s.id}`;
    if (it) Player.play(it, settings.sim ? "sim" : "gps");
  };
  if (settings.autoplay && userTouched) { go(); toast(t("arrivedBanner", L(s.name))); }
  else showBanner(t("arrivedBanner", L(s.name)), [{ label: t("listenNow"), fn: go }, { label: t("later") }]);
  if ("vibrate" in navigator) navigator.vibrate(120);
}
let userTouched = false;
addEventListener("pointerdown", () => { userTouched = true; }, { once: true, capture: true });

// ---------- Khởi động ----------
async function boot() {
  Player.init();
  Player.on(drawMini);
  Geo.on(() => { checkNearby(); A.onGeo?.(); });
  applySettings();
  document.getElementById("langBtn").addEventListener("click", () => {
    const i = LANGS.findIndex((l) => l.id === settings.lang);
    setLang(LANGS[(i + 1) % LANGS.length].id);
  });
  await loadIndex();
  if (settings.sim) { const s = D.byId[settings.sim]; if (s) Geo.simulate(s.gps); }
  if (store.get("gpsWanted", false)) Geo.start();
  addEventListener("hashchange", render);
  addEventListener("online", () => document.body.classList.remove("is-offline"));
  addEventListener("offline", () => { document.body.classList.add("is-offline"); toast(t("offline")); });
  render();
  logEvent("open", { source: location.hash.includes("?qr") ? "qr" : "app" });
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}
boot();
