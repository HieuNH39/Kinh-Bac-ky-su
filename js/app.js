// Kinh Bắc Ký Sự – điều khiển chính: tải dữ liệu, chuyển trang theo địa chỉ sau dấu #, định vị, trình phát.
import { LANGS } from "./i18n.js";
import { settings, saveSettings, progress, Geo, Player, logEvent, markArrived, store } from "./core.js";
import { esc, t, L, icon, toast } from "./ui.js";
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
  return { id: stop.id, siteId: site.id, siteName: L(site.name), src, title: `${L(stop.title)}`, href: stop.kind === "intro" ? `#/site/${site.id}` : `#/stop/${stop.id}`, art: stop.photos?.[0]?.thumb };
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
];
const navOf = (h) => (h.startsWith("#/map") ? "map" : h.startsWith("#/route") ? "routes" : h.startsWith("#/passport") ? "passport"
  : /^#\/(more|settings|about|qr|teacher|timeline|festivals|food|plan|class)/.test(h) ? "more" : "home");

let cleanup = null;
export function onLeave(fn) { cleanup = fn; }
async function render() {
  const h = location.hash || "#/";
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
  document.getElementById("langBtn").textContent = LANGS.find((l) => l.id === settings.lang).label;
  document.querySelector(".brand b").textContent = t("appName");
  document.querySelector(".brand small").textContent = t("tagline");
  const labels = { home: "navHome", map: "navMap", routes: "navRoutes", passport: "navPassport", more: "navMore" };
  document.querySelectorAll(".nav a").forEach((a) => { a.querySelector("span").textContent = t(labels[a.dataset.nav]); });
}
export function setLang(id) {
  settings.lang = id; saveSettings(); applySettings(); logEvent("lang", {}); render();
}

const mini = document.getElementById("mini");
function drawMini() {
  const it = Player.item;
  mini.classList.toggle("on", !!it);
  document.documentElement.style.setProperty("--player-h", it ? "64px" : "0px");
  if (!it) return;
  const playing = !Player.audio.paused;
  mini.querySelector(".t").innerHTML = `<a href="${esc(it.href)}"><b>${esc(it.title)}</b><span class="tiny">${esc(it.siteName || "")}${Player.queue.length ? ` · ${Player.qi + 1}/${Player.queue.length}` : ""}</span></a>`;
  mini.querySelector("[data-act=toggle]").innerHTML = icon(playing ? "pause" : "play");
  mini.querySelector("[data-act=speed]").textContent = `${String(settings.speed).replace(".", ",")}×`;
  mini.querySelector(".bar i").style.width = `${Player.pct}%`;
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
mini.addEventListener("click", (e) => {
  const act = e.target.closest("button")?.dataset.act;
  if (act === "toggle") Player.toggle();
  if (act === "back10") Player.audio.currentTime = Math.max(0, Player.audio.currentTime - 10);
  if (act === "speed") { const s = [0.8, 1, 1.2, 1.5]; Player.setSpeed(s[(s.indexOf(settings.speed) + 1) % s.length] ?? 1); }
  if (act === "close") Player.stop();
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
  for (const s of D.index.sites) {
    const d = Geo.distance(p, s.gps);
    if (d <= (s.radius || 300) + Math.min(Geo.accuracy || 0, 100)) {
      if (!progress.arrived[s.id] || !announced.has(s.id)) {
        const stamped = markArrived(s.id, settings.sim ? "sim" : "gps", Geo.accuracy);
        if (stamped) toast(t("stampEarned"));
      }
      if (announced.has(s.id)) continue;
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
      break;
    }
  }
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
