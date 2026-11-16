// Các trang phụ: đố vui, hộ chiếu, dòng thời gian, lễ hội, ẩm thực, lịch trình, nghe ở lớp, cài đặt, giới thiệu, mã QR, công cụ giáo viên.
import { D, loadSite, audioItem, onLeave, setLang, rerender } from "./app.js";
import { settings, saveSettings, progress, Geo, Player, store, logEvent, recordQuiz, logAsCsv, nextFest, PASS } from "./core.js";
const lunarDay = (l, date) => (l.days ? l.days.find((d) => +nextFest({ lunar: { month: l.month, day: d } }) === +date) ?? l.days[0] : l.day);
import { LANGS } from "./i18n.js";
import { esc, t, L, icon, gm, gmTerms, stampSvg, stampState, toast, download, fmtDate } from "./ui.js";
import { foodCard, afterRender, qrSvg, stopUrl } from "./views-a.js";

const view = () => document.getElementById("view");
const later = (fn) => setTimeout(fn, 0);
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

// ---------- Đố vui ----------
export async function quizPage(siteId) {
  const s = await loadSite(siteId);
  const qs = s.quiz.map((q) => {
    const opts = (q.a[settings.lang] || q.a.en || q.a.vi).map((txt, i) => ({ txt, ok: i === q.correct }));
    return { q: L(q.q), why: L(q.why), stop: q.stop, opts: shuffle(opts) };
  });
  let i = 0, score = 0;
  const draw = () => {
    if (i >= qs.length) return result();
    const q = qs[i];
    view().innerHTML = `<div class="wrap"><a class="crumb" href="#/site/${siteId}">${esc(L(s.name))}</a>
      <div class="quiz-progress">${qs.map((_, k) => `<i class="${k <= i ? "on" : ""}"></i>`).join("")}</div>
      <p class="label" style="margin-top:14px">${t("question", i + 1, qs.length)}</p>
      <p class="quiz-q">${esc(q.q)}</p>
      <div class="answers">${q.opts.map((o, k) => `<button class="answer" data-k="${k}" type="button"><b>${"ABCD"[k]}</b><span>${esc(o.txt)}</span></button>`).join("")}</div>
      <div id="why"></div></div>`;
    view().querySelector(".answers").addEventListener("click", (e) => {
      const b = e.target.closest(".answer");
      if (!b || view().querySelector(".answer.right, .answer.wrong")) return;
      const o = q.opts[+b.dataset.k];
      if (o.ok) score++;
      view().querySelectorAll(".answer").forEach((x, k) => { if (q.opts[k].ok) x.classList.add("right"); });
      if (!o.ok) b.classList.add("wrong");
      document.getElementById("why").innerHTML = `<div class="why"><b>${o.ok ? t("right") : t("wrong")}</b> ${esc(q.why)}
        ${q.stop ? `<div class="tiny" style="margin-top:6px"><a href="#/stop/${q.stop}">${icon("play", "")} ${esc(q.stop)}</a></div>` : ""}</div>
        <button class="btn primary block" style="margin-top:12px" id="nextQ" type="button">${i + 1 < qs.length ? t("nextQ") : t("finish")}</button>`;
      document.getElementById("nextQ").addEventListener("click", () => { i++; draw(); window.scrollTo(0, 0); });
    });
  };
  const result = () => {
    const stamped = recordQuiz(siteId, score, qs.length);
    const pass = score >= PASS(qs.length);
    view().innerHTML = `<div class="wrap"><a class="crumb" href="#/site/${siteId}">${esc(L(s.name))}</a>
      <div class="card framed score"><span class="label">${t("yourScore")}</span><div class="big">${score}/${qs.length}</div>
      <div style="width:120px;margin:14px auto">${stampSvg(D.byId[siteId] || s, stampState(siteId), 120)}</div>
      <p>${progress.stamped[siteId] ? t("stampEarned") : !pass ? t("stampNeedQuiz", PASS(qs.length)) : t("stampNeedVisit")}</p>
      <div class="row" style="justify-content:center"><button class="btn" id="again" type="button">${t("again")}</button><a class="btn primary" href="#/passport">${icon("passport")}${t("passport")}</a></div></div></div>`;
    document.getElementById("again").addEventListener("click", () => { i = 0; score = 0; qs.forEach((q) => { q.opts = shuffle(q.opts); }); draw(); });
    if (stamped) toast(t("stampEarned"));
  };
  later(draw);
  return `<div class="wrap empty">${t("loading")}</div>`;
}

// ---------- Hộ chiếu di sản ----------
export function passport() {
  const sites = D.index.routes.flatMap((r) => r.sites.map((id) => D.byId[id])).filter(Boolean);
  const done = sites.filter((s) => progress.stamped[s.id]).length;
  later(() => document.getElementById("certBtn")?.addEventListener("click", makeCert));
  return `<div class="wrap" style="padding-top:14px">
    <div class="passport-head"><img src="img/brand/non-quai-thao.svg" alt="" style="width:56px;margin:0 auto 8px;border:2px solid #fbf7ef;border-radius:8px">
      <h1>${t("passport")}</h1><p style="margin:0">${t("passportText")}</p><p style="margin:8px 0 0;font:800 1.4rem var(--display)">${t("stampsCount", done, sites.length)}</p></div>
    ${D.index.routes.map((r) => `<div class="section"><h2>${r.num}. ${esc(L(r.name))}</h2></div>
      <div class="stamps">${r.sites.map((id) => D.byId[id]).filter(Boolean).map((s) => {
        const a = progress.arrived[s.id], q = progress.quiz[s.id];
        return `<a class="stamp" href="#/site/${s.id}">${stampSvg(s, stampState(s.id))}<b>${esc(L(s.name))}</b><br>
          <span class="${a ? "" : "muted"}">${a ? "✓" : "○"} ${t("visited")}</span><br><span class="${q && q.score >= PASS(q.total) ? "" : "muted"}">${q && q.score >= PASS(q.total) ? "✓" : "○"} ${t("quizPassed")}${q ? ` ${q.score}/${q.total}` : ""}</span></a>`;
      }).join("")}</div>`).join("")}
    <div class="section"><h2>${t("badges")}</h2></div>
    <div class="badges">${D.index.routes.map((r) => { const ok = r.sites.every((id) => progress.stamped[id]); return `<div class="card badge${ok ? "" : " off"}"><span class="disc" style="background:${r.color}">${r.num}</span><div class="small"><b>${esc(L(r.name))}</b><br>${r.sites.filter((id) => progress.stamped[id]).length}/${r.sites.length}</div></div>`; }).join("")}</div>
    <div class="section"><h2>${t("certificate")}</h2></div>
    <div class="card"><div class="card-body"><div class="field"><label for="certName">${t("yourName")}</label><input id="certName" maxlength="40" value="${esc(store.get("certName", ""))}"></div>
      <button class="btn primary" id="certBtn" type="button" ${done ? "" : "disabled"}>${icon("star")}${t("makeCert")}</button><div id="certOut" style="margin-top:12px"></div></div></div></div>`;
}
async function makeCert() {
  const name = document.getElementById("certName").value.trim();
  store.set("certName", name);
  const sites = D.index.routes.flatMap((r) => r.sites.map((id) => D.byId[id])).filter(Boolean);
  const got = sites.filter((s) => progress.stamped[s.id]);
  const W = 1200, H = 850, c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  await document.fonts.ready;
  g.fillStyle = "#fffdfb"; g.fillRect(0, 0, W, H);
  g.strokeStyle = "#2b1a3d"; g.lineWidth = 10; g.strokeRect(30, 30, W - 60, H - 60);
  g.strokeStyle = "#dcb46a"; g.lineWidth = 3; g.strokeRect(48, 48, W - 96, H - 96);
  const logo = new Image(); logo.src = "img/brand/non-quai-thao.svg"; await logo.decode().catch(() => {});
  g.drawImage(logo, W / 2 - 55, 80, 110, 110);
  g.fillStyle = "#24172f"; g.textAlign = "center";
  g.font = "700 60px 'Cormorant Garamond', serif"; g.fillText(t("certificate").toUpperCase(), W / 2, 260);
  g.font = "500 28px 'Be Vietnam Pro', sans-serif"; g.fillText(t("passport"), W / 2, 310);
  g.font = "italic 600 56px 'Cormorant Garamond', serif"; g.fillStyle = "#c22d5b"; g.fillText(name || "…", W / 2, 400);
  g.fillStyle = "#24172f"; g.font = "500 28px 'Be Vietnam Pro', sans-serif";
  g.fillText(t("stampsCount", got.length, sites.length), W / 2, 455);
  const per = Math.min(got.length, 10), sz = 80, gap = 16, x0 = W / 2 - (per * (sz + gap) - gap) / 2;
  for (let i = 0; i < got.length && i < 20; i++) {
    const img = new Image();
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(stampSvg(got[i], "done", sz).replace(/var\(--son-600\)/g, "#c22d5b"));
    await img.decode().catch(() => {});
    g.drawImage(img, x0 + (i % 10) * (sz + gap), 490 + Math.floor(i / 10) * (sz + gap), sz, sz);
  }
  g.font = "500 22px 'Be Vietnam Pro', sans-serif"; g.fillStyle = "#5b5148";
  g.fillText(`Kinh Bắc Ký Sự · ${new Date().toLocaleDateString("vi-VN")}`, W / 2, H - 90);
  const url = c.toDataURL("image/png");
  document.getElementById("certOut").innerHTML = `<img src="${url}" alt="${t("certificate")}" style="border-radius:8px;box-shadow:var(--bong-1)"><a class="btn" style="margin-top:10px" download="chung-nhan-kinh-bac.png" href="${url}">${icon("download")}${t("shareCert")}</a>`;
  logEvent("certificate", { score: got.length });
}

// ---------- Dòng thời gian ----------
export function timeline() {
  const list = [...D.index.sites].filter((s) => s.era?.year != null).sort((a, b) => a.era.year - b.era.year);
  return `<div class="wrap"><div class="section" style="margin-top:16px"><h2>${t("timeline")}</h2></div><p class="muted small">${t("timelineText")}</p>
    <ol class="timeline">${list.map((s) => `<li><div class="yr">${s.era.year < 0 ? `${-s.era.year} TCN` : s.era.year}</div>
      <a class="card site-item" href="#/site/${s.id}" style="margin-top:6px"><img src="${esc(s.cover?.thumb || "img/brand/icon-app.svg")}" alt="" loading="lazy"><div class="meta"><h3>${esc(L(s.name))}</h3>
      <span class="tiny muted">${esc(L(s.era.label) || "")}</span><span class="lead">${esc(L(s.era.event) || L(s.lead))}</span></div></a></li>`).join("")}</ol></div>`;
}

// ---------- Lịch lễ hội ----------
export function festivals() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const list = D.index.sites.filter((s) => s.festival).map((s) => ({ s, d: nextFest(s.festival) })).filter((x) => x.d).sort((a, b) => a.d - b.d);
  later(() => view().querySelectorAll("[data-ics]").forEach((b) => b.addEventListener("click", () => {
    const x = list[+b.dataset.ics];
    const d = x.d, p = (n) => String(n).padStart(2, "0"), ymd = (dt) => `${dt.getFullYear()}${p(dt.getMonth() + 1)}${p(dt.getDate())}`;
    const end = new Date(d); end.setDate(end.getDate() + 1);
    download(`le-hoi-${x.s.id}.ics`, ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Kinh Bac Ky Su//VI", "BEGIN:VEVENT", `UID:${x.s.id}-${ymd(d)}@kinhbac`, `DTSTAMP:${ymd(new Date())}T000000Z`,
      `DTSTART;VALUE=DATE:${ymd(d)}`, `DTEND;VALUE=DATE:${ymd(end)}`, `SUMMARY:${L(x.s.festival.name)}`, `LOCATION:${L(x.s.name)}`, `DESCRIPTION:${L(x.s.festival.span)}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n"), "text/calendar");
  })));
  return `<div class="wrap"><div class="section" style="margin-top:16px"><h2>${t("festivals")}</h2></div><p class="muted small">${t("festText")}</p>
    <div class="stack">${list.map((x, i) => `<div class="card fest"><div class="cal"><b>${x.d.getMonth() + 1}/${x.d.getFullYear()}</b><span>${x.d.getDate()}</span></div>
      <div style="flex:1;min-width:0"><span class="label">${t("daysLeft", Math.round((x.d - today) / 864e5))}${x.s.festival.lunar ? ` · ${t("lunar", lunarDay(x.s.festival.lunar, x.d), x.s.festival.lunar.month)}` : ""}</span>
      <h3 style="margin:3px 0"><a href="#/site/${x.s.id}/travel" style="color:inherit;text-decoration:none">${esc(L(x.s.festival.name))}</a></h3>
      <div class="small muted">${esc(L(x.s.festival.span))} · ${fmtDate(x.d)}</div></div>
      <button class="icon-btn" data-ics="${i}" type="button" aria-label="${t("addCal")}" title="${t("addCal")}">${icon("calendar")}</button></div>`).join("")}</div></div>`;
}

// ---------- Ẩm thực, đặc sản ----------
export function food() {
  const where = {};
  D.index.sites.forEach((s) => (s.specialties || []).forEach((f) => { (where[f] ||= []).push(s); }));
  const groups = [["mon", t("kindMon")], ["qua", t("kindQua")], ["thu-cong", t("kindCraft")]];
  return `<div class="wrap"><div class="section" style="margin-top:16px"><h2>${t("food")}</h2></div><p class="muted small">${t("foodText")}</p>
    ${groups.map(([k, lab]) => `<h3 style="margin-top:18px">${lab}</h3><div class="food">${Object.values(D.food).filter((f) => f.kind === k).map((f) =>
      foodCard(f).replace("</div></div>", `<div class="tiny muted" style="margin-top:8px">${(where[f.id] || []).map((s) => `<a href="#/site/${s.id}/travel">${esc(L(s.name))}</a>`).join(" · ")}</div></div></div>`)).join("")}</div>`).join("")}</div>`;
}

// ---------- Gợi ý lịch trình ----------
const ORIGINS = { hanoi: { lat: 21.0285, lng: 105.8542 }, bacninh: { lat: 21.1861, lng: 106.0763 } };
const parseMin = (o) => { const m = String(L(o) || "").match(/(\d+(?:,\d+)?)\s*(?:–|-)\s*(\d+(?:,\d+)?)?\s*giờ|(\d+(?:[.,]\d+)?)\s*(?:–|-)?\s*(\d+(?:[.,]\d+)?)?\s*(?:hour|h)/i); if (!m) return 75; const a = parseFloat((m[1] || m[3]).replace(",", ".")), b = parseFloat((m[2] || m[4] || String(a)).replace(",", ".")); return Math.round(((a + b) / 2) * 60 / 5) * 5; };
export function plan(routeId) {
  const st = store.get("plan", { route: routeId || "dat-nha-ly", mode: "half", start: "07:30", from: "hanoi" });
  if (routeId) st.route = routeId;
  const draw = () => {
    const r = D.routes[st.route];
    const ids = st.mode === "half" ? r.half_day || r.sites.slice(0, 3) : r.sites;
    const sites = ids.map((id) => D.byId[id]).filter(Boolean);
    const origin = st.from === "me" && Geo.position ? Geo.position : ORIGINS[st.from] || ORIGINS.hanoi;
    let [h, m] = st.start.split(":").map(Number);
    let now = h * 60 + m;
    const fmt = (x) => `${String(Math.floor(x / 60) % 24).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`;
    const rows = [];
    let pos = origin, lunchDone = false;
    rows.push({ cls: "", time: fmt(now), html: `<b>${st.from === "me" ? t("fromMe") : st.from === "bacninh" ? t("fromBacNinh") : t("fromHanoi")}</b>` });
    sites.forEach((s, i) => {
      const km = (Geo.distance(pos, s.gps) / 1000) * 1.35;
      const mins = Math.max(10, Math.round(((km / (i === 0 && st.from === "hanoi" ? 40 : 30)) * 60) / 5) * 5);
      rows.push({ cls: "move", time: "", html: t("travelMin", mins, km.toFixed(0)) });
      now += mins;
      if (!lunchDone && now >= 11 * 60 + 15) {
        const near = sites[Math.max(0, i - 1)];
        const fids = (D.byId[near.id].specialties || []).slice(0, 2);
        rows.push({ cls: "meal", time: fmt(now), html: `<b>${t("lunch")}</b><div class="small">${fids.map((f) => esc(L(D.food[f]?.name))).join(", ")} · <a href="${gm.near(L(gmTerms.food), near.gps)}" target="_blank" rel="noopener">${t("gmFood")}</a></div>` });
        now += 60; lunchDone = true;
      }
      const v = parseMin(s.duration);
      rows.push({ cls: "", time: fmt(now), html: `<a href="#/site/${s.id}"><b>${esc(L(s.name))}</b></a><div class="small muted">${t("visitMin", v)} · ${t("stops", s.stopCount)}</div>` });
      now += v; pos = s.gps;
    });
    const last = sites.at(-1);
    rows.push({ cls: "", time: fmt(now), html: st.mode === "full"
      ? `<b>${t("stayNight")}</b><div class="small"><a href="${gm.near(L(gmTerms.hotel), last.gps, 13)}" target="_blank" rel="noopener">${t("gmHotel")}</a> · <a href="${gm.near(L(gmTerms.stay), last.gps, 13)}" target="_blank" rel="noopener">${t("gmStay")}</a></div>`
      : `<b>✓</b>` });
    const gmLink = gm.route([origin, ...sites.map((s) => s.gps)]);
    view().querySelector("#planOut").innerHTML = `<ol class="itin">${rows.map((x) => `<li class="${x.cls}"><time>${x.time}</time><span class="dot"></span><div>${x.html}</div></li>`).join("")}</ol>
      <div class="actions"><a class="btn primary" href="${gmLink}" target="_blank" rel="noopener">${icon("dir")}${t("openRouteGm")}</a><a class="btn" href="#/route/${r.id}">${icon("route")}${esc(L(r.name))}</a></div>
      <p class="tiny muted">${t("planNote")}</p>`;
    store.set("plan", st);
  };
  later(() => {
    view().addEventListener("click", (e) => {
      const b = e.target.closest("[data-set]");
      if (!b) return;
      const [k, v] = b.dataset.set.split(":");
      st[k] = v;
      b.parentElement.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b));
      if (k === "from" && v === "me") Geo.start();
      draw();
    });
    view().querySelector("#planStart").addEventListener("change", (e) => { st.start = e.target.value || "07:30"; draw(); });
    draw();
  });
  return `<div class="wrap"><div class="section" style="margin-top:16px"><h2>${t("plan")}</h2></div><p class="muted small">${t("planText")}</p>
    <div class="chips">${D.index.routes.map((r) => `<button class="chip" data-set="route:${r.id}" aria-pressed="${st.route === r.id}">${r.num}. ${esc(L(r.name))}</button>`).join("")}</div>
    <div class="field"><span class="lbl">${t("duration")}</span><div class="seg"><button data-set="mode:half" aria-pressed="${st.mode === "half"}">${t("halfDay")}</button><button data-set="mode:full" aria-pressed="${st.mode === "full"}">${t("fullDay")}</button></div></div>
    <div class="field"><span class="lbl">${t("startFrom")}</span><div class="seg"><button data-set="from:hanoi" aria-pressed="${st.from === "hanoi"}">${t("fromHanoi")}</button><button data-set="from:bacninh" aria-pressed="${st.from === "bacninh"}">${t("fromBacNinh")}</button><button data-set="from:me" aria-pressed="${st.from === "me"}">${t("fromMe")}</button></div></div>
    <div class="field"><label for="planStart">${t("startAt")}</label><input id="planStart" type="time" value="${esc(st.start)}"></div>
    <div class="card"><div class="card-body" id="planOut"></div></div></div>`;
}

// ---------- Nghe ở lớp ----------
export async function classPage(key) {
  if (!key) {
    return `<div class="wrap"><div class="section" style="margin-top:16px"><h2>${t("classMode")}</h2></div><p class="muted">${t("classText")}</p>
      <div class="stack">${D.index.routes.map((r) => `<div class="card"><div class="card-body"><h3>${r.num}. ${esc(L(r.name))}</h3>
        <div class="row"><a class="btn small primary" href="#/class/${r.id}">${icon("class")}${t("classStart")}</a>${r.sites.map((id) => `<a class="chip" href="#/class/${id}">${esc(L(D.byId[id]?.name) || id)}</a>`).join("")}</div></div></div>`).join("")}</div></div>`;
  }
  const ids = D.routes[key] ? D.routes[key].sites : [key];
  const sites = await Promise.all(ids.filter((id) => D.byId[id]).map(loadSite));
  const slides = sites.flatMap((s) => s.stops.map((st) => ({ s, st, item: audioItem(s, st) })));
  let k = 0;
  const box = document.createElement("div");
  box.className = "class-mode";
  const draw = () => {
    const { s, st } = slides[k];
    const ph = st.photos?.find((p) => !p.todo);
    box.innerHTML = `<div class="stage"><span class="label" style="color:var(--vang-500)">${esc(L(s.name))} · ${k + 1}/${slides.length}</span>
      ${ph ? `<img src="${esc(ph.src)}" alt="">` : ""}<h2>${esc(L(st.title))}</h2>${(st.text[settings.lang] || st.text.en || st.text.vi).map((p) => `<p>${esc(p)}</p>`).join("")}</div>
      <div class="ctrl"><button class="btn" data-c="prev">${icon("skipPrev")}${t("classPrev")}</button><button class="btn primary" data-c="play">${icon(Player.item && !Player.audio.paused ? "pause" : "play")}</button>
      <button class="btn" data-c="next">${t("classNext")}${icon("skipNext")}</button><button class="btn ghost" data-c="exit" style="color:#fbf7ef">${icon("close")}${t("classStop")}</button></div>`;
    box.querySelector(".stage").scrollTop = 0;
  };
  const go = (n) => { k = Math.max(0, Math.min(slides.length - 1, n)); draw(); const it = slides[k].item; if (it) Player.play(it, "class"); };
  box.addEventListener("click", (e) => {
    const c = e.target.closest("[data-c]")?.dataset.c;
    if (c === "prev") go(k - 1);
    if (c === "next") go(k + 1);
    if (c === "play") { if (Player.item?.id === slides[k].st.id) Player.toggle(); else go(k); later(draw); }
    if (c === "exit") { location.hash = "#/class"; }
  });
  const off = Player.onEnded((done) => { if (done?.id === slides[k].st.id && k + 1 < slides.length) setTimeout(() => go(k + 1), 1800); });
  onLeave(() => { off(); box.remove(); Player.stop(); });
  document.body.append(box);
  draw();
  logEvent("class", { site: key });
  return `<div class="wrap empty">${t("classMode")}</div>`;
}

// ---------- Thêm ----------
export function more() {
  const items = [["#/plan", "clock", "plan", "planText"], ["#/food", "food", "food", "foodText"], ["#/festivals", "lantern", "festivals", "festText"], ["#/timeline", "timeline", "timeline", "timelineText"],
    ["#/class", "class", "classMode", "classText"], ["#/passport", "passport", "passport", "passportText"], ["#/qr", "qr", "qrSheet", null], ["#/settings", "settings", "settings", null],
    ["#/about", "info", "about", "howMade"], ["#/teacher", "pen", "teacher", null]];
  return `<div class="wrap"><div class="section" style="margin-top:16px"><h2>${t("more")}</h2></div>
    <div class="menu">${items.map(([h, ic, k, sub]) => `<a class="card" href="${h}">${icon(ic)}<span>${t(k)}${sub ? `<small>${t(sub)}</small>` : ""}</span>${icon("next", "")}</a>`).join("")}</div></div>`;
}

// ---------- Cài đặt ----------
export function settingsPage() {
  later(() => {
    const v = view();
    v.addEventListener("click", (e) => {
      const b = e.target.closest("[data-set]");
      if (!b) return;
      const [k, val] = b.dataset.set.split(":");
      if (k === "lang") return setLang(val);
      settings[k] = k === "speed" ? Number(val) : val; saveSettings();
      if (k === "speed") Player.setSpeed(Number(val));
      document.documentElement.dataset.theme = settings.theme; document.documentElement.dataset.size = settings.size;
      rerender();
    });
    v.querySelector("#autoplay").addEventListener("change", (e) => { settings.autoplay = e.target.checked; saveSettings(); });
    v.querySelector("#sim").addEventListener("change", (e) => {
      settings.sim = e.target.value; saveSettings();
      const s = D.byId[settings.sim]; Geo.simulate(s ? { lat: s.gps.lat + 0.0003, lng: s.gps.lng } : null);
    });
    v.querySelector("#exJson").addEventListener("click", () => download(`nhat-ky-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ progress, log: store.get("log", []) }, null, 1)));
    v.querySelector("#exCsv").addEventListener("click", () => download(`nhat-ky-${new Date().toISOString().slice(0, 10)}.csv`, "\ufeff" + logAsCsv(), "text/csv"));
    v.querySelector("#clrLog").addEventListener("click", () => { store.set("log", []); rerender(); });
    v.querySelector("#reset").addEventListener("click", async () => {
      store.clearAll(); if ("caches" in window) for (const k of await caches.keys()) if (k.startsWith("hl-site-")) await caches.delete(k);
      toast(t("resetDone")); setTimeout(() => location.reload(), 800);
    });
  });
  const seg = (k, opts) => `<div class="seg">${opts.map(([v, lab]) => `<button data-set="${k}:${v}" aria-pressed="${String(settings[k]) === String(v)}">${lab}</button>`).join("")}</div>`;
  return `<div class="wrap"><div class="section" style="margin-top:16px"><h2>${t("settings")}</h2></div>
    <div class="field"><span class="lbl">${t("lang")}</span>${seg("lang", LANGS.map((l) => [l.id, l.name]))}</div>
    <div class="field"><span class="lbl">${t("theme")}</span>${seg("theme", [["auto", t("themeAuto")], ["giay", t("themeLight")], ["dem", t("themeDark")]])}</div>
    <div class="field"><span class="lbl">${t("textSize")}</span>${seg("size", [["vua", t("sizeN")], ["lon", t("sizeL")], ["rat-lon", t("sizeXL")]])}</div>
    <div class="field"><span class="lbl">${t("speed")}</span>${seg("speed", [[0.8, "0,8×"], [1, "1×"], [1.2, "1,2×"], [1.5, "1,5×"]])}</div>
    <label class="switch"><input type="checkbox" id="autoplay" ${settings.autoplay ? "checked" : ""}><span>${t("autoplay")}</span></label>
    <div class="field" style="margin-top:14px"><label for="sim">${t("simulate")}</label><select id="sim"><option value="">${t("simNone")}</option>
      ${D.index.sites.map((s) => `<option value="${s.id}" ${settings.sim === s.id ? "selected" : ""}>${esc(L(s.name))}</option>`).join("")}</select></div>
    <div class="section"><h2>${t("log")}</h2></div><p class="small muted">${t("logText")}</p>
    <p class="small"><b>${t("logCount", store.get("log", []).length)}</b></p>
    <div class="row"><button class="btn small" id="exJson">${icon("download")}${t("exportJson")}</button><button class="btn small" id="exCsv">${icon("download")}${t("exportCsv")}</button><button class="btn small ghost" id="clrLog">${t("clearLog")}</button></div>
    <div class="divider"></div><button class="btn ghost" id="reset" style="color:var(--loi)">${t("resetAll")}</button></div>`;
}

// ---------- Giới thiệu, minh bạch nội dung ----------
export function about() {
  const a = D.index.about || {};
  const st = D.index.stats || {};
  return `<div class="wrap"><div class="section" style="margin-top:16px"><h2>${t("about")}</h2></div>
    <div class="card framed"><div class="card-body"><div class="row"><img src="img/brand/non-quai-thao.svg" alt="" style="width:56px;border-radius:8px"><div><h3 style="margin:0">Kinh Bắc Ký Sự</h3><span class="small muted">Heritage Lens · STEMPETITION 2027</span></div></div>
      <p style="margin-top:12px">${esc(L(a.intro) || "")}</p>
      <p class="small"><b>${st.sites || 0}</b> ${t("allSites").toLowerCase()} · <b>${st.stops || 0}</b> ${t("stops", "").trim()} · <b>${st.photos || 0}</b> ${t("photoBy").toLowerCase()} · <b>${st.quiz || 0}</b> ${t("quiz").toLowerCase()} · <b>${st.sources || 0}</b> ${t("sources").toLowerCase()}</p></div></div>
    <div class="section"><h2>${t("howMade")}</h2></div>
    <ol>${(a.steps || []).map((x) => `<li style="margin-bottom:8px">${esc(L(x))}</li>`).join("")}</ol>
    <div class="section"><h2>${L({ vi: "Giọng đọc và ảnh", en: "Voices and photos", ko: "음성과 사진" })}</h2></div>
    <p>${esc(L(a.voice) || "")}</p><p>${esc(L(a.photos) || "")}</p>
    <div class="section"><h2>${L({ vi: "Nhật ký phiên bản", en: "Version history", ko: "버전 기록" })}</h2><span class="tag">v${esc(a.app_version || "")}</span></div>
    <ol class="versions">${(a.versions || []).slice().reverse().map((x) => `<li><div class="row" style="gap:8px;align-items:baseline"><b>${esc(x.v)}</b><span class="small">${esc(L(x.title))}</span><span class="tiny muted" style="margin-left:auto">${esc(x.date)}</span></div><p class="small" style="margin:4px 0 0">${esc(L(x))}</p>${x.v === "v1.0" ? `<a class="small" href="v1/" target="_blank" rel="noopener">${L({ vi: "Mở bản v1.0 để so sánh", en: "Open v1.0 to compare", ko: "v1.0 열기" })}</a>` : ""}</li>`).join("")}</ol>
    <div class="section"><h2>${L({ vi: "Quyền riêng tư", en: "Privacy", ko: "개인정보" })}</h2></div><p>${esc(L(a.privacy) || "")}</p>
    <div class="section"><h2>${L({ vi: "Mã nguồn mở được dùng", en: "Open-source components", ko: "오픈소스" })}</h2></div>
    <ul class="small">${(a.credits || []).map((c) => `<li>${esc(c)}</li>`).join("")}</ul></div>`;
}

// ---------- In mã QR ----------
export async function qrSheet(siteId) {
  if (!siteId) {
    return `<div class="wrap"><div class="section" style="margin-top:16px"><h2>${t("qrSheet")}</h2></div>
      <p class="small muted">${L({ vi: "Chọn di tích để in bảng mã QR cho từng điểm dừng. Dán mã tại chỗ để khách quét là nghe, đồng thời được tính là đã đến di tích.", en: "Pick a site to print QR codes for each stop. Scanning a code on site plays the stop and counts as a visit.", ko: "유적을 골라 지점별 QR 코드를 인쇄하세요." })}</p>
      <div class="site-list">${D.index.sites.map((s) => `<a class="card site-item" href="#/qr/${s.id}"><img src="${esc(s.cover?.thumb || "img/brand/icon-app.svg")}" alt=""><div class="meta"><h3>${esc(L(s.name))}</h3><span class="tiny muted">${t("stops", s.stopCount)}</span></div></a>`).join("")}</div></div>`;
  }
  const s = await loadSite(siteId);
  return `<div class="wrap"><div class="no-print"><a class="crumb" href="#/qr">${t("qrSheet")}</a>
    <div class="row" style="margin:10px 0"><button class="btn primary" onclick="print()">${icon("download")}${L({ vi: "In trang này", en: "Print", ko: "인쇄" })}</button></div></div>
    <h2>${esc(L(s.name))}</h2><div class="qr-sheet">${s.stops.map((st, i) => `<div class="card qr-card"><span class="label">${t("stopOf", i, s.stops.length - 1)}</span>
      ${qrSvg(stopUrl(st.id))}<b>${esc(L(st.title))}</b><div class="tiny muted">${esc(st.id)} · Kinh Bắc Ký Sự</div></div>`).join("")}</div></div>`;
}

// ---------- Công cụ giáo viên: soạn di tích mới, xem thử, xuất tệp ----------
export function teacher() {
  const draft = store.get("teacherDraft", { id: "", name: "", prefix: "", lat: "", lng: "", radius: 300, lead: "", stops: [{ title: "Giới thiệu chung", vi: "", en: "", photos: "" }], quiz: [] });
  const draw = () => {
    view().innerHTML = `<div class="wrap"><div class="section" style="margin-top:16px"><h2>${t("teacher")}</h2></div>
      <p class="small muted">${L({ vi: "Soạn một di tích mới ngay trên máy: nhập thông tin, các điểm dừng và câu đố, bấm Xem thử để thấy nó trong app (chỉ trên máy này), rồi Xuất tệp YAML để gửi vào kho nội dung (thư mục content/sites) và chạy bước dựng.", en: "Draft a new site on this device, preview it in the app, then export a YAML file for content/sites.", ko: "새 유적을 작성하고 미리 본 뒤 YAML 파일로 내보내세요." })}</p>
      <div class="card"><div class="card-body">
        ${[["name", "Tên di tích"], ["id", "Mã (không dấu, gạch nối, ví dụ: dinh-lo-hanh)"], ["prefix", "Tiền tố điểm dừng (2–3 chữ in hoa, ví dụ: LH)"], ["lat", "Vĩ độ"], ["lng", "Kinh độ"], ["radius", "Bán kính nhận diện (mét)"]].map(([k, lab]) =>
          `<div class="field"><label>${lab}</label><input data-k="${k}" value="${esc(draft[k])}"></div>`).join("")}
        <button class="btn small" id="here" type="button">${icon("gps")}Lấy tọa độ chỗ tôi đang đứng</button>
        <div class="field" style="margin-top:12px"><label>Lời dẫn một câu</label><textarea data-k="lead" style="min-height:60px">${esc(draft.lead)}</textarea></div></div></div>
      ${draft.stops.map((st, i) => `<div class="card" style="margin-top:12px"><div class="card-body"><span class="label">Điểm dừng ${i}</span>
        <div class="field"><label>Tiêu đề</label><input data-s="${i}:title" value="${esc(st.title)}"></div>
        <div class="field"><label>Lời thuyết minh tiếng Việt (mỗi đoạn cách nhau một dòng trống)</label><textarea data-s="${i}:vi">${esc(st.vi)}</textarea></div>
        <div class="field"><label>Lời thuyết minh tiếng Anh</label><textarea data-s="${i}:en">${esc(st.en)}</textarea></div>
        <div class="field"><label>Đường dẫn ảnh (mỗi dòng một ảnh)</label><textarea data-s="${i}:photos" style="min-height:60px">${esc(st.photos)}</textarea></div></div></div>`).join("")}
      <button class="btn" id="addStop" type="button" style="margin-top:10px">+ Thêm điểm dừng</button>
      ${draft.quiz.map((q, i) => `<div class="card" style="margin-top:12px"><div class="card-body"><span class="label">Câu đố ${i + 1}</span>
        <div class="field"><label>Câu hỏi</label><input data-q="${i}:q" value="${esc(q.q)}"></div>
        ${[0, 1, 2, 3].map((k) => `<div class="field"><label>${k === 0 ? "Đáp án đúng" : `Đáp án sai ${k}`}</label><input data-q="${i}:a${k}" value="${esc(q.a?.[k] || "")}"></div>`).join("")}
        <div class="field"><label>Giải thích</label><input data-q="${i}:why" value="${esc(q.why)}"></div></div></div>`).join("")}
      <button class="btn" id="addQ" type="button" style="margin-top:10px">+ Thêm câu đố</button>
      <div class="actions" style="margin-top:18px"><button class="btn primary" id="preview" type="button">${icon("play")}Xem thử trong app</button><button class="btn" id="export" type="button">${icon("download")}Xuất tệp YAML</button><button class="btn ghost" id="clear" type="button">Xóa bản nháp</button></div></div>`;
  };
  const save = () => store.set("teacherDraft", draft);
  const toSite = () => {
    const id = draft.id || "ban-nhap", prefix = (draft.prefix || "BN").toUpperCase();
    const gps = { lat: parseFloat(draft.lat) || 21.18, lng: parseFloat(draft.lng) || 106.07 };
    const stops = draft.stops.map((st, i) => ({ id: `${prefix}-${String(i).padStart(2, "0")}`, kind: i ? "stop" : "intro", title: { vi: st.title, en: st.title },
      text: { vi: st.vi.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean), en: (st.en || st.vi).split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean) },
      photos: st.photos.split(/\n/).map((x) => x.trim()).filter(Boolean).map((src) => ({ src, thumb: src })), audio: {} }));
    const quiz = draft.quiz.filter((q) => q.q && q.a?.[0]).map((q) => ({ q: { vi: q.q, en: q.q }, a: { vi: q.a, en: q.a }, correct: 0, why: { vi: q.why, en: q.why } }));
    const summary = { id, prefix, route: "", name: { vi: draft.name, en: draft.name }, lead: { vi: draft.lead, en: draft.lead }, gps, radius: +draft.radius || 300, era: {}, stopCount: stops.length, cover: stops[0].photos[0] || null };
    return { id, summary, full: { ...summary, stops, quiz, sources: [], facts: [], travel: {} } };
  };
  const yaml = () => {
    const q = (s) => JSON.stringify(String(s ?? ""));
    const blk = (s, ind) => s.split("\n").map((l) => `${ind}${l}`).join("\n");
    const d = toSite().full;
    return [`id: ${d.id}`, `prefix: ${d.prefix}`, "route: ", `name: {vi: ${q(d.name.vi)}, en: ${q(d.name.en)}}`, `gps: {lat: ${d.gps.lat}, lng: ${d.gps.lng}}`, `radius: ${d.radius}`,
      `lead:\n  vi: ${q(d.lead.vi)}\n  en: ${q(d.lead.en)}`, "stops:",
      ...draft.stops.map((st, i) => `  - id: ${d.stops[i].id}\n    kind: ${i ? "stop" : "intro"}\n    voice: ${i % 2 ? "nam" : "nu"}\n    title: {vi: ${q(st.title)}, en: ${q(st.title)}}\n    vi: |\n${blk(st.vi || "…", "      ")}\n    en: |\n${blk(st.en || "…", "      ")}`),
      "quiz:", ...d.quiz.map((x) => `  - q: {vi: ${q(x.q.vi)}, en: ${q(x.q.en)}}\n    a:\n      vi: [${x.a.vi.map(q).join(", ")}]\n      en: [${x.a.en.map(q).join(", ")}]\n    correct: 0\n    why: {vi: ${q(x.why.vi)}, en: ${q(x.why.en)}}`),
      "sources: []", ""].join("\n");
  };
  later(() => {
    draw();
    const v = view();
    v.addEventListener("input", (e) => {
      const el = e.target;
      if (el.dataset.k) draft[el.dataset.k] = el.value;
      if (el.dataset.s) { const [i, k] = el.dataset.s.split(":"); draft.stops[+i][k] = el.value; }
      if (el.dataset.q) { const [i, k] = el.dataset.q.split(":"); const qq = draft.quiz[+i]; if (k.startsWith("a")) { (qq.a ||= [])[+k[1]] = el.value; } else qq[k] = el.value; }
      save();
    });
    v.addEventListener("click", (e) => {
      const id = e.target.closest("button")?.id;
      if (id === "addStop") { draft.stops.push({ title: "", vi: "", en: "", photos: "" }); save(); draw(); }
      if (id === "addQ") { draft.quiz.push({ q: "", a: ["", "", "", ""], why: "" }); save(); draw(); }
      if (id === "here") { Geo.start(); if (Geo.position) { draft.lat = Geo.position.lat.toFixed(5); draft.lng = Geo.position.lng.toFixed(5); save(); draw(); } else toast(t("gpsOn")); }
      if (id === "export") download(`${draft.id || "ban-nhap"}.yaml`, yaml(), "text/yaml");
      if (id === "clear") { store.del("teacherDraft"); location.reload(); }
      if (id === "preview") {
        const s = toSite();
        const drafts = store.get("drafts", []).filter((d) => d.id !== s.id);
        drafts.push(s); store.set("drafts", drafts);
        location.href = `${location.pathname}#/site/${s.id}`; location.reload();
      }
    });
  });
  return `<div class="wrap empty">${t("loading")}</div>`;
}
