/* app.js — Điều khiển các màn hình của Heritage Lens.
   Màn hình được chọn theo địa chỉ sau dấu # :
     #home          trang chủ: bản đồ + danh sách 6 di tích
     #site-<id>     một di tích: giới thiệu, các điểm dừng, kho ảnh
     #stop-<id>     một điểm dừng: ảnh, nút nghe, lời thuyết minh
     #quiz-<id>     đố vui của một di tích (câu hỏi trong data/quiz.json)
     #about         giới thiệu ứng dụng, nguồn tư liệu, quyền riêng tư */
(() => {
  const view = document.getElementById("view");
  const langBtn = document.getElementById("langBtn");
  const nearbyBox = document.getElementById("nearby");

  // ---------- Lưu cài đặt nhỏ trên máy (có thể bị trình duyệt chặn nên luôn bọc try/catch) ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem("hl:" + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem("hl:" + k, JSON.stringify(v)); } catch { /* bỏ qua */ } },
  };

  const state = {
    lang: store.get("lang", "vi"),
    autoIntro: store.get("autoIntro", true),
    started: false,
    announced: new Set(), // di tích đã thông báo "đang ở gần" trong lần mở app này
    data: null,
    map: null,
    simSite: null, // di tích đang giả lập vị trí (chế độ thử)
    quiz: {},      // câu đố theo di tích, đọc từ data/quiz.json
    quizRun: null, // lượt chơi đang diễn ra
    quizPrompted: new Set(), // di tích đã gợi ý chơi đố vui trong lần mở app này
    banner: null,  // "nearby" hoặc "quiz": banner vàng đang hiện loại gì
  };
  const t = (k, ...a) => { const v = UI[state.lang][k]; return typeof v === "function" ? v(...a) : v; };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const L = (obj) => (obj && typeof obj === "object" ? obj[state.lang] ?? obj.vi : obj);

  // ---------- Tra cứu dữ liệu ----------
  const site = (id) => state.data.sites.find((s) => s.id === id);
  const stopById = (id) => {
    for (const s of state.data.sites) {
      const i = s.stops.findIndex((x) => x.id === id);
      if (i >= 0) return { site: s, stop: s.stops[i], index: i };
    }
    return null;
  };
  const audioItem = (s, st) => ({
    siteId: s.id,
    src: st.audio[state.lang],
    title: `${L(s.name)} · ${L(st.title)}`,
    href: st.kind === "intro" ? `#site-${s.id}` : `#stop-${st.id}`,
  });

  // ---------- Các mẩu giao diện dùng lại ----------
  function listenButton(s, st, big = false) {
    const item = audioItem(s, st);
    const on = Player.isPlaying(item.src);
    return `<button type="button" class="listen${big ? " listen-big" : ""}${on ? " is-on" : ""}" data-play="${st.id}" aria-pressed="${on}">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="${on ? "M6 5h4v14H6zm8 0h4v14h-4z" : "M8 5v14l11-7z"}"/></svg>
      <span>${on ? t("playing") : t("listen")}</span></button>`;
  }
  function credit(p) {
    if (!p.credit) return "";
    const txt = `${t("credit")}: ${esc(p.credit)}${p.license ? ` · ${esc(p.license)}` : ""}`;
    return p.link ? `<a href="${esc(p.link)}" target="_blank" rel="noopener">${txt}</a>` : txt;
  }
  function transcript(st, open = false) {
    return `<details class="transcript"${open ? " open" : ""}>
      <summary>${t("transcript")}</summary>
      ${st.text[state.lang].map((p) => `<p>${esc(p)}</p>`).join("")}
    </details>`;
  }
  function distanceTo(s) {
    const p = Geo.position;
    return p ? Geo.distance(p, s.gps) : null;
  }

  // ---------- Trang chủ ----------
  function renderHome() {
    const p = Geo.position;
    const sites = [...state.data.sites];
    if (p) sites.sort((a, b) => distanceTo(a) - distanceTo(b));
    view.innerHTML = `
      <section class="hero">
        <h1>${t("heroTitle")}</h1>
        <p>${t("heroText")}</p>
        <div class="start-row">
          <button type="button" class="btn-primary" id="startBtn" ${state.started ? "disabled" : ""}>
            ${state.started ? t("started") : t("start")}</button>
          <label class="switch"><input type="checkbox" id="autoIntro" ${state.autoIntro ? "checked" : ""}>
            <span>${t("autoIntro")}</span></label>
        </div>
        <p class="hint" id="gpsHint">${state.simSite ? `<b>${esc(t("simOn", L(state.simSite.name)))}</b>` : t("startHint")}</p>
      </section>
      <section class="block">
        <h2>${t("mapTitle")}</h2>
        <div id="map" class="map" role="region" aria-label="${t("mapTitle")}"></div>
      </section>
      <section class="block">
        <h2>${t("listTitle")}</h2>
        <ol class="site-list">
          ${sites.map((s) => {
            const d = distanceTo(s);
            return `<li><a class="site-card" href="#site-${s.id}">
              <img src="${s.cover.thumb}" alt="" loading="lazy">
              <span class="site-card-body">
                <span class="site-card-name">${esc(L(s.name))}</span>
                <span class="site-card-meta">${s.stops.length - 1} ${state.lang === "vi" ? "điểm dừng" : "stops"}
                  ${d !== null ? ` · <b>${d < s.radius ? t("here") : t("away", Geo.format(d))}</b>` : ""}</span>
              </span></a></li>`;
          }).join("")}
        </ol>
      </section>`;
    document.getElementById("startBtn").addEventListener("click", startTour);
    document.getElementById("autoIntro").addEventListener("change", (e) => {
      state.autoIntro = e.target.checked; store.set("autoIntro", state.autoIntro);
    });
    drawMap();
  }

  function drawMap() {
    if (state.map) { state.map.remove(); state.map = null; }
    const el = document.getElementById("map");
    if (!el || typeof L_ === "undefined") return;
    const map = L_.map(el, { scrollWheelZoom: false, attributionControl: true });
    L_.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).on("tileerror", () => el.classList.add("map-offline")).addTo(map);
    const bounds = [];
    state.data.sites.forEach((s, i) => {
      const icon = L_.divIcon({ className: "pin", html: `<span>${i + 1}</span>`, iconSize: [34, 34], iconAnchor: [17, 34] });
      L_.marker([s.gps.lat, s.gps.lng], { icon, title: L(s.name) })
        .addTo(map)
        .bindPopup(`<a href="#site-${s.id}"><b>${esc(L(s.name))}</b></a>`);
      bounds.push([s.gps.lat, s.gps.lng]);
    });
    const p = Geo.position;
    if (p) {
      L_.circleMarker([p.lat, p.lng], { radius: 8, color: "#fff", weight: 3, fillColor: "#1d6fd8", fillOpacity: 1 })
        .addTo(map).bindTooltip(t("here"));
      bounds.push([p.lat, p.lng]);
    }
    map.fitBounds(bounds, { padding: [24, 40] });
    state.map = map;
  }

  // ---------- Một di tích ----------
  function renderSite(id) {
    const s = site(id);
    if (!s) return renderHome();
    const intro = s.stops.find((x) => x.kind === "intro");
    const stops = s.stops.filter((x) => x.kind === "stop");
    const gallery = state.data.gallery[s.id] || [];
    view.innerHTML = `
      <section class="site-hero" style="background-image:linear-gradient(180deg, rgba(20,12,8,.15) 0%, rgba(20,12,8,.78) 100%), url('${s.cover.src}')">
        <a class="crumb" href="#home">← ${t("home")}</a>
        <h1>${esc(L(s.name))}</h1>
        ${state.lang === "vi" ? `<p>${esc(s.lead)}</p>` : ""}
        <span class="hero-credit">${credit(s.cover)}</span>
      </section>
      <section class="block intro-card">
        <div class="row-between"><h2>${t("intro")}</h2>${listenButton(s, intro, true)}</div>
        ${transcript(intro)}
      </section>
      <section class="block">
        <h2>${t("stops")}</h2>
        <p class="hint">${t("stopsHint")}</p>
        <ol class="stop-list">
          ${stops.map((st, i) => `<li class="stop-card">
            <a href="#stop-${st.id}" class="stop-thumb"><img src="${st.photos[0].thumb}" alt="" loading="lazy"><span>${i + 1}</span></a>
            <div class="stop-body">
              <a href="#stop-${st.id}" class="stop-title">${esc(L(st.title))}</a>
              ${listenButton(s, st)}
            </div></li>`).join("")}
        </ol>
      </section>
      ${state.lang === "vi" ? `<section class="block"><h2>${t("facts")}</h2>
        <dl class="facts">${Object.entries(s.facts).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl></section>` : ""}
      ${gallery.length ? `<section class="block"><h2>${t("gallery")}</h2><p class="hint">${t("galleryHint")}</p>
        <div class="gallery">${gallery.map((g, i) => `<button type="button" class="g-item" data-gallery="${s.id}" data-index="${i}">
          <img src="${g.thumb}" alt="${esc(g.caption || "")}" loading="lazy"></button>`).join("")}</div></section>` : ""}
      ${quizCard(s)}
      <section class="block">
        <button type="button" class="btn-secondary" id="offlineBtn">${t("offline")}</button>
        <span class="hint" id="offlineMsg"></span>
      </section>`;
    document.getElementById("offlineBtn").addEventListener("click", () => saveOffline(s));
  }

  // ---------- Một điểm dừng ----------
  function renderStop(id) {
    const f = stopById(id);
    if (!f) return renderHome();
    const { site: s, stop: st } = f;
    const list = s.stops.filter((x) => x.kind === "stop");
    const i = list.findIndex((x) => x.id === st.id);
    const prev = list[i - 1], next = list[i + 1];
    view.innerHTML = `
      <section class="stop-photos">
        <div class="carousel" tabindex="0" aria-label="${esc(L(st.title))}">
          ${st.photos.map((p, k) => `<figure>
            <img src="${p.src}" alt="${esc(L(st.title))}" ${k ? 'loading="lazy"' : ""}>
            <figcaption>${st.photos.length > 1 ? t("photoOf", k + 1, st.photos.length) + " " : ""}${credit(p)}</figcaption>
          </figure>`).join("")}
        </div>
      </section>
      <section class="block stop-main">
        <a class="crumb crumb-dark" href="#site-${s.id}">← ${esc(L(s.name))}</a>
        <h1>${esc(L(st.title))}</h1>
        ${listenButton(s, st, true)}
        ${transcript(st, true)}
      </section>
      <nav class="stop-nav block">
        ${prev ? `<a href="#stop-${prev.id}">← ${t("prev")}</a>` : `<a href="#site-${s.id}">← ${t("back")}</a>`}
        ${next ? `<a href="#stop-${next.id}">${t("next")} →</a>` : `<a href="#site-${s.id}">${t("back")} →</a>`}
      </nav>`;
  }

  // ---------- Đố vui ----------
  // Mỗi di tích có 4 câu, lấy dữ kiện từ chính lời thuyết minh đã duyệt.
  // Điểm chỉ lưu trong trình duyệt (localStorage), không gửi đi đâu.
  function quizCard(s) {
    const qs = state.quiz[s.id];
    if (!qs || !qs.length) return "";
    const best = store.get("quiz:" + s.id, null);
    return `<section class="block quiz-card">
      <h2>${t("quizTitle")}</h2>
      <p class="hint">${t("quizHint", qs.length)}</p>
      <a class="btn-primary" href="#quiz-${s.id}">${t("quizStart")}</a>
      ${best !== null ? `<p class="hint">${t("quizBest", best, qs.length)}</p>` : ""}
    </section>`;
  }

  // Trộn thứ tự đáp án để mỗi lần chơi khác nhau (Fisher–Yates)
  function shuffled(n) {
    const a = [...Array(n).keys()];
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  function renderQuiz(id) {
    const s = site(id), qs = state.quiz[id];
    if (!s || !qs) return renderHome();
    if (!state.quizRun || state.quizRun.site !== id) state.quizRun = { site: id, i: 0, score: 0, picked: null, order: shuffled(qs[0].options.vi.length) };
    const run = state.quizRun;
    if (run.i >= qs.length) return renderQuizEnd(s, qs);
    const q = qs[run.i];
    const opts = L(q.options);
    const done = run.picked !== null;
    const f = stopById(q.stop);
    view.innerHTML = `
      <section class="block quiz">
        <a class="crumb crumb-dark" href="#site-${s.id}">← ${esc(L(s.name))}</a>
        <p class="quiz-count">${t("quizTitle")} · ${t("quizOf", run.i + 1, qs.length)}</p>
        <div class="quiz-progress" aria-hidden="true"><span style="width:${(run.i / qs.length) * 100}%"></span></div>
        <h1 class="quiz-q">${esc(L(q.q))}</h1>
        <div class="quiz-options" role="group" aria-label="${esc(L(q.q))}">
          ${run.order.map((k, n) => {
            let cls = "";
            if (done && k === q.answer) cls = " is-right";
            else if (done && k === run.picked) cls = " is-wrong";
            return `<button type="button" class="quiz-opt${cls}" data-opt="${k}" ${done ? "disabled" : ""}>
              <b>${"ABCD"[n]}</b><span>${esc(opts[k])}</span></button>`;
          }).join("")}
        </div>
        ${done ? `<div class="quiz-feedback ${run.picked === q.answer ? "ok" : "no"}" tabindex="-1" id="quizFb">
            <strong>${run.picked === q.answer ? t("quizRight") : t("quizWrong")}</strong> ${esc(L(q.explain))}
            ${f ? `<a href="${f.stop.kind === "intro" ? `#site-${f.site.id}` : `#stop-${f.stop.id}`}">${t("quizRelisten")}</a>` : ""}
          </div>
          <button type="button" class="btn-primary" id="quizNext">${run.i + 1 < qs.length ? t("quizNext") : t("quizFinish")}</button>` : ""}
      </section>`;
    view.querySelectorAll("[data-opt]").forEach((b) => b.addEventListener("click", () => {
      run.picked = Number(b.dataset.opt);
      if (run.picked === q.answer) run.score++;
      renderQuiz(id);
      const fb = document.getElementById("quizFb"); if (fb) fb.focus();
    }));
    const nx = document.getElementById("quizNext");
    if (nx) nx.addEventListener("click", () => {
      run.i++; run.picked = null;
      if (run.i < qs.length) run.order = shuffled(qs[run.i].options.vi.length);
      renderQuiz(id); window.scrollTo(0, 0);
    });
  }

  function renderQuizEnd(s, qs) {
    const run = state.quizRun;
    const best = Math.max(run.score, store.get("quiz:" + s.id, 0));
    store.set("quiz:" + s.id, best);
    view.innerHTML = `
      <section class="block quiz quiz-end">
        <a class="crumb crumb-dark" href="#site-${s.id}">← ${esc(L(s.name))}</a>
        <p class="quiz-count">${t("quizTitle")} · ${esc(L(s.name))}</p>
        <p class="quiz-big">${run.score}/${qs.length}</p>
        <h1 class="quiz-q">${t("quizScore", run.score, qs.length)}</h1>
        <p>${t("quizCheer", run.score, qs.length)}</p>
        <p class="hint">${t("quizBest", best, qs.length)}</p>
        <div class="start-row">
          <button type="button" class="btn-primary" id="quizAgain">${t("quizAgain")}</button>
          <a class="btn-secondary" href="#site-${s.id}">${t("back")}</a>
        </div>
      </section>`;
    document.getElementById("quizAgain").addEventListener("click", () => { state.quizRun = null; renderQuiz(s.id); });
  }

  // Nghe hết một bài thuyết minh → gợi ý chơi đố vui của di tích đó (mỗi di tích một lần)
  Player.onEnded((item) => {
    if (!item || !state.quiz[item.siteId] || state.quizPrompted.has(item.siteId)) return;
    if (route().name === "quiz") return;
    state.quizPrompted.add(item.siteId);
    showQuizPrompt(site(item.siteId));
  });
  function showQuizPrompt(s, silent = false) {
    state.banner = "quiz"; state.bannerSite = s;
    document.getElementById("nearbyText").textContent = t("quizPrompt", L(s.name));
    const btn = document.getElementById("nearbyPlay");
    btn.textContent = t("quizPlay");
    btn.onclick = () => { state.quizRun = null; nearbyBox.hidden = true; location.hash = `#quiz-${s.id}`; };
    if (!silent) nearbyBox.hidden = false;
  }

  // ---------- Giới thiệu ứng dụng ----------
  function renderAbout() {
    const a = state.data.about[state.lang];
    const credits = Object.entries(state.data.gallery).flatMap(([, list]) => list.filter((g) => g.license));
    view.innerHTML = `
      <section class="block prose">
        <a class="crumb crumb-dark" href="#home">← ${t("home")}</a>
        <h1>${t("aboutTitle")}</h1>
        ${a.map((p) => (p.startsWith("## ") ? `<h2>${esc(p.slice(3))}</h2>` : `<p>${esc(p)}</p>`)).join("")}
        <h2>${state.lang === "vi" ? "Nguồn tư liệu" : "Sources"}</h2>
        <ul class="sources">${state.data.sources.map((x) => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a></li>`).join("")}</ul>
        <h2>${state.lang === "vi" ? "Ảnh có giấy phép mở" : "Openly licensed photos"}</h2>
        <ul class="sources">${credits.map((g) => `<li>${esc(g.caption || "")} — <a href="${esc(g.link)}" target="_blank" rel="noopener">${esc(g.credit)} · ${esc(g.license)}</a></li>`).join("")}</ul>
        <h2>${t("simTitle")}</h2>
        <p>${t("simText")}</p>
        <div class="sim-list">
          ${state.data.sites.map((s) => `<button type="button" class="btn-secondary" data-sim="${s.id}">${esc(t("simAt", L(s.name)))}</button>`).join("")}
          ${state.simSite ? `<button type="button" class="btn-secondary" data-sim="">${t("simOff")}</button>` : ""}
        </div>
        <p class="hint">${state.lang === "vi" ? "Phiên bản nội dung" : "Content version"}: ${esc(state.data.version)}</p>
      </section>`;
    view.querySelectorAll("[data-sim]").forEach((b) => b.addEventListener("click", () => setSim(b.dataset.sim)));
  }

  // Bật/tắt chế độ thử vị trí rồi quay về trang chủ để thấy kết quả
  function setSim(id) {
    const s = id ? state.data.sites.find((x) => x.id === id) : null;
    state.simSite = s;
    // không gọi Player.unlock() ở đây: chính cú bấm này đã cho phép phát âm thanh
    if (s) { state.announced.delete(s.id); Geo.simulate(s.gps); }
    else { Geo.simulate(null); state.announced.clear(); nearbyBox.hidden = true; }
    lastHomeRender = 0;
    if (location.hash === "#home") renderHome(); else location.hash = "#home";
  }

  // ---------- Xem ảnh lớn ----------
  function openLightbox(siteId, index) {
    const list = state.data.gallery[siteId];
    let i = index;
    const box = document.createElement("div");
    box.className = "lightbox";
    box.setAttribute("role", "dialog");
    const show = () => {
      const g = list[i];
      box.innerHTML = `<button type="button" class="lb-close" aria-label="Đóng">×</button>
        <button type="button" class="lb-prev" aria-label="Trước">‹</button>
        <figure><img src="${g.src}" alt="${esc(g.caption || "")}">
          <figcaption>${esc(g.caption || "")}<br><small>${credit(g)}</small></figcaption></figure>
        <button type="button" class="lb-next" aria-label="Sau">›</button>`;
    };
    box.addEventListener("click", (e) => {
      if (e.target.closest(".lb-close") || e.target === box) { box.remove(); return; }
      if (e.target.closest(".lb-prev")) { i = (i - 1 + list.length) % list.length; show(); }
      if (e.target.closest(".lb-next")) { i = (i + 1) % list.length; show(); }
    });
    document.addEventListener("keydown", function onKey(e) {
      if (!document.body.contains(box)) return document.removeEventListener("keydown", onKey);
      if (e.key === "Escape") box.remove();
      if (e.key === "ArrowLeft") { i = (i - 1 + list.length) % list.length; show(); }
      if (e.key === "ArrowRight") { i = (i + 1) % list.length; show(); }
    });
    show();
    document.body.appendChild(box);
  }

  // ---------- Tải trước ảnh và âm thanh của một di tích để dùng khi mất mạng ----------
  async function saveOffline(s) {
    const btn = document.getElementById("offlineBtn"), msg = document.getElementById("offlineMsg");
    if (!("caches" in window)) { msg.textContent = t("offlineFail"); return; }
    const urls = new Set([s.cover.src]);
    s.stops.forEach((st) => { urls.add(st.audio.vi); urls.add(st.audio.en); st.photos.forEach((p) => { urls.add(p.src); urls.add(p.thumb); }); });
    (state.data.gallery[s.id] || []).forEach((g) => { urls.add(g.src); urls.add(g.thumb); });
    btn.disabled = true;
    try {
      const cache = await caches.open("hl-media-v1");
      let n = 0;
      for (const u of urls) {
        if (!(await cache.match(u))) { const r = await fetch(u); if (r.ok) await cache.put(u, r); }
        msg.textContent = t("offlineBusy", ++n, urls.size);
      }
      msg.textContent = t("offlineDone");
    } catch { msg.textContent = t("offlineFail"); }
    btn.disabled = false;
  }

  // ---------- Bắt đầu tham quan: mở khóa âm thanh + bật định vị ----------
  function startTour() {
    Player.unlock();
    const ok = Geo.start((err) => {
      const h = document.getElementById("gpsHint");
      if (h) h.textContent = err === "denied" ? t("gpsDenied") : t("gpsNone");
    });
    state.started = ok;
    if (ok) { const b = document.getElementById("startBtn"); if (b) { b.textContent = t("started"); b.disabled = true; } }
  }

  // Khi vị trí thay đổi: cập nhật khoảng cách, báo khi đến gần di tích
  let lastHomeRender = 0;
  Geo.onUpdate((p) => {
    for (const s of state.data.sites) {
      if (state.announced.has(s.id)) continue;
      if (Geo.distance(p, s.gps) <= s.radius) {
        state.announced.add(s.id);
        showNearby(s);
        break;
      }
    }
    // vẽ lại trang chủ tối đa 15 giây một lần để cập nhật khoảng cách
    if (route().name === "home" && Date.now() - lastHomeRender > 15000) { lastHomeRender = Date.now(); renderHome(); }
  });

  function showNearby(s, silent = false) {
    state.nearbySite = s;
    state.banner = "nearby";
    const intro = s.stops.find((x) => x.kind === "intro");
    document.getElementById("nearbyText").textContent = t("nearby", L(s.name));
    const btn = document.getElementById("nearbyPlay");
    btn.textContent = t("nearbyPlay");
    btn.onclick = () => { Player.play(audioItem(s, intro)); location.hash = `#site-${s.id}`; nearbyBox.hidden = true; };
    if (silent) return; // chỉ đổi chữ khi đổi ngôn ngữ
    nearbyBox.hidden = false;
    if (state.autoIntro && !Player.playing) Player.play(audioItem(s, intro));
  }
  document.getElementById("nearbyClose").addEventListener("click", () => { nearbyBox.hidden = true; });

  // ---------- Bấm nút Nghe / ảnh trong kho (một bộ xử lý chung cho cả trang) ----------
  view.addEventListener("click", (e) => {
    const b = e.target.closest("[data-play]");
    if (b) {
      const f = stopById(b.dataset.play);
      const item = audioItem(f.site, f.stop);
      Player.isPlaying(item.src) ? Player.toggle() : Player.play(item);
      return;
    }
    const g = e.target.closest("[data-gallery]");
    if (g) openLightbox(g.dataset.gallery, Number(g.dataset.index));
  });
  // Đổi trạng thái nút Nghe khi bắt đầu/dừng phát
  Player.onChange((cur, playing) => {
    view.querySelectorAll("[data-play]").forEach((b) => {
      const f = stopById(b.dataset.play);
      const on = playing && cur && cur.src === audioItem(f.site, f.stop).src;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-pressed", on);
      b.querySelector("path").setAttribute("d", on ? "M6 5h4v14H6zm8 0h4v14h-4z" : "M8 5v14l11-7z");
      b.querySelector("span").textContent = on ? t("playing") : t("listen");
    });
  });

  // ---------- Đổi ngôn ngữ ----------
  function applyLang() {
    document.documentElement.lang = state.lang;
    langBtn.textContent = state.lang === "vi" ? "EN" : "VI";
    langBtn.setAttribute("aria-label", state.lang === "vi" ? "Switch to English" : "Chuyển sang tiếng Việt");
  }
  langBtn.addEventListener("click", () => {
    state.lang = state.lang === "vi" ? "en" : "vi";
    store.set("lang", state.lang);
    applyLang();
    if (state.banner === "quiz" && state.bannerSite) showQuizPrompt(state.bannerSite, true);
    else if (state.nearbySite) showNearby(state.nearbySite, true);
    render();
  });

  // ---------- Điều hướng ----------
  function route() {
    const h = location.hash.slice(1);
    if (h.startsWith("site-")) return { name: "site", id: h.slice(5) };
    if (h.startsWith("stop-")) return { name: "stop", id: h.slice(5) };
    if (h.startsWith("quiz-")) return { name: "quiz", id: h.slice(5) };
    if (h === "about") return { name: "about" };
    return { name: "home" };
  }
  function render() {
    const r = route();
    document.querySelectorAll(".lightbox").forEach((x) => x.remove()); // đóng ảnh lớn khi chuyển trang
    if (r.name !== "home" && state.map) { state.map.remove(); state.map = null; }
    if (r.name === "site") renderSite(r.id);
    else if (r.name === "stop") renderStop(r.id);
    else if (r.name === "quiz") { if (!state.quizRun || state.quizRun.site !== r.id) state.quizRun = null; renderQuiz(r.id); }
    else if (r.name === "about") renderAbout();
    else renderHome();
    window.scrollTo(0, 0);
    view.focus({ preventScroll: true });
  }
  window.addEventListener("hashchange", render);

  // ---------- Khởi động ----------
  const L_ = window.L; // thư viện bản đồ Leaflet
  window.L_ = L_;
  // Đố vui là phần thêm: nếu không tải được quiz.json, ứng dụng vẫn chạy bình thường
  const quizLoad = fetch("data/quiz.json").then((r) => r.json()).then((q) => q.sites).catch(() => ({}));
  fetch("data/content.json")
    .then((r) => r.json())
    .then(async (d) => { state.data = d; state.quiz = await quizLoad; applyLang(); render(); })
    .catch(() => { view.innerHTML = `<p class="block">Không tải được dữ liệu. / Could not load data.</p>`; });

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
