// Các trang chính: trang chủ, bản đồ, tuyến, di tích, điểm dừng.
import { D, loadSite, audioItem, onLeave, findStop } from "./app.js";
import { settings, progress, Geo, Player, logEvent, markArrived, store, nextFest, PASS } from "./core.js";
import { esc, t, L, icon, gm, gmTerms, distLabel, stampSvg, stampState, gallery, wireGallery, toast, rankLabel, fmtDate } from "./ui.js";

let post = [];
export function afterRender() { const f = post; post = []; f.forEach((fn) => fn()); }
const after = (fn) => post.push(fn);
let geoHook = null;
export function onGeo() { geoHook?.(); }

const coverOf = (s) => s.cover?.thumb || s.cover?.src || "img/brand/icon-app.svg";
const routeCover = (r) => coverOf(r.sites.map((id) => D.byId[id]).find((x) => x && x.cover) || D.byId[r.sites[0]] || {});
const routeOf = (s) => D.routes[s.route];
const ordered = () => D.index.routes.flatMap((r) => r.sites.map((id) => D.byId[id]).filter(Boolean)).concat(D.index.sites.filter((s) => s.draft));

function siteItem(s) {
  const r = routeOf(s);
  return `<a class="card site-item" href="#/site/${s.id}">
    <img src="${esc(coverOf(s))}" alt="" loading="lazy">
    <div class="meta">
      <div class="row" style="gap:6px">${r ? `<span class="tag" style="background:${r.color};color:#fbf7ef">${r.num}</span>` : ""}${s.draft ? '<span class="tag vang">Bản nháp</span>' : ""}<span class="tiny muted">${esc(L(s.era?.label) || "")}</span></div>
      <h3>${esc(L(s.name))}</h3>
      <span class="lead">${esc(L(s.lead))}</span>
      <span class="tiny muted">${t("stops", s.stopCount)}${Geo.position ? ` · ${distLabel(s)}` : ""}</span>
    </div>
    <div class="stamp-mini" style="margin-left:auto">${stampSvg(s, stampState(s.id), 26)}</div>
  </a>`;
}

// ---------- Trang chủ ----------
export function home() {
  const p = Geo.position;
  const sites = ordered();
  const near = p ? [...sites].sort((a, b) => Geo.distance(p, a.gps) - Geo.distance(p, b.gps))[0] : null;
  const upcoming = D.index.sites.filter((s) => s.festival).map((s) => ({ s, d: nextFest(s.festival) }))
    .filter((x) => x.d).sort((a, b) => a.d - b.d)[0];
  const heroImg = D.byId["phat-tich"]?.cover?.mid || D.byId["phat-tich"]?.cover?.src || coverOf(sites[0]);
  const quick = [
    ["#/routes", "route", "quickRoutes"], ["#/plan", "clock", "quickPlan"], ["#/food", "food", "quickFood"], ["#/festivals", "lantern", "quickFest"],
    ["#/timeline", "timeline", "quickTimeline"], ["#/passport", "passport", "quickPassport"], ["#/class", "class", "quickClass"], ["#/qr", "qr", "quickQr"],
  ];
  geoHook = () => { if (location.hash === "" || location.hash === "#/") { document.getElementById("view").innerHTML = home(); afterRender(); } };
  onLeave(() => { geoHook = null; });
  after(() => {
    document.getElementById("gpsBtn")?.addEventListener("click", () => { store.set("gpsWanted", true); Geo.start(); toast(t("gpsOn")); });
  });
  return `<div class="wrap">
    <section class="hero">
      <img class="bg" src="${esc(heroImg)}" alt="" fetchpriority="high">
      <img class="seal" src="img/brand/logo-dau-son.svg" alt="Kinh Bắc">
      <div class="inner">
        <span class="label">${t("heroLabel")}</span>
        <h1>${t("heroTitle")}</h1>
        <p>${t("heroText")}</p>
        ${Geo.watching || settings.sim ? `<span class="tag cham">${icon("gps")} ${t("gpsOn")}${Geo.accuracy ? ` ±${Math.round(Geo.accuracy)} m` : ""}</span>`
          : `<button class="btn primary" id="gpsBtn" type="button">${icon("gps")}${t("startGps")}</button>`}
      </div>
    </section>
    ${near ? `<div class="section"><h2>${Geo.distance(p, near.gps) <= (near.radius || 300) ? t("nearHere") : t("nearest")}</h2></div>
      <a class="card near" href="#/site/${near.id}" style="text-decoration:none;color:inherit"><img src="${esc(coverOf(near))}" alt="">
        <div><h3 style="margin:0">${esc(L(near.name))}</h3><span class="small muted">${distLabel(near)}</span></div>
        <span class="btn small primary" style="margin-left:auto">${icon("play")}${t("open")}</span></a>` : ""}
    <nav class="quick" aria-label="${t("more")}">${quick.map(([h, ic, k]) => `<a href="${h}"><span class="ic">${icon(ic)}</span>${t(k)}</a>`).join("")}</nav>
    ${upcoming ? `<a class="card fest" href="#/festivals" style="margin-top:14px"><div class="cal"><b>${upcoming.d.getMonth() + 1}/${upcoming.d.getFullYear()}</b><span>${upcoming.d.getDate()}</span></div>
      <div><span class="label">${t("festival")} · ${t("daysLeft", Math.round((upcoming.d - new Date().setHours(0, 0, 0, 0)) / 864e5))}</span><h2 style="margin:2px 0 0;font-size:1.12rem">${esc(L(upcoming.s.festival.name))}</h2>
      <span class="small muted">${esc(L(upcoming.s.festival.span))}</span></div></a>` : ""}
    <div class="section"><h2>${t("routes")}</h2><a href="#/routes">${t("seeAll")}</a></div>
    <div class="hscroll">${D.index.routes.map(routeCard).join("")}</div>
    <div class="section"><h2>${t("allSites")}</h2><a href="#/map">${t("navMap")}</a></div>
    <div class="site-list">${(p ? [...sites].sort((a, b) => Geo.distance(p, a.gps) - Geo.distance(p, b.gps)) : sites).map(siteItem).join("")}</div>
    <footer class="foot"><img src="img/brand/logo-dau-son.svg" alt=""><p>Kinh Bắc Ký Sự · Heritage Lens · v${esc(D.index.about?.app_version || "")}<br>STEMPETITION 2027 · <a href="#/about">${t("about")}</a></p></footer>
  </div>`;
}
function routeCard(r) {
  const first = D.byId[r.sites[0]];
  return `<a class="card route-card" href="#/route/${r.id}">
    <div class="top"><img src="${esc(routeCover(r))}" alt="" loading="lazy"><span class="no" style="background:${r.color}">${r.num}</span></div>
    <div class="card-body"><h3 style="margin:0 0 4px">${esc(L(r.name))}</h3>
    <p class="small muted" style="margin:0">${r.sites.map((id) => esc(L(D.byId[id]?.name) || id)).join(" · ")}</p></div></a>`;
}

// ---------- Bản đồ (OpenStreetMap, dùng được khi đã lưu; kèm nút mở Google Maps) ----------
export function map(routeFilter) {
  let filter = routeFilter || "";
  after(() => {
    const L_ = window.L;
    const m = L_.map("map", { zoomControl: false, attributionControl: true }).setView([21.15, 106.1], 10);
    L_.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap" }).addTo(m);
    L_.control.zoom({ position: "bottomleft" }).addTo(m);
    const layer = L_.layerGroup().addTo(m);
    let me = null;
    const draw = () => {
      layer.clearLayers();
      const shown = [];
      for (const r of D.index.routes) {
        if (filter && r.id !== filter) continue;
        const pts = r.sites.map((id) => D.byId[id]).filter(Boolean);
        L_.polyline(pts.map((s) => [s.gps.lat, s.gps.lng]), { color: r.color, weight: 3, opacity: 0.7, dashArray: "6 6" }).addTo(layer);
        pts.forEach((s) => {
          const i = r.sites.indexOf(s.id);
          shown.push([s.gps.lat, s.gps.lng]);
          const done = progress.stamped[s.id];
          const ic = L_.divIcon({ className: "", html: `<div class="pin${done ? " done" : ""}" style="${done ? "" : `background:${r.color}`}">${r.num}.${i + 1}</div>`, iconSize: [30, 30], iconAnchor: [15, 15] });
          const name = L(s.name);
          L_.marker([s.gps.lat, s.gps.lng], { icon: ic, title: name }).addTo(layer).bindPopup(`
            <h3>${esc(name)}</h3><div class="small muted">${esc(L(s.era?.label) || "")}${Geo.position ? ` · ${distLabel(s)}` : ""}</div>
            <div class="popup-actions">
              <a class="main" href="#/site/${s.id}">${t("mapView")}</a>
              <a href="${gm.dir(s.gps)}" target="_blank" rel="noopener">${t("gmDir")}</a>
              <a href="${gm.near(L(gmTerms.food), s.gps)}" target="_blank" rel="noopener">${t("gmFood")}</a>
              <a href="${gm.near(L(gmTerms.hotel), s.gps, 14)}" target="_blank" rel="noopener">${t("gmHotel")}</a>
            </div>`);
        });
      }
      if (shown.length) m.fitBounds(shown, { padding: [50, 50], maxZoom: 14 });
    };
    draw();
    const showMe = () => {
      if (!Geo.position) return;
      const ll = [Geo.position.lat, Geo.position.lng];
      if (!me) me = L_.marker(ll, { icon: L_.divIcon({ className: "", html: '<div class="me-dot"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }) }).addTo(m);
      else me.setLatLng(ll);
    };
    showMe();
    geoHook = showMe;
    document.querySelector(".map-tools").addEventListener("click", (e) => {
      const c = e.target.closest("[data-route]");
      if (!c) return;
      filter = c.dataset.route;
      document.querySelectorAll(".map-tools .chip").forEach((x) => x.setAttribute("aria-pressed", x === c));
      draw();
    });
    document.getElementById("meBtn").addEventListener("click", () => {
      store.set("gpsWanted", true); Geo.start();
      if (Geo.position) m.setView([Geo.position.lat, Geo.position.lng], 14); else toast(t("gpsOn"));
    });
    onLeave(() => { geoHook = null; m.remove(); });
  });
  return `<div class="map-page"><div id="map" role="application" aria-label="${t("navMap")}"></div>
    <div class="map-tools"><div class="chips">
      <button class="chip" data-route="" aria-pressed="${!filter}">${t("mapAll")}</button>
      ${D.index.routes.map((r) => `<button class="chip" data-route="${r.id}" aria-pressed="${filter === r.id}"><span style="color:${r.color}">●</span> ${r.num}. ${esc(L(r.name))}</button>`).join("")}
    </div></div>
    <div class="map-fab"><button class="icon-btn" id="meBtn" type="button" aria-label="${t("mapMe")}" style="background:var(--giay-50)">${icon("gps")}</button></div></div>`;
}

// ---------- Tuyến ----------
export function routesPage() {
  return `<div class="wrap"><div class="section" style="margin-top:16px"><h2>${t("routes")}</h2></div>
    <div class="stack">${D.index.routes.map((r) => `<a class="card route-card" href="#/route/${r.id}">
      <div class="top" style="height:150px"><img src="${esc(routeCover(r))}" alt="" loading="lazy"><span class="no" style="background:${r.color}">${r.num}</span></div>
      <div class="card-body"><h3 style="margin:0 0 4px">${esc(L(r.name))}</h3><p class="small" style="margin:0 0 6px">${esc(L(r.theme))}</p>
      <span class="tiny muted">${t("sites", r.sites.length)} · ${r.sites.map((id) => esc(L(D.byId[id]?.name) || id)).join(" → ")}</span></div></a>`).join("")}</div></div>`;
}
export function routePage(id) {
  const r = D.routes[id];
  if (!r) throw new Error("route");
  const sites = r.sites.map((x) => D.byId[x]).filter(Boolean);
  const done = sites.filter((s) => progress.stamped[s.id]).length;
  return `<div class="wrap"><a class="back" href="#/routes">${icon("back")} ${t("routes")}</a>
    <div class="card framed"><div class="card-body">
      <div class="row"><span class="tag" style="background:${r.color};color:#fbf7ef">${t("navRoutes")} ${r.num}</span><span class="tag">${t("sites", sites.length)}</span><span class="tag cham">${t("stampsCount", done, sites.length)}</span></div>
      <h1 style="margin:10px 0 6px">${esc(L(r.name))}</h1><p>${esc(L(r.theme))}</p>
      <p class="small muted" style="margin:0"><b>${t("lessonLink")}:</b> ${esc(L(r.lesson))}</p></div></div>
    <div class="actions">
      <a class="btn primary" href="#/plan/${r.id}">${icon("clock")}${t("plan")}</a>
      <a class="btn" href="#/class/${r.id}">${icon("class")}${t("classMode")}</a>
      <a class="btn" href="#/map?route=${r.id}">${icon("map")}${t("navMap")}</a>
      <a class="btn" href="${gm.route(sites.map((s) => s.gps))}" target="_blank" rel="noopener">${icon("dir")}${t("openRouteGm")}</a>
    </div>
    <ol class="stack" style="list-style:none;padding:0;margin:0">${sites.map((s, i) => `<li>
      ${i ? `<div class="tiny muted" style="padding:2px 0 8px 44px">↓ ${Geo.fmt(Geo.distance(sites[i - 1].gps, s.gps) * 1.3)}</div>` : ""}
      ${siteItem(s)}</li>`).join("")}</ol></div>`;
}

// ---------- Di tích ----------
const KIND = { goc: { vi: "Tư liệu gốc", en: "Primary sources", ko: "1차 자료" }, "chinh-thuc": { vi: "Văn bản chính thức", en: "Official documents", ko: "공식 문서" },
  "nghien-cuu": { vi: "Nghiên cứu", en: "Research", ko: "연구" }, "bao-chi": { vi: "Báo chí, giới thiệu", en: "Press and guides", ko: "언론" } };

export async function sitePage(id, tab = "tour") {
  const s = await loadSite(id);
  const sum = D.byId[id] || s;
  const r = routeOf(sum);
  logEvent("open_site", { site: id });
  const intro = s.stops[0];
  const introItem = audioItem(s, intro);
  const fest = s.travel?.festival;
  const festDate = nextFest(fest);
  const q = progress.quiz[id];
  const allItems = s.stops.map((st) => audioItem(s, st)).filter(Boolean);
  after(() => {
    wireGallery(document.getElementById("view"), s.gallery || []);
    document.getElementById("introBtn")?.addEventListener("click", () => introItem && Player.toggle(introItem));
    document.getElementById("allBtn")?.addEventListener("click", () => allItems.length && Player.playQueue(allItems, 0, "site-all"));
    document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => { history.replaceState(null, "", `#/site/${id}/${b.dataset.tab}`); showTab(b.dataset.tab); }));
    document.getElementById("dlBtn")?.addEventListener("click", (e) => cacheSite(s, e.currentTarget));
    showTab(tab);
    markCached(s);
  });
  const nearby = D.index.sites.filter((x) => x.id !== id).map((x) => ({ x, d: Geo.distance(s.gps, x.gps) })).sort((a, b) => a.d - b.d).slice(0, 3);
  const byKind = {};
  (s.sources || []).forEach((src) => { (byKind[src.kind] ||= []).push(src); });
  return `<div class="wrap">
    <div class="cover">${s.cover ? `<img src="${esc(s.cover.mid || s.cover.src)}" alt="${esc(L(s.name))}" fetchpriority="high">` : `<div class="nocover"></div>`}
      <span class="count">${stampSvg(sum, stampState(id), 44)}</span>
      <div class="inner">${r ? `<span class="label" style="color:var(--vang-500)">${t("navRoutes")} ${r.num} · ${esc(L(r.name))}</span>` : ""}
        <h1>${esc(L(s.name))}</h1><div class="alt">${esc(L(s.alt) || "")}</div>
        <div class="row" style="margin-top:8px">${s.rank ? `<span class="tag son">${rankLabel(s.rank)}</span>` : ""}<span class="tag">${esc(L(s.era?.label) || "")}</span>${Geo.position ? `<span class="tag">${distLabel(s)}</span>` : ""}</div></div></div>
    <p class="lead-text">${esc(L(s.lead))}</p>
    <div class="actions">
      ${introItem ? `<button class="btn primary" id="introBtn" data-play="${intro.id}" data-label="${t("listenIntro")}" type="button">${icon(Player.isPlaying(intro.id) ? "pause" : "play")}<span>${t("listenIntro")}</span></button>` : ""}
      ${allItems.length > 1 ? `<button class="btn" id="allBtn" type="button">${icon("skipNext")}${t("listenAll")}</button>` : ""}
      <a class="btn" href="${gm.dir(s.gps)}" target="_blank" rel="noopener">${icon("dir")}${t("directions")}</a>
      ${s.quiz?.length ? `<a class="btn" href="#/quiz/${id}">${icon("quiz")}${t("quizN", s.quiz.length)}${q ? ` · ${q.score}/${q.total}` : ""}</a>` : ""}
      <button class="btn" id="dlBtn" type="button">${icon("download")}<span>${t("download")}</span></button>
    </div>
    <div class="tabs" role="tablist">
      <button role="tab" data-tab="tour">${t("tabTour")}</button><button role="tab" data-tab="travel">${t("tabTravel")}</button><button role="tab" data-tab="docs">${t("tabDocs")}</button>
    </div>
    <section data-panel="tour">
      <div class="stops">${s.stops.map((st, i) => `<a class="card stop-item${progress.listened[st.id] ? " done" : ""}" href="${st.kind === "intro" ? `#/stop/${st.id}` : `#/stop/${st.id}`}">
        <span class="num">${progress.listened[st.id] ? icon("check") : i}</span>
        ${st.photos?.[0] && !st.photos[0].todo ? `<img src="${esc(st.photos[0].thumb)}" alt="" loading="lazy">` : ""}
        <div><h3>${esc(L(st.title))}</h3><div class="where">${esc(L(st.where) || "")}${st.photos?.some((p) => !p.todo) ? ` · ${st.photos.filter((p) => !p.todo).length} ${t("photos")}` : ""}</div></div></a>`).join("")}</div>
      ${s.video ? `<div class="section"><h2>${t("video")}</h2></div>
        <video controls preload="none" playsinline poster="${esc(s.video.poster || s.cover?.src || "")}"><source src="${esc(s.video.src)}" type="video/mp4">${s.video.vttText ? Object.entries(s.video.vttText).map(([lg, txt]) => `<track kind="subtitles" srclang="${lg}" src="data:text/vtt;charset=utf-8,${encodeURIComponent(txt)}" label="${lg === "vi" ? "Tiếng Việt" : lg.toUpperCase()}" default>`).join("") : ""}</video>` : ""}
      ${s.gallery?.length ? `<div class="section"><h2>${t("photoBy")}</h2></div>${gallery(s.gallery, "site")}` : ""}
      <div class="section"><h2>${t("facts")}</h2></div>
      <div class="card"><div class="card-body"><dl class="facts">${(s.facts || []).map((f) => `<dt>${esc(L(f.k))}</dt><dd>${esc(L(f.v))}</dd>`).join("")}</dl></div></div>
    </section>
    <section data-panel="travel" hidden>
      ${fest ? `<div class="card fest"><div class="cal"><b>${festDate ? `${festDate.getMonth() + 1}/${festDate.getFullYear()}` : ""}</b><span>${festDate ? festDate.getDate() : ""}</span></div>
        <div><span class="label">${t("festival")}${festDate ? ` · ${t("daysLeft", Math.round((festDate - new Date().setHours(0, 0, 0, 0)) / 864e5))}` : ""}</span><h3 style="margin:2px 0">${esc(L(fest.name))}</h3>
        <div class="small">${esc(L(fest.span))}${festDate ? ` · ${fmtDate(festDate)}` : ""}</div><div class="small muted">${esc(L(fest.note) || "")}</div></div></div>` : ""}
      <div class="card" style="margin-top:10px"><div class="card-body"><dl class="facts">
        ${s.travel?.duration ? `<dt>${t("duration")}</dt><dd>${esc(L(s.travel.duration))}</dd>` : ""}
        ${s.travel?.best_time ? `<dt>${t("bestTime")}</dt><dd>${esc(L(s.travel.best_time))}</dd>` : ""}
        <dt>${t("where")}</dt><dd>${esc(L(s.address) || "")}</dd></dl></div></div>
      <div class="section"><h2>${t("gmTitle")}</h2></div>
      <div class="gm-grid">
        <a class="card" href="${gm.dir(s.gps)}" target="_blank" rel="noopener">${icon("dir")}${t("gmDir")}</a>
        <a class="card" href="${gm.place(s.travel?.maps?.place || L(s.name))}" target="_blank" rel="noopener">${icon("pin")}${t("gmPlace")}</a>
        <a class="card" href="${gm.near(L(gmTerms.food), s.gps)}" target="_blank" rel="noopener">${icon("food")}${t("gmFood")}</a>
        <a class="card" href="${gm.near(L(gmTerms.cafe), s.gps)}" target="_blank" rel="noopener">${icon("cafe")}${t("gmCafe")}</a>
        <a class="card" href="${gm.near(L(gmTerms.hotel), s.gps, 13)}" target="_blank" rel="noopener">${icon("bed")}${t("gmHotel")}</a>
        <a class="card" href="${gm.near(L(gmTerms.stay), s.gps, 13)}" target="_blank" rel="noopener">${icon("bed")}${t("gmStay")}</a>
      </div>
      ${s.travel?.specialties?.length ? `<div class="section"><h2>${t("specialties")}</h2><a href="#/food">${t("seeAll")}</a></div>
        <div class="food">${s.travel.specialties.map((fid) => foodCard(D.food[fid])).join("")}</div>` : ""}
      ${s.travel?.experiences?.length ? `<div class="section"><h2>${t("experiences")}</h2></div><ul class="exp">${s.travel.experiences.map((x) => `<li>${esc(L(x))}</li>`).join("")}</ul>` : ""}
      ${s.travel?.tips ? `<div class="note cham">${icon("info")} ${esc(L(s.travel.tips))}</div>` : ""}
      <div class="section"><h2>${t("nearbySites")}</h2></div>
      <div class="site-list">${nearby.map(({ x }) => siteItem(x)).join("")}</div>
    </section>
    <section data-panel="docs" hidden>
      ${Object.keys(KIND).filter((k) => byKind[k]).map((k) => `<h3 style="margin-top:16px">${esc(L(KIND[k]))}</h3><ol class="sources">${byKind[k].map((src) => `<li id="src-${esc(src.id)}"><a href="${esc(src.url)}" target="_blank" rel="noopener">${esc(src.title)}</a>${src.publisher ? ` <span class="muted">– ${esc(src.publisher)}</span>` : ""}</li>`).join("")}</ol>`).join("")}
      <div class="note" style="margin-top:14px">${t("howMade")}: <a href="#/about">${t("about")}</a> · <a href="#/qr/${id}">${t("qrSheet")}</a></div>
    </section>
  </div>`;
}
function showTab(tab) {
  document.querySelectorAll(".tabs button").forEach((b) => b.setAttribute("aria-selected", b.dataset.tab === tab));
  document.querySelectorAll("[data-panel]").forEach((p) => { p.hidden = p.dataset.panel !== tab; });
}
export function foodCard(f) {
  if (!f) return "";
  const kind = { mon: t("kindMon"), qua: t("kindQua"), "thu-cong": t("kindCraft") }[f.kind] || "";
  return `<div class="card"><div class="card-body"><span class="label">${esc(kind)}</span><h3>${esc(L(f.name))}</h3>
    <div class="small muted" style="margin-bottom:6px">${icon("pin", "")} ${esc(L(f.where))}</div><p class="small" style="margin:0 0 8px">${esc(L(f.desc))}</p>
    <a class="btn small" href="${gm.place(f.q)}" target="_blank" rel="noopener">${icon("food")}${t("findFood")}</a></div></div>`;
}

// ---------- Tải về để dùng khi không có mạng ----------
function siteUrls(s) {
  const urls = new Set([`data/sites/${s.id}.json`]);
  const addP = (p) => { if (p && !p.todo) { urls.add(p.src); if (p.thumb) urls.add(p.thumb); } };
  if (s.cover) addP(s.cover);
  (s.gallery || []).forEach(addP);
  s.stops.forEach((st) => { (st.photos || []).forEach(addP); const a = st.audio?.[settings.lang] || st.audio?.vi; if (a) urls.add(a); });
  return [...urls];
}
async function cacheSite(s, btn) {
  if (!("caches" in window)) return;
  const urls = siteUrls(s);
  const cache = await caches.open(`hl-site-${s.id}`);
  let n = 0;
  const lab = btn.querySelector("span");
  for (const u of urls) {
    try { if (!(await cache.match(u))) await cache.add(u); } catch { /* bỏ qua tệp lỗi */ }
    n++; lab.textContent = t("downloading", Math.round((n / urls.length) * 100));
  }
  store.set(`cached-${s.id}`, { t: Date.now(), lang: settings.lang });
  logEvent("download", { site: s.id });
  markCached(s);
  toast(t("offlineReady"));
}
function markCached(s) {
  const c = store.get(`cached-${s.id}`, null);
  const btn = document.getElementById("dlBtn");
  if (c && btn) { btn.classList.add("is-on"); btn.querySelector("span").textContent = t("downloaded"); }
}

// ---------- Điểm dừng ----------
export async function stopPage(stopId, fromQr) {
  const siteId = findStop(stopId);
  if (!siteId) throw new Error("stop");
  const s = await loadSite(siteId);
  const i = s.stops.findIndex((x) => x.id === stopId);
  if (i < 0) throw new Error("stop");
  const st = s.stops[i];
  const prev = s.stops[i - 1], next = s.stops[i + 1];
  const item = audioItem(s, st);
  if (fromQr) { const stamped = markArrived(siteId, "qr", null); if (stamped) setTimeout(() => toast(t("stampEarned")), 400); }
  logEvent("open_stop", { stop: stopId, site: siteId, source: fromQr ? "qr" : "tap" });
  const text = st.text[settings.lang] || (settings.lang === "ko" ? st.text.en : null) || st.text.vi;
  const srcMap = Object.fromEntries((s.sources || []).map((x) => [x.id, x]));
  const allDone = () => s.stops.every((x) => progress.listened[x.id]);
  after(() => {
    wireGallery(document.getElementById("view"), st.photos);
    document.getElementById("playBtn")?.addEventListener("click", () => item && Player.toggle(item));
    document.getElementById("qrBtn")?.addEventListener("click", () => showQr(st, s));
    const tn = document.querySelector(".thennow input");
    tn?.addEventListener("input", () => {
      const v = tn.value;
      tn.parentElement.querySelector(".old").style.clipPath = `inset(0 ${100 - v}% 0 0)`;
      tn.parentElement.querySelector(".bar").style.left = `${v}%`;
    });
    const off = Player.onEnded((done) => {
      if (done?.id === st.id && allDone() && s.quiz?.length && !progress.quiz[siteId]) {
        import("./app.js").then(({ showBanner }) => showBanner(t("quizBanner", L(s.name)), [{ label: t("play"), fn: () => { location.hash = `#/quiz/${siteId}`; } }, { label: t("later") }]));
      }
    });
    onLeave(off);
    if (fromQr && item && !Player.isPlaying(st.id)) Player.play(item, "qr");
  });
  return `<div class="wrap">
    <a class="back" href="#/site/${siteId}">${icon("back")} ${esc(L(s.name))}</a>
    <span class="label">${t("stopOf", i, s.stops.length - 1)}</span>
    <h1 style="margin-top:6px">${esc(L(st.title))}</h1>
    ${st.where ? `<div class="small muted">${icon("pin", "")} ${esc(L(st.where))}</div>` : ""}
    ${gallery(st.photos, st.id)}
    <div class="card listen-box">
      ${item ? `<div class="listen-main"><button class="play-big${Player.isPlaying(st.id) ? " is-on" : ""}" id="playBtn" data-play="${st.id}" type="button" aria-label="${t("listen")}">${icon(Player.isPlaying(st.id) ? "pause" : "play")}</button>
        <div style="flex:1"><b>${esc(L(st.title))}</b><div class="progress" style="margin-top:8px"><i data-prog="${st.id}"></i></div>
        <div class="tiny muted" style="margin-top:6px">${t("speed")}: ${String(settings.speed).replace(".", ",")}× · ${st.voice === "nam" ? "♂" : "♀"} ${esc(D.index.voice?.[st.voice] || "")}</div></div></div>`
        : `<p class="small muted" style="margin:0">${t("noAudio")}</p>`}
    </div>
    ${settings.lang === "ko" && !st.text.ko ? `<p class="note" style="margin-top:12px">${t("koNote")}</p>` : ""}
    ${st.thenNow ? `<div class="section"><h2>${t("thenNow")}</h2></div><div class="thennow"><img src="${esc(st.thenNow.now.src)}" alt="${t("now")}"><img class="old" src="${esc(st.thenNow.then.src)}" alt="${t("then")}"><span class="bar"></span>
      <span class="lbl" style="left:10px">${t("then")} · ${esc(st.thenNow.then.year || "")}</span><span class="lbl" style="right:10px">${t("now")}</span><input type="range" min="0" max="100" value="50" aria-label="${t("thenNow")}"></div>
      <p class="tiny muted">${esc(st.thenNow.then.credit || "")}</p>` : ""}
    <div class="section"><h2>${t("transcript")}</h2></div>
    <div class="script">${text.map((p) => `<p>${esc(p)}</p>`).join("")}</div>
    ${st.sources?.length ? `<details class="card" style="margin-top:12px"><summary class="card-body" style="cursor:pointer;font-weight:600">${t("sources")} (${st.sources.length})</summary>
      <ol class="sources" style="margin:0 16px 14px">${st.sources.map((id) => srcMap[id]).filter(Boolean).map((x) => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a> <span class="muted">– ${esc(x.publisher || "")}</span></li>`).join("")}</ol></details>` : ""}
    <div class="row" style="margin-top:12px"><button class="btn small" id="qrBtn" type="button">${icon("qr")}${t("showQr")}</button>
      ${s.quiz?.length ? `<a class="btn small" href="#/quiz/${siteId}">${icon("quiz")}${t("quiz")}</a>` : ""}</div>
    <nav class="pager">
      ${prev ? `<a class="card" href="#/stop/${prev.id}"><small>← ${t("prev")}</small>${esc(L(prev.title))}</a>` : "<span></span>"}
      ${next ? `<a class="card next" href="#/stop/${next.id}"><small>${t("next")} →</small>${esc(L(next.title))}</a>` : s.quiz?.length ? `<a class="card next" href="#/quiz/${siteId}"><small>${t("quiz")} →</small>${t("quizN", s.quiz.length)}</a>` : "<span></span>"}
    </nav>
  </div>`;
}
export function stopUrl(stopId) { return `${location.origin}${location.pathname}#/stop/${stopId}?qr`; }
export function qrSvg(text, cell = 4) {
  const q = window.qrcode(0, "M");
  q.addData(text); q.make();
  return q.createSvgTag({ cellSize: cell, margin: 2, scalable: true });
}
function showQr(st, s) {
  const box = document.createElement("div");
  box.className = "lightbox";
  box.innerHTML = `<div class="card" style="padding:20px;text-align:center;max-width:320px;background:#fff;color:#26211c">
    <b>${esc(L(s.name))}</b><div class="small">${esc(st.id)} · ${esc(L(st.title))}</div>
    <div class="qr-box" style="width:220px;margin:12px auto">${qrSvg(stopUrl(st.id))}</div><div class="tiny" style="word-break:break-all">${esc(stopUrl(st.id))}</div></div>
    <button class="icon-btn" type="button" aria-label="Đóng">${icon("close")}</button>`;
  box.addEventListener("click", () => box.remove());
  document.body.append(box);
}
export { PASS };
